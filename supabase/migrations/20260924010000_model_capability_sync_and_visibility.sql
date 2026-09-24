begin;

alter table public.model_runtime_configs
  add column if not exists capability_source_type text not null default 'unknown',
  add column if not exists capability_confidence text not null default 'unknown',
  add column if not exists capability_sync_status text not null default 'partial',
  add column if not exists capability_sync_error text,
  add column if not exists capability_last_synced_at timestamptz,
  add column if not exists surface_visibility jsonb not null default '{}'::jsonb;

alter table public.model_runtime_configs
  add constraint model_capability_source_type_valid check (capability_source_type in ('admin_override','provider_metadata','adapter_inferred','unknown')),
  add constraint model_capability_confidence_valid check (capability_confidence in ('verified','partial','manual','unknown')),
  add constraint model_capability_sync_status_valid check (capability_sync_status in ('ok','partial','failed')),
  add constraint model_surface_visibility_object check (jsonb_typeof(surface_visibility) = 'object');

-- Preserve the existing model audit trigger while extending its immutable
-- before/after snapshot with capability provenance and per-surface visibility.
create or replace function public.audit_model_runtime_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := case when tg_op = 'INSERT' then new.updated_by else coalesce(new.updated_by, old.updated_by) end;
begin
  if v_actor is not null then
    perform public.write_admin_audit(
      v_actor,
      case when tg_op = 'INSERT' then 'model_runtime_created' else 'model_runtime_updated' end,
      'model', new.model_key,
      case when tg_op = 'INSERT' then null else jsonb_build_object(
        'enabled', old.enabled, 'routing_role', old.routing_role,
        'customer_credit_price', old.customer_credit_price,
        'allowed_plans', old.allowed_plans,
        'display_name', old.customer_display_name, 'studio_visible', old.studio_visible,
        'sort_order', old.customer_sort_order, 'availability_label', old.customer_availability_label,
        'capabilities', old.capabilities, 'surface_visibility', old.surface_visibility,
        'capability_source_type', old.capability_source_type,
        'capability_confidence', old.capability_confidence,
        'capability_sync_status', old.capability_sync_status
      ) end,
      jsonb_build_object(
        'enabled', new.enabled, 'routing_role', new.routing_role,
        'customer_credit_price', new.customer_credit_price,
        'allowed_plans', new.allowed_plans,
        'display_name', new.customer_display_name, 'studio_visible', new.studio_visible,
        'sort_order', new.customer_sort_order, 'availability_label', new.customer_availability_label,
        'capabilities', new.capabilities, 'surface_visibility', new.surface_visibility,
        'capability_source_type', new.capability_source_type,
        'capability_confidence', new.capability_confidence,
        'capability_sync_status', new.capability_sync_status
      )
    );
  end if;
  return new;
end;
$$;

-- Existing verified and manually seeded profiles stay in place. Unknown
-- provenance is deliberate: a sync must not claim provider verification.

-- A media execution cannot settle as successful unless its durable result is
-- already recorded. The terminal RPC and its ledger writes share a transaction;
-- this trigger rolls all of them back if the output is missing.
create or replace function public.require_media_result_before_settlement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.state = 'completed' and old.state is distinct from 'completed'
    and new.modality in ('image', 'video')
    and not exists (
      select 1 from public.generations g
      where g.id = new.id and g.user_id = new.user_id
        and g.type = new.modality and g.status = 'completed'
        and nullif(btrim(g.storage_path), '') is not null
    )
  then
    raise exception using errcode = '23514', message = 'MEDIA_RESULT_REQUIRED_FOR_SETTLEMENT';
  end if;
  return new;
end;
$$;

drop trigger if exists ai_execution_media_result_guard on public.ai_executions;
create trigger ai_execution_media_result_guard before update of state on public.ai_executions
for each row execute function public.require_media_result_before_settlement();

