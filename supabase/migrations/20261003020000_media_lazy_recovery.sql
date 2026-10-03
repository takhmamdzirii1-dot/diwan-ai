begin;

-- Private recovery state on the canonical execution, not a second job/ledger.
alter table public.ai_executions
  add column if not exists media_context jsonb,
  add column if not exists media_lease_token uuid,
  add column if not exists media_lease_until timestamptz,
  add column if not exists media_next_check_at timestamptz;

-- Keep the existing per-modality limit, but count media for its full lifetime.
-- The existing begin_ai_execution advisory lock is retained; direct inserts
-- also acquire it here. Chat's existing policy is unchanged.
create or replace function public.guard_active_media_execution()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.modality in ('image','video') then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text || ':' || new.modality,0));
    if exists(select 1 from public.ai_executions where user_id=new.user_id
      and modality=new.modality and state in ('reserved','streaming')
      and created_at > now()-interval '30 minutes') then
      raise exception using errcode='P0001',message='CONCURRENCY_LIMITED';
    end if;
  end if;
  return new;
end;
$$;
do $$ begin
  if not exists(select 1 from pg_catalog.pg_trigger where tgname='ai_executions_media_lifetime_guard'
    and tgrelid='public.ai_executions'::regclass) then
    create trigger ai_executions_media_lifetime_guard before insert on public.ai_executions
    for each row execute function public.guard_active_media_execution();
  end if;
end $$;

-- A recorded prediction may outlive the original 15-minute reserve. Align only
-- its RESERVED holds to the execution deadline; never extend on every heartbeat
-- and never revive an already released/settled hold.
create or replace function public.align_accepted_media_expiry()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.modality='video' and new.state in ('reserved','streaming')
    and nullif(new.execution_metadata->>'provider_operation_id','') is not null then
    update public.credit_reservations set expires_at=greatest(expires_at,new.created_at+interval '30 minutes')
      where id=new.reservation_id and user_id=new.user_id and operation_key=new.operation_key
        and payload_hash=new.payload_hash and state='reserved';
    update public.model_trial_usages set expires_at=greatest(expires_at,new.created_at+interval '30 minutes')
      where user_id=new.user_id and operation_key=new.operation_key
        and credit_reservation_id=new.reservation_id and state='reserved';
  end if;
  return new;
end;
$$;
do $$ begin
  if not exists(select 1 from pg_catalog.pg_trigger where tgname='ai_executions_media_expiry_alignment'
    and tgrelid='public.ai_executions'::regclass) then
    create trigger ai_executions_media_expiry_alignment after update of execution_metadata on public.ai_executions
    for each row execute function public.align_accepted_media_expiry();
  end if;
end $$;

