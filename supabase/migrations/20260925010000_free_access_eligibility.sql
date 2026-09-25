-- Free eligibility is independent of paid entitlements and of one-time media counters.
-- This migration is forward-only and does not refill or rewrite existing balances.
begin;

create table public.free_access_eligibility (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state text not null default 'eligible' check (state in ('eligible','review_required','ineligible','manually_approved')),
  reason_code text,
  evidence jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.free_access_eligibility enable row level security;
revoke all on public.free_access_eligibility from public, anon, authenticated;
grant select, insert, update on public.free_access_eligibility to service_role;

-- Only a repeated first-party account email alias prompts review. Network/IP
-- never establishes identity. A manual approval is never automatically changed.
create or replace function public.assess_free_access(p_user_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_state text;
  v_email text;
  v_alias text;
  v_matches integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  select lower(email) into v_email from auth.users where id = p_user_id;
  if not found then raise exception using errcode = 'P0002', message = 'USER_NOT_FOUND'; end if;
  insert into public.free_access_eligibility(user_id) values (p_user_id)
    on conflict (user_id) do nothing;
  select state into v_state from public.free_access_eligibility
    where user_id = p_user_id for update;
  if v_state <> 'eligible' or v_email is null or position('@' in v_email) = 0 then
    return v_state;
  end if;
  v_alias := split_part(split_part(v_email, '@', 1), '+', 1) || '@' || split_part(v_email, '@', 2);
  select count(*) into v_matches from auth.users other
    where other.id <> p_user_id and other.email is not null
      and lower(split_part(split_part(other.email, '@', 1), '+', 1) || '@' || split_part(other.email, '@', 2)) = v_alias;
  if v_matches > 0 then
    update public.free_access_eligibility set state = 'review_required',
      reason_code = 'repeated_email_alias',
      evidence = jsonb_build_object('signal','first_party_email_alias','matching_accounts',v_matches),
      updated_at = now() where user_id = p_user_id;
    insert into public.admin_audit_log(action,resource_type,resource_id,previous_state,new_state,metadata)
      values ('free_account_sent_to_review','user',p_user_id::text,
        '{"state":"eligible"}'::jsonb,'{"state":"review_required"}'::jsonb,
        jsonb_build_object('reason','repeated_email_alias','matching_accounts',v_matches));
    return 'review_required';
  end if;
  return v_state;
end;
$$;
revoke all on function public.assess_free_access(uuid) from public, anon, authenticated;
grant execute on function public.assess_free_access(uuid) to service_role;

create or replace function public.free_access_execution_allowed(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_state text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if exists (
    select 1 from public.user_entitlements e
    join public.payment_plans p on p.id = e.plan_id
    where e.user_id = p_user_id and e.status = 'active'
      and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
      and p.plan_code in ('lite','pro','max')
  ) then return true; end if;
  v_state := public.assess_free_access(p_user_id);
  return v_state in ('eligible','manually_approved');
end;
$$;
revoke all on function public.free_access_execution_allowed(uuid) from public, anon, authenticated;
grant execute on function public.free_access_execution_allowed(uuid) to service_role;

-- Defense in depth for every Free reservation path, including direct RPC use.
create or replace function public.guard_free_execution()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_free boolean;
begin
  if tg_table_name = 'credit_reservations' then
    v_free := new.funding_source in ('free_trial_image','free_trial_video');
  else
    v_free := new.plan_code = 'free';
  end if;
  if v_free then
    if not public.free_access_execution_allowed(new.user_id) then
      raise exception using errcode = 'P0001', message = 'FREE_ACCESS_RESTRICTED';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists credit_reservation_free_media_expiry on public.credit_reservations;
drop function if exists public.enforce_free_media_trial_expiry();
-- Preserve the latest trial reservation function and remove only its obsolete
-- seven-day branch. Abort if the deployed definition differs unexpectedly.
do $remove_free_expiry$
declare v_before text; v_after text;
begin
  select pg_get_functiondef('public.reserve_model_trial_access(uuid,text,text,text,text,text,uuid)'::regprocedure)
    into v_before;
  if v_before is null or position('FREE_MEDIA_EXPIRED' in v_before) = 0 then
    raise exception 'MODEL_TRIAL_FUNCTION_UNEXPECTED';
  end if;
  v_after := replace(v_before,
    $branch$    if p_modality in ('image','video') and now() >= v_user_created_at + interval '7 days' then
      raise exception using errcode = 'P0001', message = 'FREE_MEDIA_EXPIRED';
    end if;
$branch$, '');
  if v_after = v_before or position('FREE_MEDIA_EXPIRED' in v_after) > 0 then
    raise exception 'MODEL_TRIAL_EXPIRY_REMOVAL_FAILED';
  end if;
  execute v_after;
end;
$remove_free_expiry$;
drop trigger if exists credit_reservation_free_access_guard on public.credit_reservations;
create trigger credit_reservation_free_access_guard before insert on public.credit_reservations
  for each row execute function public.guard_free_execution();
create trigger chat_usage_free_access_guard before insert on public.chat_usage_records
  for each row execute function public.guard_free_execution();
create trigger model_trial_free_access_guard before insert on public.model_trial_usages
  for each row execute function public.guard_free_execution();

-- Admin changes and their audit entry commit atomically. Counters are untouched.
create or replace function public.set_free_access_eligibility(
  p_user_id uuid, p_state text, p_actor_user_id uuid, p_reason text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old public.free_access_eligibility%rowtype;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_state not in ('eligible','review_required','ineligible','manually_approved')
    or char_length(btrim(coalesce(p_reason,''))) not between 3 and 500
    or p_actor_user_id is null or p_user_id is null then
    raise exception using errcode = '22023', message = 'INVALID_FREE_ACCESS_CHANGE';
  end if;
  insert into public.free_access_eligibility(user_id) values (p_user_id)
    on conflict (user_id) do nothing;
  select * into v_old from public.free_access_eligibility
    where user_id = p_user_id for update;
  update public.free_access_eligibility set state = p_state,
    reason_code = 'admin_override',
    evidence = jsonb_build_object('reason',btrim(p_reason)),
    updated_by = p_actor_user_id, updated_at = now()
    where user_id = p_user_id;
  insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,previous_state,new_state,metadata)
    values (p_actor_user_id,'free_eligibility_manually_overridden','user',p_user_id::text,
      jsonb_build_object('state',v_old.state,'reason_code',v_old.reason_code),
      jsonb_build_object('state',p_state,'reason_code','admin_override'),
      jsonb_build_object('reason',btrim(p_reason)));
  return jsonb_build_object('state',p_state,'previous_state',v_old.state);
end;
$$;
revoke all on function public.set_free_access_eligibility(uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.set_free_access_eligibility(uuid,text,uuid,text) to service_role;

-- The approved order is authoritative. Alert insertion is part of that same
-- transaction, so failed payment approval never produces a conversion event.
create unique index admin_flagged_paid_order_once on public.admin_audit_log
  ((metadata->>'payment_order_id')) where action = 'flagged_free_account_converted_to_paid';
create or replace function public.alert_flagged_free_paid_conversion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_state text; v_plan text;
begin
  if new.status <> 'approved' or old.status = 'approved' or new.order_kind <> 'subscription' then
    return new;
  end if;
  v_plan := new.entitlement->>'plan_code';
  if v_plan not in ('lite','pro','max') then return new; end if;
  if exists (
    select 1 from public.user_entitlements e
    join public.payment_plans p on p.id = e.plan_id
    where e.user_id = new.user_id and e.source_payment_order_id is distinct from new.id
      and e.status = 'active' and e.starts_at <= now()
      and (e.ends_at is null or e.ends_at > now())
      and p.plan_code in ('lite','pro','max')
  ) then return new; end if;
  select state into v_state from public.free_access_eligibility where user_id = new.user_id;
  if v_state in ('review_required','ineligible') then
    insert into public.admin_audit_log(action,resource_type,resource_id,previous_state,new_state,metadata)
      values ('flagged_free_account_converted_to_paid','user',new.user_id::text,
        jsonb_build_object('free_eligibility',v_state),
        jsonb_build_object('paid_plan',v_plan),
        jsonb_build_object('user_id',new.user_id,'plan',v_plan,
          'payment_order_id',new.id,'timestamp',now(),'previous_eligibility_state',v_state))
      on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger payment_flagged_free_conversion after update of status on public.payment_orders
  for each row execute function public.alert_flagged_free_paid_conversion();

commit;