create or replace function public.begin_provider_execution_attempt(
  p_execution_id uuid, p_user_id uuid, p_reservation_id uuid,
  p_route_key text, p_provider_id text, p_attempt_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_execution public.ai_executions%rowtype;
  v_outbox public.provider_dispatch_outbox%rowtype;
  v_attempt public.provider_attempts%rowtype;
  v_number integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_execution_id is null or p_user_id is null or p_reservation_id is null
    or nullif(btrim(coalesce(p_provider_id,'')), '') is null
    or char_length(coalesce(p_attempt_key,'')) not between 8 and 200 then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_ATTEMPT';
  end if;
  select * into v_execution from public.ai_executions
    where id = p_execution_id and user_id = p_user_id for update;
  if not found or v_execution.state <> 'streaming'
    or v_execution.reservation_id <> p_reservation_id
    or v_execution.provider_id <> p_provider_id then
    raise exception using errcode = '22023', message = 'INVALID_EXECUTION_ATTEMPT_STATE';
  end if;
  insert into public.provider_dispatch_outbox (
    reservation_id, user_id, modality, model_id, route_key, state
  ) values (
    p_reservation_id, p_user_id, v_execution.modality, v_execution.model_id,
    p_route_key, 'dispatched'
  ) on conflict (reservation_id) do nothing;
  select * into v_outbox from public.provider_dispatch_outbox
    where reservation_id = p_reservation_id for update;
  select * into v_attempt from public.provider_attempts
    where outbox_id = v_outbox.id and metadata->>'attempt_key' = p_attempt_key;
  if found then
    return jsonb_build_object('attempt_id',v_attempt.id,'attempt_number',v_attempt.attempt_number,'idempotent',true);
  end if;
  select coalesce(max(attempt_number),0)+1 into v_number from public.provider_attempts
    where outbox_id = v_outbox.id;
  insert into public.provider_attempts (
    outbox_id, attempt_number, fencing_token, provider, state, metadata
  ) values (
    v_outbox.id, v_number, v_outbox.lease_epoch, p_provider_id, 'started',
    jsonb_build_object('attempt_key',p_attempt_key)
  ) returning * into v_attempt;
  update public.provider_dispatch_outbox set attempt_count = v_number,
    state = 'dispatched' where id = v_outbox.id;
  return jsonb_build_object('attempt_id',v_attempt.id,'attempt_number',v_number,'idempotent',false);
end;
$$;

revoke all on function public.begin_provider_execution_attempt(uuid,uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.begin_provider_execution_attempt(uuid,uuid,uuid,text,text,text) to service_role;

-- Reconcile a late provider invoice without changing the customer's immutable
-- settlement. Repeated identical reports are safe; conflicting amounts fail.
create or replace function public.record_late_provider_cost(
  p_execution_id uuid, p_actual_cost_minor bigint, p_currency text,
  p_provider_status text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_execution public.ai_executions%rowtype;
  v_reservation public.credit_reservations%rowtype;
  v_cost public.provider_cost_records%rowtype;
  v_flags jsonb;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_execution_id is null or p_actual_cost_minor is null or p_actual_cost_minor < 0
    or p_currency !~ '^[A-Z]{3}$'
    or char_length(coalesce(p_provider_status, '')) > 100 then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_COST';
  end if;
  select * into v_execution from public.ai_executions
    where id = p_execution_id for update;
  if not found or v_execution.state not in ('completed', 'failed', 'cancelled')
    or v_execution.reservation_id is null then
    raise exception using errcode = '22023', message = 'EXECUTION_NOT_RECONCILABLE';
  end if;
  select * into v_reservation from public.credit_reservations
    where id = v_execution.reservation_id and user_id = v_execution.user_id;
  if not found then
    raise exception using errcode = '22023', message = 'RESERVATION_NOT_FOUND';
  end if;
  select * into v_cost from public.provider_cost_records
    where reservation_id = v_reservation.id for update;
  if found and v_cost.actual_cost_minor is not null
    and (v_cost.actual_cost_minor <> p_actual_cost_minor or v_cost.currency <> p_currency) then
    raise exception using errcode = '22023', message = 'PROVIDER_COST_CONFLICT';
  end if;
  insert into public.provider_cost_records (
    user_id, reservation_id, provider, provider_model, pricing_version,
    actual_cost_minor, currency, credits_charged, execution_metadata
  ) values (
    v_execution.user_id, v_reservation.id, v_execution.provider_id,
    v_execution.provider_model_id, v_reservation.pricing_version,
    p_actual_cost_minor, p_currency, coalesce(v_execution.credits_charged, 0),
    jsonb_build_object('reconciled_late', true)
  ) on conflict (reservation_id) do update set
    actual_cost_minor = excluded.actual_cost_minor,
    currency = excluded.currency,
    execution_metadata = public.provider_cost_records.execution_metadata || jsonb_build_object('reconciled_late', true)
    where public.provider_cost_records.actual_cost_minor is null;
  v_flags := coalesce(v_execution.execution_metadata->'reconciliation_flags', '[]'::jsonb);
  if jsonb_typeof(v_flags) <> 'array' then v_flags := '[]'::jsonb; end if;
  if v_execution.state <> 'completed' and not (v_flags ? 'cost_without_success') then
    v_flags := v_flags || '"cost_without_success"'::jsonb;
  end if;
  if v_execution.state <> 'completed' and lower(coalesce(p_provider_status, '')) in ('completed','succeeded','success')
    and not (v_flags ? 'mismatched_terminal_state') then
    v_flags := v_flags || '"mismatched_terminal_state"'::jsonb;
  end if;
  update public.ai_executions set execution_metadata =
    coalesce(execution_metadata, '{}'::jsonb) || jsonb_build_object(
      'provider_cost_minor', p_actual_cost_minor, 'provider_cost_currency', p_currency,
      'reconciliation_flags', v_flags,
      'provider_status', coalesce(p_provider_status, execution_metadata->>'provider_status')
    ) where id = p_execution_id;
  return jsonb_build_object('execution_id', p_execution_id,
    'customer_credits_charged', coalesce(v_execution.credits_charged, 0),
    'provider_cost_minor', p_actual_cost_minor, 'reconciliation_flags', v_flags);
end;
$$;

revoke all on function public.record_late_provider_cost(uuid,bigint,text,text) from public, anon, authenticated;
grant execute on function public.record_late_provider_cost(uuid,bigint,text,text) to service_role;

commit;