create or replace function public.claim_media_execution(p_execution_id uuid,p_user_id uuid,p_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if (select auth.role()) is distinct from 'service_role' then raise exception using errcode='42501',message='FORBIDDEN'; end if;
  if p_token is null then raise exception 'INVALID_MEDIA_LEASE'; end if;
  update public.ai_executions set media_lease_token=p_token,media_lease_until=now()+interval '6 minutes'
  where id=p_execution_id and user_id=p_user_id and modality in ('image','video')
    and state in ('reserved','streaming')
    and (media_lease_until is null or media_lease_until<=now())
    and (media_next_check_at is null or media_next_check_at<=now());
  get diagnostics v_count=row_count;
  return v_count=1;
end;
$$;

create or replace function public.checkpoint_media_execution(
  p_execution_id uuid,p_user_id uuid,p_token uuid,p_metadata jsonb,p_delay_seconds integer default 5
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if (select auth.role()) is distinct from 'service_role' then raise exception using errcode='42501',message='FORBIDDEN'; end if;
  if p_delay_seconds is null or p_delay_seconds not between 5 and 1800
    or p_metadata is null or jsonb_typeof(p_metadata)<>'object'
    or octet_length(p_metadata::text)>16000 then raise exception 'INVALID_MEDIA_CHECKPOINT'; end if;
  update public.ai_executions set execution_metadata=execution_metadata || p_metadata,
    media_lease_token=null,media_lease_until=null,media_next_check_at=now()+make_interval(secs=>p_delay_seconds)
  where id=p_execution_id and user_id=p_user_id and media_lease_token=p_token
    and modality in ('image','video') and state in ('reserved','streaming');
  get diagnostics v_count=row_count;
  return v_count=1;
end;
$$;

-- Atomic wrapper around the EXISTING financial and model-trial finalizers.
-- A failed finalizer rolls back both; the next owned status read can retry.
create or replace function public.finalize_media_execution(
  p_execution_id uuid,p_user_id uuid,p_token uuid,p_terminal text,
  p_outcome text,p_provider_status text,p_error text default null,p_provider_cost_minor bigint default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.ai_executions%rowtype;
  r public.credit_reservations%rowtype;
  result jsonb;
  charge bigint := 0;
  meta jsonb;
begin
  if (select auth.role()) is distinct from 'service_role' then raise exception using errcode='42501',message='FORBIDDEN'; end if;
  if p_terminal is null or p_terminal not in ('completed','failed','provider_cancelled')
    or p_outcome is null or p_outcome not in ('completed','failed','abandoned','our_loss')
    or p_provider_status is null or length(p_provider_status)>100
    or (p_terminal='completed')<>(p_outcome='completed')
    then raise exception 'INVALID_MEDIA_OUTCOME'; end if;
  select * into v from public.ai_executions where id=p_execution_id and user_id=p_user_id for update;
  if not found or v.modality not in ('image','video') then raise exception 'EXECUTION_NOT_FOUND'; end if;
  if v.state not in ('reserved','streaming') then
    return jsonb_build_object('state',v.state,'idempotent',true);
  end if;
  if v.media_lease_token is distinct from p_token or p_token is null then raise exception 'MEDIA_LEASE_LOST'; end if;
  select * into r from public.credit_reservations where user_id=p_user_id and operation_key=v.operation_key;
  if r.id is not null and r.payload_hash<>v.payload_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if p_terminal='completed' then
    if p_provider_status not in ('succeeded','completed') or p_outcome<>'completed'
      or coalesce(v.execution_metadata->>'durable_media_saved','false')<>'true'
      or not exists(select 1 from public.generations where id=v.id and user_id=p_user_id
        and type=v.modality and status='completed' and nullif(storage_path,'') is not null)
    then raise exception 'DURABLE_MEDIA_RESULT_REQUIRED'; end if;
    charge := case when r.funding_source in ('free_trial_image','free_trial_video','lite_included_video','customer_free') then 0
      else coalesce((v.media_context->>'customerCharge')::bigint,r.amount,0) end;
  end if;
  meta := v.execution_metadata || jsonb_build_object('provider_status',p_provider_status,
    'outcome',p_outcome,'reconciled_at',now(),
    'latencyMs',greatest(0,extract(epoch from (now()-v.created_at))*1000)::bigint, 'reconciliation_flags',
    case when p_outcome='abandoned' then jsonb_build_array('abandoned')
      when p_outcome='our_loss' then jsonb_build_array('customer_released_provider_succeeded') else '[]'::jsonb end);
  result := public.finalize_ai_execution_terminal(v.id,p_user_id,r.id,v.operation_key,v.payload_hash,
    p_terminal,charge,false,case when p_terminal='completed' then v.modality || '_generated' else null end,
    p_error,case when p_outcome in ('abandoned','our_loss') then 'vantra' when p_terminal<>'completed' then 'provider' else null end,
    case when p_outcome='abandoned' then 'timeout' when p_outcome='our_loss' then 'delivery_failed' else null end,
    meta,p_provider_cost_minor,case when p_provider_cost_minor is not null then 'USD' else null end,
    v.execution_metadata->>'provider_operation_id',coalesce((v.execution_metadata->>'attempt_count')::integer,1));
  perform public.finalize_model_trial_access(p_user_id,v.operation_key,
    case when p_terminal='completed' then 'completed' else 'released' end);
  update public.ai_executions set media_lease_token=null,media_lease_until=null,media_next_check_at=null where id=v.id;
  return result;
end;
$$;

revoke all on function public.guard_active_media_execution() from public,anon,authenticated;
revoke all on function public.align_accepted_media_expiry() from public,anon,authenticated;
revoke all on function public.claim_media_execution(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.checkpoint_media_execution(uuid,uuid,uuid,jsonb,integer) from public,anon,authenticated;
revoke all on function public.finalize_media_execution(uuid,uuid,uuid,text,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.claim_media_execution(uuid,uuid,uuid) to service_role;
grant execute on function public.checkpoint_media_execution(uuid,uuid,uuid,jsonb,integer) to service_role;
grant execute on function public.finalize_media_execution(uuid,uuid,uuid,text,text,text,text,bigint) to service_role;
notify pgrst,'reload schema';
commit;
