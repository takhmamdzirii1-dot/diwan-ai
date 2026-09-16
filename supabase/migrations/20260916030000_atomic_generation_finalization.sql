-- Atomically finalize one existing AI execution with the existing ledger RPCs.
-- Detailed terminal status lives in ai_executions.execution_metadata so the
-- existing execution and financial schemas remain authoritative and unchanged.

begin;

create or replace function public.finalize_ai_execution_terminal(
  p_execution_id uuid,
  p_user_id uuid,
  p_reservation_id uuid,
  p_operation_key text,
  p_payload_hash text,
  p_terminal_status text,
  p_customer_charge bigint,
  p_usage_authoritative boolean default false,
  p_finish_reason text default null,
  p_error_code text default null,
  p_failure_owner text default null,
  p_failure_category text default null,
  p_actual_usage jsonb default '{}'::jsonb,
  p_provider_cost_minor bigint default null,
  p_provider_cost_currency text default null,
  p_provider_operation_id text default null,
  p_attempt_count integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_execution public.ai_executions%rowtype;
  v_reservation public.credit_reservations%rowtype;
  v_execution_state text;
  v_usage_status text;
  v_reserved bigint := 0;
  v_released bigint := 0;
  v_pricing_version text := 'provider-reported';
  v_metadata jsonb;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_execution_id is null or p_user_id is null
    or char_length(btrim(coalesce(p_operation_key, ''))) not between 8 and 200
    or coalesce(p_payload_hash, '') !~ '^[0-9a-f]{64}$'
    or p_terminal_status not in (
      'completed', 'failed', 'partial_failed', 'user_cancelled', 'provider_cancelled'
    )
    or p_customer_charge is null or p_customer_charge < 0
    or p_attempt_count < 0
    or (p_failure_owner is not null and p_failure_owner not in ('customer', 'provider', 'vantra'))
    or ((p_provider_cost_minor is null) <> (p_provider_cost_currency is null))
    or p_provider_cost_minor < 0
    or (p_provider_cost_currency is not null and p_provider_cost_currency !~ '^[A-Z]{3}$')
  then
    raise exception using errcode = '22023', message = 'INVALID_EXECUTION_FINALIZATION';
  end if;
  if p_terminal_status not in ('completed', 'user_cancelled') and p_customer_charge <> 0 then
    raise exception using errcode = '22023', message = 'FAILED_EXECUTION_MUST_NOT_CHARGE';
  end if;
  if p_terminal_status = 'user_cancelled'
    and p_customer_charge > 0 and not p_usage_authoritative
  then
    raise exception using errcode = '22023', message = 'CANCELLED_USAGE_NOT_AUTHORITATIVE';
  end if;

  select * into v_execution
  from public.ai_executions
  where id = p_execution_id and user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'EXECUTION_NOT_FOUND';
  end if;
  if v_execution.operation_key <> p_operation_key
    or v_execution.payload_hash <> p_payload_hash
  then
    raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT';
  end if;
  if v_execution.state not in ('reserved', 'streaming') then
    return jsonb_build_object(
      'execution_id', v_execution.id,
      'state', v_execution.state,
      'terminal_status', v_execution.execution_metadata->>'terminal_status',
      'credits_charged', coalesce(v_execution.credits_charged, 0),
      'idempotent', true
    );
  end if;

  if p_reservation_id is not null then
    select * into v_reservation
    from public.credit_reservations
    where id = p_reservation_id and user_id = p_user_id;

    if not found
      or v_reservation.operation_key <> p_operation_key
      or v_reservation.payload_hash <> p_payload_hash
    then
      raise exception using errcode = '22023', message = 'INVALID_EXECUTION_RESERVATION';
    end if;

    v_reserved := v_reservation.amount;
    v_pricing_version := v_reservation.pricing_version;
    if p_customer_charge > v_reserved then
      raise exception using errcode = '22023', message = 'SETTLEMENT_EXCEEDS_RESERVATION';
    end if;

    if p_customer_charge > 0 then
      perform public.settle_credits(
        p_user_id, p_reservation_id, p_operation_key, p_payload_hash,
        p_customer_charge, coalesce(p_actual_usage, '{}'::jsonb)
      );
    else
      perform public.release_credits(
        p_user_id, p_reservation_id, p_operation_key, p_payload_hash,
        coalesce(nullif(btrim(p_error_code), ''), p_terminal_status)
      );
    end if;
  elsif p_customer_charge <> 0 then
    raise exception using errcode = '22023', message = 'CHARGE_REQUIRES_RESERVATION';
  end if;

  v_released := v_reserved - p_customer_charge;
  v_execution_state := case
    when p_terminal_status = 'completed' then 'completed'
    when p_terminal_status in ('user_cancelled', 'provider_cancelled') then 'cancelled'
    else 'failed'
  end;
  v_usage_status := case
    when p_terminal_status = 'completed' then 'completed'
    when p_terminal_status in ('user_cancelled', 'provider_cancelled') then 'cancelled'
    else 'failed'
  end;

  if p_reservation_id is not null then
    if p_customer_charge > 0 then
      update public.usage_records
      set status = v_usage_status,
          credits_charged = p_customer_charge,
          metadata = coalesce(p_actual_usage, '{}'::jsonb)
      where reservation_id = p_reservation_id;
    else
      insert into public.usage_records (
        user_id, reservation_id, operation_key, modality, model_id,
        status, credits_charged, metadata
      ) values (
        p_user_id, p_reservation_id, p_operation_key, v_execution.modality,
        v_execution.model_id, v_usage_status, 0,
        coalesce(p_actual_usage, '{}'::jsonb)
      ) on conflict (reservation_id) do update set
        status = excluded.status,
        credits_charged = 0,
        metadata = excluded.metadata;
    end if;
  end if;

  if p_provider_cost_minor is not null and p_reservation_id is not null then
    insert into public.provider_cost_records (
      user_id, reservation_id, provider, provider_model, pricing_version,
      actual_cost_minor, currency, credits_charged, execution_metadata
    ) values (
      p_user_id, p_reservation_id, v_execution.provider_id,
      v_execution.provider_model_id, v_pricing_version,
      p_provider_cost_minor, p_provider_cost_currency, p_customer_charge,
      coalesce(p_actual_usage, '{}'::jsonb)
    ) on conflict (reservation_id) do update set
      actual_cost_minor = excluded.actual_cost_minor,
      currency = excluded.currency,
      credits_charged = excluded.credits_charged,
      execution_metadata = excluded.execution_metadata;
  end if;

  update public.provider_attempts
  set state = case
        when p_terminal_status = 'completed' then 'completed'
        when p_terminal_status in ('user_cancelled', 'provider_cancelled') then 'cancelled'
        else 'failed'
      end,
      provider_operation_id = coalesce(
        nullif(btrim(coalesce(p_provider_operation_id, '')), ''), provider_operation_id
      ),
      error_message = case
        when p_terminal_status = 'completed' then null
        else left(coalesce(p_error_code, p_terminal_status), 500)
      end,
      finished_at = now(),
      metadata = metadata || jsonb_build_object(
        'terminal_status', p_terminal_status,
        'customer_credits_charged', p_customer_charge,
        'provider_cost_minor', p_provider_cost_minor,
        'provider_cost_currency', p_provider_cost_currency
      )
  where outbox_id in (
    select id from public.provider_dispatch_outbox
    where reservation_id = p_reservation_id
  ) and state in ('started', 'submitted', 'unknown');

  update public.provider_dispatch_outbox
  set state = case
        when p_terminal_status = 'completed' then 'completed'
        when p_terminal_status in ('user_cancelled', 'provider_cancelled') then 'cancelled'
        else 'failed'
      end,
      last_error = case
        when p_terminal_status = 'completed' then null
        else left(coalesce(p_error_code, p_terminal_status), 500)
      end
  where reservation_id = p_reservation_id
    and state in ('pending', 'leased', 'dispatched');

  v_metadata := coalesce(p_actual_usage, '{}'::jsonb) || jsonb_build_object(
    'terminal_status', p_terminal_status,
    'credits_reserved', v_reserved,
    'credits_charged', p_customer_charge,
    'credits_released', v_released,
    'provider_cost_minor', p_provider_cost_minor,
    'provider_cost_currency', p_provider_cost_currency,
    'failure_owner', p_failure_owner,
    'failure_category', p_failure_category,
    'provider_operation_id', p_provider_operation_id,
    'attempt_count', p_attempt_count
  );

  update public.ai_executions
  set state = v_execution_state,
      reservation_id = p_reservation_id,
      credits_charged = p_customer_charge,
      finish_reason = left(p_finish_reason, 100),
      error_code = left(p_error_code, 120),
      execution_metadata = v_metadata,
      completed_at = now()
  where id = p_execution_id;

  return jsonb_build_object(
    'execution_id', p_execution_id,
    'state', v_execution_state,
    'terminal_status', p_terminal_status,
    'credits_reserved', v_reserved,
    'credits_charged', p_customer_charge,
    'credits_released', v_released,
    'idempotent', false
  );
end;
$$;

revoke all on function public.finalize_ai_execution_terminal(
  uuid,uuid,uuid,text,text,text,bigint,boolean,text,text,text,text,jsonb,bigint,text,text,integer
) from public, anon, authenticated;
grant execute on function public.finalize_ai_execution_terminal(
  uuid,uuid,uuid,text,text,text,bigint,boolean,text,text,text,text,jsonb,bigint,text,text,integer
) to service_role;

commit;
