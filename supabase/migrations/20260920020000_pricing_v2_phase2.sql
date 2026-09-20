-- Pricing V2, phase 2: clean pre-launch reset plus atomic media allowances
-- and split subscription/purchased credit accounting.

begin;

lock table public.credits in share row exclusive mode;
lock table public.credit_reservations in share row exclusive mode;
lock table public.payment_orders in share row exclusive mode;
lock table public.user_entitlements in share row exclusive mode;

alter table public.credits
  add column if not exists subscription_balance bigint not null default 0,
  add column if not exists subscription_rollover_balance bigint not null default 0,
  add column if not exists purchased_balance bigint not null default 0,
  add column if not exists subscription_plan_code text,
  add column if not exists subscription_entitlement_id uuid references public.user_entitlements(id) on delete set null,
  add column if not exists subscription_period_ends_at timestamptz,
  add column if not exists free_image_remaining smallint not null default 5,
  add column if not exists free_video_remaining smallint not null default 1,
  add column if not exists lite_video_remaining smallint not null default 0,
  add column if not exists lite_video_entitlement_id uuid references public.user_entitlements(id) on delete set null;

alter table public.credits
  drop constraint if exists credits_bucket_values_valid,
  add constraint credits_bucket_values_valid check (
    subscription_balance >= 0
    and subscription_rollover_balance between 0 and subscription_balance
    and purchased_balance >= 0
    and free_image_remaining between 0 and 5
    and free_video_remaining between 0 and 1
    and lite_video_remaining between 0 and 4
    and (subscription_plan_code is null or subscription_plan_code in ('lite', 'pro', 'max'))
  );

-- Preserve an explicit audit trail for the approved pre-launch reset. No old
-- pooled amount is reclassified into a production bucket.
insert into public.credit_transactions (
  user_id, transaction_type, amount, balance_after,
  idempotency_key, payload_hash, reason, metadata
)
select
  account.user_id, 'adjustment', -account.balance, 0,
  'pricing-v2-prelaunch-reset',
  encode(sha256(('pricing-v2-prelaunch-reset:' || account.user_id::text)::bytea), 'hex'),
  'prelaunch_test_balance_reset',
  jsonb_build_object('migration', '20260920020000', 'test_data', true)
from public.credits account
where account.balance <> 0
on conflict (user_id, transaction_type, idempotency_key) do nothing;

-- In-flight records belong to the pre-launch test state. Expiring them prevents
-- a later retry from restoring a reset pooled balance.
update public.credit_reservations
set state = 'expired'
where state = 'reserved';

update public.user_entitlements
set status = 'expired',
    ends_at = least(coalesce(ends_at, now()), now())
where status = 'active';

update public.credits
set balance = 0,
    subscription_balance = 0,
    subscription_rollover_balance = 0,
    purchased_balance = 0,
    subscription_plan_code = null,
    subscription_entitlement_id = null,
    subscription_period_ends_at = null,
    free_image_remaining = 5,
    free_video_remaining = 1,
    lite_video_remaining = 0,
    lite_video_entitlement_id = null,
    updated_at = now();

alter table public.credits
  drop constraint if exists credits_balance_matches_buckets,
  add constraint credits_balance_matches_buckets
    check (balance = subscription_balance + purchased_balance);

alter table public.credit_reservations
  add column if not exists funding_source text not null default 'prelaunch_test',
  add column if not exists subscription_amount bigint not null default 0,
  add column if not exists subscription_rollover_amount bigint not null default 0,
  add column if not exists purchased_amount bigint not null default 0,
  add column if not exists allowance_entitlement_id uuid references public.user_entitlements(id) on delete set null;

alter table public.credit_reservations
  drop constraint if exists credit_reservations_amount_check,
  add constraint credit_reservations_amount_check check (amount >= 0),
  drop constraint if exists credit_reservations_funding_valid,
  add constraint credit_reservations_funding_valid check (
    subscription_amount >= 0
    and subscription_rollover_amount between 0 and subscription_amount
    and purchased_amount >= 0
    and funding_source in (
      'credits', 'free_trial_image', 'free_trial_video',
      'lite_included_video', 'customer_free', 'prelaunch_test'
    )
    and (
      (funding_source = 'credits'
        and amount > 0
        and subscription_amount + purchased_amount = amount)
      or (funding_source in (
          'free_trial_image', 'free_trial_video', 'lite_included_video', 'customer_free'
        ) and amount = 0 and subscription_amount = 0 and purchased_amount = 0)
      or (funding_source = 'prelaunch_test'
        and subscription_amount = 0 and purchased_amount = 0)
    )
  );

create or replace function public.enforce_credit_reservation_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.user_id <> new.user_id
    or old.operation_key <> new.operation_key
    or old.payload_hash <> new.payload_hash
    or old.modality <> new.modality
    or old.model_id <> new.model_id
    or old.amount <> new.amount
    or old.pricing_version <> new.pricing_version
    or old.pricing_snapshot <> new.pricing_snapshot
    or old.route_snapshot is distinct from new.route_snapshot
    or old.funding_source <> new.funding_source
    or old.subscription_amount <> new.subscription_amount
    or old.subscription_rollover_amount <> new.subscription_rollover_amount
    or old.purchased_amount <> new.purchased_amount
    or old.allowance_entitlement_id is distinct from new.allowance_entitlement_id
    or old.created_at <> new.created_at
  then
    raise exception using errcode = '22023', message = 'RESERVATION_IMMUTABLE_FIELDS';
  end if;

  if old.state <> new.state and not (
    old.state = 'reserved' and new.state in ('settled', 'released', 'expired')
  ) then
    raise exception using errcode = '22023', message = 'INVALID_RESERVATION_TRANSITION';
  end if;
  return new;
end;
$$;

create or replace function public.reserve_credits(
  p_user_id uuid,
  p_operation_key text,
  p_payload_hash text,
  p_modality text,
  p_model_id text,
  p_amount bigint,
  p_pricing_version text,
  p_pricing_snapshot jsonb,
  p_route_snapshot jsonb default null,
  p_expires_at timestamptz default (now() + interval '15 minutes')
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.credits%rowtype;
  v_reservation public.credit_reservations%rowtype;
  v_plan_code text;
  v_entitlement_id uuid;
  v_funding_source text := 'credits';
  v_subscription_amount bigint := 0;
  v_subscription_rollover_amount bigint := 0;
  v_purchased_amount bigint := 0;
  v_expired_amount bigint := 0;
  v_expired_entitlement_id uuid;
begin
  if p_user_id is null
    or char_length(btrim(coalesce(p_operation_key, ''))) = 0
    or char_length(p_operation_key) > 200
    or coalesce(p_payload_hash, '') !~ '^[0-9a-f]{64}$'
    or p_modality not in ('chat', 'image', 'video')
    or char_length(btrim(coalesce(p_model_id, ''))) = 0
    or p_amount is null or p_amount < 0
    or char_length(btrim(coalesce(p_pricing_version, ''))) = 0
    or p_pricing_snapshot is null
    or p_expires_at <= now()
  then
    raise exception using errcode = '22023', message = 'INVALID_RESERVATION_REQUEST';
  end if;

  select * into v_account from public.credits where user_id = p_user_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'CREDIT_ACCOUNT_NOT_FOUND'; end if;

  select * into v_reservation from public.credit_reservations
  where user_id = p_user_id and operation_key = p_operation_key;
  if found then
    if v_reservation.payload_hash <> p_payload_hash
      or v_reservation.modality <> p_modality
      or v_reservation.model_id <> p_model_id
      or v_reservation.pricing_version <> p_pricing_version
      or v_reservation.pricing_snapshot <> p_pricing_snapshot
      or v_reservation.route_snapshot is distinct from p_route_snapshot
    then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'reservation_id', v_reservation.id, 'state', v_reservation.state,
      'amount', v_reservation.amount,
      'customer_charge', case when v_reservation.funding_source = 'credits' then v_reservation.amount else 0 end,
      'funding_source', v_reservation.funding_source,
      'balance', v_account.balance, 'idempotent', true
    );
  end if;

  if v_account.subscription_balance > 0
    and v_account.subscription_period_ends_at is not null
    and v_account.subscription_period_ends_at <= now()
  then
    v_expired_amount := v_account.subscription_balance;
    v_expired_entitlement_id := v_account.subscription_entitlement_id;
    update public.credits set
      subscription_balance = 0, subscription_rollover_balance = 0,
      balance = purchased_balance, subscription_plan_code = null,
      subscription_entitlement_id = null, subscription_period_ends_at = null,
      lite_video_remaining = 0, lite_video_entitlement_id = null,
      updated_at = now()
    where user_id = p_user_id returning * into v_account;
    insert into public.credit_transactions (
      user_id, transaction_type, amount, balance_after,
      idempotency_key, payload_hash, reason, metadata
    ) values (
      p_user_id, 'adjustment', -v_expired_amount, v_account.balance,
      'subscription-expired:' || coalesce(v_expired_entitlement_id::text, 'unknown'),
      encode(sha256(('subscription-expired:' || p_user_id::text || ':' ||
        coalesce(v_expired_entitlement_id::text, 'unknown'))::bytea), 'hex'),
      'subscription_period_expired', jsonb_build_object('source_bucket', 'subscription')
    ) on conflict (user_id, transaction_type, idempotency_key) do nothing;
  end if;

  select plan.plan_code, entitlement.id into v_plan_code, v_entitlement_id
  from public.user_entitlements entitlement
  join public.payment_plans plan on plan.id = entitlement.plan_id
  where entitlement.user_id = p_user_id
    and entitlement.status = 'active'
    and (entitlement.ends_at is null or entitlement.ends_at > now())
    and plan.plan_code in ('lite', 'pro', 'max')
  order by entitlement.starts_at desc, entitlement.created_at desc
  limit 1;

  if p_modality in ('image', 'video') and v_plan_code is null then
    if p_modality = 'image' then
      if v_account.free_image_remaining <= 0 then
        raise exception using errcode = 'P0001', message = 'FREE_IMAGE_TRIAL_EXHAUSTED';
      end if;
      update public.credits set free_image_remaining = free_image_remaining - 1, updated_at = now()
      where user_id = p_user_id returning * into v_account;
      v_funding_source := 'free_trial_image';
    else
      if v_account.free_video_remaining <= 0 then
        raise exception using errcode = 'P0001', message = 'FREE_VIDEO_TRIAL_EXHAUSTED';
      end if;
      update public.credits set free_video_remaining = free_video_remaining - 1, updated_at = now()
      where user_id = p_user_id returning * into v_account;
      v_funding_source := 'free_trial_video';
    end if;
  elsif p_modality = 'video' and v_plan_code = 'lite' then
    if v_account.lite_video_entitlement_id is distinct from v_entitlement_id
      or v_account.lite_video_remaining <= 0
    then
      raise exception using errcode = 'P0001', message = 'LITE_VIDEO_ALLOWANCE_EXHAUSTED';
    end if;
    update public.credits set lite_video_remaining = lite_video_remaining - 1, updated_at = now()
    where user_id = p_user_id returning * into v_account;
    v_funding_source := 'lite_included_video';
  elsif p_amount = 0 then
    v_funding_source := 'customer_free';
  else
    if p_modality in ('image', 'video') and v_plan_code not in ('lite', 'pro', 'max') then
      raise exception using errcode = 'P0001', message = 'PAID_MEDIA_ACCESS_REQUIRED';
    end if;
    if v_account.balance < p_amount then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_CREDITS';
    end if;
    v_subscription_amount := least(v_account.subscription_balance, p_amount);
    v_subscription_rollover_amount := least(
      v_account.subscription_rollover_balance, v_subscription_amount
    );
    v_purchased_amount := p_amount - v_subscription_amount;
    update public.credits set
      subscription_balance = subscription_balance - v_subscription_amount,
      subscription_rollover_balance = subscription_rollover_balance - v_subscription_rollover_amount,
      purchased_balance = purchased_balance - v_purchased_amount,
      balance = balance - p_amount,
      updated_at = now()
    where user_id = p_user_id returning * into v_account;
  end if;

  insert into public.credit_reservations (
    user_id, operation_key, payload_hash, modality, model_id, amount,
    pricing_version, pricing_snapshot, route_snapshot, expires_at,
    funding_source, subscription_amount, subscription_rollover_amount,
    purchased_amount, allowance_entitlement_id
  ) values (
    p_user_id, p_operation_key, p_payload_hash, p_modality, p_model_id,
    case when v_funding_source = 'credits' then p_amount else 0 end,
    p_pricing_version, p_pricing_snapshot, p_route_snapshot, p_expires_at,
    v_funding_source, v_subscription_amount, v_subscription_rollover_amount,
    v_purchased_amount, v_entitlement_id
  ) returning * into v_reservation;

  insert into public.credit_transactions (
    user_id, reservation_id, transaction_type, amount, balance_after,
    idempotency_key, payload_hash, reason, metadata
  ) values (
    p_user_id, v_reservation.id, 'reserve', -v_reservation.amount, v_account.balance,
    p_operation_key, p_payload_hash, 'credit_reservation',
    jsonb_build_object(
      'funding_source', v_funding_source,
      'subscription_amount', v_subscription_amount,
      'purchased_amount', v_purchased_amount
    )
  );

  return jsonb_build_object(
    'reservation_id', v_reservation.id, 'state', v_reservation.state,
    'amount', v_reservation.amount,
    'customer_charge', case when v_funding_source = 'credits' then p_amount else 0 end,
    'funding_source', v_funding_source,
    'balance', v_account.balance, 'idempotent', false
  );
end;
$$;

create or replace function public.settle_credits(
  p_user_id uuid, p_reservation_id uuid, p_operation_key text,
  p_payload_hash text, p_actual_amount bigint,
  p_usage_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.credits%rowtype;
  v_reservation public.credit_reservations%rowtype;
  v_existing public.credit_transactions%rowtype;
  v_actual_subscription bigint := 0;
  v_actual_purchased bigint := 0;
  v_actual_rollover bigint := 0;
  v_refund_subscription bigint := 0;
  v_refund_purchased bigint := 0;
  v_refund_rollover bigint := 0;
  v_refund bigint := 0;
begin
  if p_user_id is null or p_reservation_id is null
    or char_length(btrim(coalesce(p_operation_key, ''))) not between 1 and 200
    or coalesce(p_payload_hash, '') !~ '^[0-9a-f]{64}$'
    or p_actual_amount is null or p_actual_amount < 0
  then raise exception using errcode = '22023', message = 'INVALID_SETTLEMENT_REQUEST'; end if;

  select * into v_account from public.credits where user_id = p_user_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'CREDIT_ACCOUNT_NOT_FOUND'; end if;
  select * into v_existing from public.credit_transactions
  where user_id = p_user_id and transaction_type = 'settle' and idempotency_key = p_operation_key;
  if found then
    if v_existing.reservation_id <> p_reservation_id
      or v_existing.payload_hash <> p_payload_hash
      or (v_existing.metadata->>'charged_amount')::bigint <> p_actual_amount
    then raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object(
      'reservation_id', p_reservation_id, 'state', 'settled',
      'balance', v_account.balance, 'balance_delta', v_existing.amount, 'idempotent', true
    );
  end if;

  select * into v_reservation from public.credit_reservations
  where id = p_reservation_id and user_id = p_user_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'RESERVATION_NOT_FOUND'; end if;
  if v_reservation.state <> 'reserved' then
    raise exception using errcode = '22023', message = 'RESERVATION_ALREADY_FINALIZED';
  end if;
  if p_actual_amount > v_reservation.amount
    or (v_reservation.funding_source <> 'credits' and p_actual_amount <> 0)
  then raise exception using errcode = '22023', message = 'SETTLEMENT_EXCEEDS_RESERVATION'; end if;

  if v_reservation.funding_source = 'credits' then
    v_actual_subscription := least(v_reservation.subscription_amount, p_actual_amount);
    v_actual_rollover := least(v_reservation.subscription_rollover_amount, v_actual_subscription);
    v_actual_purchased := p_actual_amount - v_actual_subscription;
    v_refund_subscription := v_reservation.subscription_amount - v_actual_subscription;
    v_refund_rollover := v_reservation.subscription_rollover_amount - v_actual_rollover;
    v_refund_purchased := v_reservation.purchased_amount - v_actual_purchased;
    if v_refund_subscription > 0 and (
      v_account.subscription_entitlement_id is distinct from v_reservation.allowance_entitlement_id
      or (v_account.subscription_period_ends_at is not null and v_account.subscription_period_ends_at <= now())
    ) then
      v_refund_subscription := 0;
      v_refund_rollover := 0;
    end if;
    update public.credits set
      subscription_balance = subscription_balance + v_refund_subscription,
      subscription_rollover_balance = subscription_rollover_balance + v_refund_rollover,
      purchased_balance = purchased_balance + v_refund_purchased,
      balance = balance + v_refund_subscription + v_refund_purchased,
      updated_at = now()
    where user_id = p_user_id returning * into v_account;
    v_refund := v_refund_subscription + v_refund_purchased;
  end if;

  update public.credit_reservations set state = 'settled', settled_amount = p_actual_amount
  where id = p_reservation_id;
  insert into public.credit_transactions (
    user_id, reservation_id, transaction_type, amount, balance_after,
    idempotency_key, payload_hash, reason, metadata
  ) values (
    p_user_id, p_reservation_id, 'settle', v_refund, v_account.balance,
    p_operation_key, p_payload_hash, 'credit_settlement',
    jsonb_build_object(
      'reserved_amount', v_reservation.amount, 'charged_amount', p_actual_amount,
      'funding_source', v_reservation.funding_source,
      'subscription_charged', v_actual_subscription,
      'purchased_charged', v_actual_purchased
    )
  );
  insert into public.usage_records (
    user_id, reservation_id, operation_key, modality, model_id,
    status, credits_charged, metadata
  ) values (
    p_user_id, p_reservation_id, v_reservation.operation_key,
    v_reservation.modality, v_reservation.model_id, 'completed', p_actual_amount,
    coalesce(p_usage_metadata, '{}'::jsonb) || jsonb_build_object('funding_source', v_reservation.funding_source)
  );
  return jsonb_build_object(
    'reservation_id', p_reservation_id, 'state', 'settled',
    'charged_amount', p_actual_amount, 'balance', v_account.balance,
    'balance_delta', v_refund, 'funding_source', v_reservation.funding_source,
    'idempotent', false
  );
end;
$$;

create or replace function public.release_credits(
  p_user_id uuid, p_reservation_id uuid, p_operation_key text,
  p_payload_hash text, p_reason text default 'operation_released'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.credits%rowtype;
  v_reservation public.credit_reservations%rowtype;
  v_existing public.credit_transactions%rowtype;
  v_refund_subscription bigint := 0;
  v_refund_rollover bigint := 0;
  v_refund_purchased bigint := 0;
  v_refund bigint := 0;
begin
  if p_user_id is null or p_reservation_id is null
    or char_length(btrim(coalesce(p_operation_key, ''))) not between 1 and 200
    or coalesce(p_payload_hash, '') !~ '^[0-9a-f]{64}$'
    or char_length(btrim(coalesce(p_reason, ''))) = 0
  then raise exception using errcode = '22023', message = 'INVALID_RELEASE_REQUEST'; end if;
  select * into v_account from public.credits where user_id = p_user_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'CREDIT_ACCOUNT_NOT_FOUND'; end if;
  select * into v_existing from public.credit_transactions
  where user_id = p_user_id and transaction_type = 'release' and idempotency_key = p_operation_key;
  if found then
    if v_existing.reservation_id <> p_reservation_id or v_existing.payload_hash <> p_payload_hash then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'reservation_id', p_reservation_id, 'state', 'released',
      'balance', v_account.balance, 'balance_delta', v_existing.amount, 'idempotent', true
    );
  end if;
  select * into v_reservation from public.credit_reservations
  where id = p_reservation_id and user_id = p_user_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'RESERVATION_NOT_FOUND'; end if;
  if v_reservation.state <> 'reserved' then
    raise exception using errcode = '22023', message = 'RESERVATION_ALREADY_FINALIZED';
  end if;

  if v_reservation.funding_source = 'credits' then
    v_refund_subscription := v_reservation.subscription_amount;
    v_refund_rollover := v_reservation.subscription_rollover_amount;
    v_refund_purchased := v_reservation.purchased_amount;
    if v_refund_subscription > 0 and (
      v_account.subscription_entitlement_id is distinct from v_reservation.allowance_entitlement_id
      or (v_account.subscription_period_ends_at is not null and v_account.subscription_period_ends_at <= now())
    ) then
      v_refund_subscription := 0;
      v_refund_rollover := 0;
    end if;
    update public.credits set
      subscription_balance = subscription_balance + v_refund_subscription,
      subscription_rollover_balance = subscription_rollover_balance + v_refund_rollover,
      purchased_balance = purchased_balance + v_refund_purchased,
      balance = balance + v_refund_subscription + v_refund_purchased,
      updated_at = now()
    where user_id = p_user_id returning * into v_account;
    v_refund := v_refund_subscription + v_refund_purchased;
  elsif v_reservation.funding_source = 'free_trial_image' then
    update public.credits set free_image_remaining = least(free_image_remaining + 1, 5), updated_at = now()
    where user_id = p_user_id returning * into v_account;
  elsif v_reservation.funding_source = 'free_trial_video' then
    update public.credits set free_video_remaining = least(free_video_remaining + 1, 1), updated_at = now()
    where user_id = p_user_id returning * into v_account;
  elsif v_reservation.funding_source = 'lite_included_video'
    and v_account.lite_video_entitlement_id = v_reservation.allowance_entitlement_id
    and (v_account.subscription_period_ends_at is null or v_account.subscription_period_ends_at > now())
  then
    update public.credits set lite_video_remaining = least(lite_video_remaining + 1, 4), updated_at = now()
    where user_id = p_user_id returning * into v_account;
  end if;

  update public.credit_reservations set state = 'released' where id = p_reservation_id;
  insert into public.credit_transactions (
    user_id, reservation_id, transaction_type, amount, balance_after,
    idempotency_key, payload_hash, reason, metadata
  ) values (
    p_user_id, p_reservation_id, 'release', v_refund, v_account.balance,
    p_operation_key, p_payload_hash, p_reason,
    jsonb_build_object('funding_source', v_reservation.funding_source, 'reserved_amount', v_reservation.amount)
  );
  return jsonb_build_object(
    'reservation_id', p_reservation_id, 'state', 'released',
    'balance', v_account.balance, 'balance_delta', v_refund,
    'funding_source', v_reservation.funding_source, 'idempotent', false
  );
end;
$$;

-- A successful zero-charge allowance reservation must settle rather than be
-- released; failures and non-authoritative cancellations still release it.
create or replace function public.finalize_ai_execution_terminal(
  p_execution_id uuid, p_user_id uuid, p_reservation_id uuid,
  p_operation_key text, p_payload_hash text, p_terminal_status text,
  p_customer_charge bigint, p_usage_authoritative boolean default false,
  p_finish_reason text default null, p_error_code text default null,
  p_failure_owner text default null, p_failure_category text default null,
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
  if (select auth.role()) <> 'service_role' then raise exception using errcode = '42501', message = 'FORBIDDEN'; end if;
  if p_execution_id is null or p_user_id is null
    or char_length(btrim(coalesce(p_operation_key, ''))) not between 8 and 200
    or coalesce(p_payload_hash, '') !~ '^[0-9a-f]{64}$'
    or p_terminal_status not in ('completed','failed','partial_failed','user_cancelled','provider_cancelled')
    or p_customer_charge is null or p_customer_charge < 0 or p_attempt_count < 0
    or (p_failure_owner is not null and p_failure_owner not in ('customer','provider','vantra'))
    or ((p_provider_cost_minor is null) <> (p_provider_cost_currency is null))
    or p_provider_cost_minor < 0
    or (p_provider_cost_currency is not null and p_provider_cost_currency !~ '^[A-Z]{3}$')
  then raise exception using errcode = '22023', message = 'INVALID_EXECUTION_FINALIZATION'; end if;
  if p_terminal_status not in ('completed','user_cancelled') and p_customer_charge <> 0 then
    raise exception using errcode = '22023', message = 'FAILED_EXECUTION_MUST_NOT_CHARGE';
  end if;
  if p_terminal_status = 'user_cancelled' and p_customer_charge > 0 and not p_usage_authoritative then
    raise exception using errcode = '22023', message = 'CANCELLED_USAGE_NOT_AUTHORITATIVE';
  end if;

  select * into v_execution from public.ai_executions
  where id = p_execution_id and user_id = p_user_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'EXECUTION_NOT_FOUND'; end if;
  if v_execution.operation_key <> p_operation_key or v_execution.payload_hash <> p_payload_hash then
    raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT';
  end if;
  if v_execution.state not in ('reserved','streaming') then
    return jsonb_build_object(
      'execution_id', v_execution.id, 'state', v_execution.state,
      'terminal_status', v_execution.execution_metadata->>'terminal_status',
      'credits_charged', coalesce(v_execution.credits_charged,0), 'idempotent', true
    );
  end if;

  if p_reservation_id is not null then
    select * into v_reservation from public.credit_reservations
    where id = p_reservation_id and user_id = p_user_id;
    if not found or v_reservation.operation_key <> p_operation_key
      or v_reservation.payload_hash <> p_payload_hash
    then raise exception using errcode = '22023', message = 'INVALID_EXECUTION_RESERVATION'; end if;
    v_reserved := v_reservation.amount;
    v_pricing_version := v_reservation.pricing_version;
    if p_customer_charge > v_reserved then
      raise exception using errcode = '22023', message = 'SETTLEMENT_EXCEEDS_RESERVATION';
    end if;
    if p_terminal_status = 'completed' or p_customer_charge > 0 then
      perform public.settle_credits(
        p_user_id, p_reservation_id, p_operation_key, p_payload_hash,
        p_customer_charge, coalesce(p_actual_usage,'{}'::jsonb)
      );
    else
      perform public.release_credits(
        p_user_id, p_reservation_id, p_operation_key, p_payload_hash,
        coalesce(nullif(btrim(p_error_code),''),p_terminal_status)
      );
    end if;
  elsif p_customer_charge <> 0 then
    raise exception using errcode = '22023', message = 'CHARGE_REQUIRES_RESERVATION';
  end if;

  v_released := v_reserved - p_customer_charge;
  v_execution_state := case when p_terminal_status='completed' then 'completed'
    when p_terminal_status in ('user_cancelled','provider_cancelled') then 'cancelled' else 'failed' end;
  v_usage_status := case when p_terminal_status='completed' then 'completed'
    when p_terminal_status in ('user_cancelled','provider_cancelled') then 'cancelled' else 'failed' end;

  if p_reservation_id is not null then
    if p_terminal_status = 'completed' or p_customer_charge > 0 then
      update public.usage_records set status=v_usage_status, credits_charged=p_customer_charge,
        metadata=coalesce(p_actual_usage,'{}'::jsonb) where reservation_id=p_reservation_id;
    else
      insert into public.usage_records (
        user_id,reservation_id,operation_key,modality,model_id,status,credits_charged,metadata
      ) values (
        p_user_id,p_reservation_id,v_reservation.operation_key,v_execution.modality,
        v_execution.model_id,v_usage_status,0,coalesce(p_actual_usage,'{}'::jsonb)
      ) on conflict (reservation_id) do update set status=excluded.status,
        credits_charged=0,metadata=excluded.metadata;
    end if;
  end if;
  if p_provider_cost_minor is not null and p_reservation_id is not null then
    insert into public.provider_cost_records (
      user_id,reservation_id,provider,provider_model,pricing_version,
      actual_cost_minor,currency,credits_charged,execution_metadata
    ) values (
      p_user_id,p_reservation_id,v_execution.provider_id,v_execution.provider_model_id,
      v_pricing_version,p_provider_cost_minor,p_provider_cost_currency,p_customer_charge,
      coalesce(p_actual_usage,'{}'::jsonb)
    ) on conflict (reservation_id) do update set
      actual_cost_minor=excluded.actual_cost_minor,currency=excluded.currency,
      credits_charged=excluded.credits_charged,execution_metadata=excluded.execution_metadata;
  end if;
  update public.provider_attempts set
    state=case when p_terminal_status='completed' then 'completed'
      when p_terminal_status in ('user_cancelled','provider_cancelled') then 'cancelled' else 'failed' end,
    provider_operation_id=coalesce(nullif(btrim(coalesce(p_provider_operation_id,'')),''),provider_operation_id),
    error_message=case when p_terminal_status='completed' then null else left(coalesce(p_error_code,p_terminal_status),500) end,
    finished_at=now(), metadata=metadata || jsonb_build_object(
      'terminal_status',p_terminal_status,'customer_credits_charged',p_customer_charge,
      'provider_cost_minor',p_provider_cost_minor,'provider_cost_currency',p_provider_cost_currency
    )
  where outbox_id in (select id from public.provider_dispatch_outbox where reservation_id=p_reservation_id)
    and state in ('started','submitted','unknown');
  update public.provider_dispatch_outbox set
    state=case when p_terminal_status='completed' then 'completed'
      when p_terminal_status in ('user_cancelled','provider_cancelled') then 'cancelled' else 'failed' end,
    last_error=case when p_terminal_status='completed' then null else left(coalesce(p_error_code,p_terminal_status),500) end
  where reservation_id=p_reservation_id and state in ('pending','leased','dispatched');
  v_metadata := coalesce(p_actual_usage,'{}'::jsonb) || jsonb_build_object(
    'terminal_status',p_terminal_status,'credits_reserved',v_reserved,
    'credits_charged',p_customer_charge,'credits_released',v_released,
    'funding_source',coalesce(v_reservation.funding_source,'customer_free'),
    'provider_cost_minor',p_provider_cost_minor,'provider_cost_currency',p_provider_cost_currency,
    'failure_owner',p_failure_owner,'failure_category',p_failure_category,
    'provider_operation_id',p_provider_operation_id,'attempt_count',p_attempt_count
  );
  update public.ai_executions set state=v_execution_state,reservation_id=p_reservation_id,
    credits_charged=p_customer_charge,finish_reason=left(p_finish_reason,100),
    error_code=left(p_error_code,120),execution_metadata=v_metadata,completed_at=now()
  where id=p_execution_id;
  return jsonb_build_object(
    'execution_id',p_execution_id,'state',v_execution_state,'terminal_status',p_terminal_status,
    'credits_reserved',v_reserved,'credits_charged',p_customer_charge,
    'credits_released',v_released,'idempotent',false
  );
end;
$$;

create or replace function public.approve_manual_payment(
  p_payment_order_id uuid, p_actor_user_id uuid, p_review_note text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.payment_orders%rowtype;
  v_account public.credits%rowtype;
  v_transaction_id uuid;
  v_entitlement_id uuid;
  v_entitlement public.user_entitlements%rowtype;
  v_hash text;
  v_plan_code text;
  v_allowance bigint;
  v_rollover bigint := 0;
  v_old_subscription bigint := 0;
  v_existing_transaction public.credit_transactions%rowtype;
  v_existing_entitlement public.user_entitlements%rowtype;
begin
  if coalesce((select auth.role()),'') <> 'service_role' then
    raise exception using errcode='42501',message='FORBIDDEN';
  end if;
  if p_actor_user_id is null then raise exception using errcode='22023',message='ACTOR_REQUIRED'; end if;
  select * into v_order from public.payment_orders where id=p_payment_order_id for update;
  if not found then raise exception using errcode='P0002',message='PAYMENT_ORDER_NOT_FOUND'; end if;
  if v_order.status='approved' then
    if v_order.resulting_credit_transaction_id is null then
      raise exception using errcode='P0001',message='PAYMENT_APPROVAL_INTEGRITY_ERROR';
    end if;
    select * into v_existing_transaction from public.credit_transactions where id=v_order.resulting_credit_transaction_id;
    if not found or v_existing_transaction.user_id is distinct from v_order.user_id
      or v_existing_transaction.transaction_type is distinct from 'grant'
      or v_existing_transaction.amount is distinct from v_order.credits_amount
      or v_existing_transaction.idempotency_key is distinct from 'payment:'||v_order.id::text
      or v_existing_transaction.metadata->>'payment_order_id' is distinct from v_order.id::text
    then raise exception using errcode='P0001',message='PAYMENT_APPROVAL_INTEGRITY_ERROR'; end if;
    if v_order.order_kind='subscription' then
      select * into v_existing_entitlement from public.user_entitlements where id=v_order.resulting_entitlement_id;
      if not found or v_existing_entitlement.user_id is distinct from v_order.user_id
        or v_existing_entitlement.source_payment_order_id is distinct from v_order.id
      then raise exception using errcode='P0001',message='PAYMENT_APPROVAL_INTEGRITY_ERROR'; end if;
    end if;
    return jsonb_build_object('payment_order_id',v_order.id,'status','approved',
      'credit_transaction_id',v_order.resulting_credit_transaction_id,
      'entitlement_id',v_order.resulting_entitlement_id,'idempotent',true);
  end if;
  if v_order.status<>'pending' or v_order.submitted_at is null or v_order.expires_at<=now() then
    raise exception using errcode='22023',message='PAYMENT_ORDER_NOT_APPROVABLE';
  end if;
  select * into v_existing_transaction from public.credit_transactions
  where user_id=v_order.user_id and transaction_type='grant'
    and idempotency_key='payment:'||v_order.id::text;
  if found then raise exception using errcode='P0001',message='PAYMENT_APPROVAL_INTEGRITY_ERROR'; end if;

  select * into v_account from public.credits where user_id=v_order.user_id for update;
  if not found then raise exception using errcode='P0001',message='CREDIT_ACCOUNT_NOT_FOUND'; end if;
  v_plan_code := coalesce(v_order.entitlement->>'plan_code',
    (select plan_code from public.payment_plans where id=v_order.plan_id));
  v_allowance := coalesce((v_order.entitlement->>'subscription_credit_allowance')::bigint,v_order.credits_amount);
  if v_allowance <> v_order.credits_amount then
    raise exception using errcode='P0001',message='PAYMENT_APPROVAL_INTEGRITY_ERROR';
  end if;

  if v_order.order_kind='subscription' then
    if v_plan_code='pro' and v_account.subscription_plan_code='pro'
      and v_account.subscription_period_ends_at>now()
    then
      v_rollover := least(greatest(v_account.subscription_balance-v_account.subscription_rollover_balance,0),600);
    end if;
    insert into public.user_entitlements (user_id,plan_id,plan_name,source_payment_order_id,entitlement)
    values (v_order.user_id,v_order.plan_id,v_order.plan_name,v_order.id,v_order.entitlement)
    returning * into v_entitlement;
    v_entitlement_id := v_entitlement.id;

    if v_plan_code in ('lite','pro') then
      v_old_subscription := v_account.subscription_balance;
      if v_old_subscription>0 then
        insert into public.credit_transactions (
          user_id,transaction_type,amount,balance_after,idempotency_key,payload_hash,reason,metadata
        ) values (
          v_order.user_id,'adjustment',-v_old_subscription,v_account.purchased_balance,
          'payment:'||v_order.id::text||':subscription-reset',
          encode(sha256((v_order.id::text||':subscription-reset')::bytea),'hex'),
          'subscription_period_reset',jsonb_build_object('source_bucket','subscription')
        );
      end if;
      update public.credits set
        subscription_balance=v_allowance,
        subscription_rollover_balance=0,
        balance=purchased_balance+v_allowance,
        subscription_plan_code=v_plan_code,
        subscription_entitlement_id=v_entitlement_id,
        subscription_period_ends_at=v_entitlement.ends_at,
        lite_video_remaining=case when v_plan_code='lite' then 4 else 0 end,
        lite_video_entitlement_id=case when v_plan_code='lite' then v_entitlement_id else null end,
        updated_at=now()
      where user_id=v_order.user_id returning * into v_account;
    else
      update public.credits set
        subscription_balance=subscription_balance+v_order.credits_amount,
        balance=balance+v_order.credits_amount,
        subscription_plan_code=v_plan_code,
        subscription_entitlement_id=v_entitlement_id,
        subscription_period_ends_at=v_entitlement.ends_at,
        lite_video_remaining=0,lite_video_entitlement_id=null,updated_at=now()
      where user_id=v_order.user_id returning * into v_account;
    end if;
  else
    update public.credits set purchased_balance=purchased_balance+v_order.credits_amount,
      balance=balance+v_order.credits_amount,updated_at=now()
    where user_id=v_order.user_id returning * into v_account;
  end if;

  v_hash:=md5(v_order.id::text||':'||v_order.user_id::text)||md5(v_order.id::text||':payment-grant');
  insert into public.credit_transactions (
    user_id,transaction_type,amount,balance_after,idempotency_key,payload_hash,reason,metadata
  ) values (
    v_order.user_id,'grant',v_order.credits_amount,v_account.balance,
    'payment:'||v_order.id::text,v_hash,'manual_payment_approved',jsonb_build_object(
      'payment_order_id',v_order.id,'payment_reference',v_order.payment_reference,
      'amount_dzd',v_order.amount_dzd,'plan_id',v_order.plan_id,'plan_name',v_order.plan_name,
      'plan_code',v_plan_code,'approved_by',p_actor_user_id,
      'source_bucket',case when v_order.order_kind='subscription' then 'subscription' else 'purchased' end
    )
  ) returning id into v_transaction_id;

  if v_rollover>0 then
    update public.credits set subscription_balance=subscription_balance+v_rollover,
      subscription_rollover_balance=v_rollover,balance=balance+v_rollover,updated_at=now()
    where user_id=v_order.user_id returning * into v_account;
    insert into public.credit_transactions (
      user_id,transaction_type,amount,balance_after,idempotency_key,payload_hash,reason,metadata
    ) values (
      v_order.user_id,'grant',v_rollover,v_account.balance,
      'payment:'||v_order.id::text||':rollover',
      encode(sha256((v_order.id::text||':rollover')::bytea),'hex'),
      'pro_subscription_rollover',jsonb_build_object(
        'payment_order_id',v_order.id,'source_bucket','subscription','rollover_cap',600
      )
    );
  end if;

  update public.payment_orders set status='approved',reviewed_at=now(),reviewed_by=p_actor_user_id,
    review_note=nullif(btrim(coalesce(p_review_note,'')),''),
    resulting_credit_transaction_id=v_transaction_id,resulting_entitlement_id=v_entitlement_id
  where id=v_order.id;
  insert into public.payment_audit_log (
    payment_order_id,actor_user_id,action,previous_status,new_status,metadata
  ) values (
    v_order.id,p_actor_user_id,'approved','pending','approved',jsonb_build_object(
      'credit_transaction_id',v_transaction_id,'entitlement_id',v_entitlement_id,
      'subscription_rollover',v_rollover
    )
  );
  return jsonb_build_object('payment_order_id',v_order.id,'status','approved',
    'credit_transaction_id',v_transaction_id,'entitlement_id',v_entitlement_id,
    'subscription_rollover',v_rollover,'idempotent',false);
end;
$$;

create or replace function public.admin_adjust_user_credits(
  p_target_user_id uuid,p_actor_user_id uuid,p_amount bigint,p_reason text,
  p_idempotency_key text,p_payload_hash text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_account public.credits%rowtype;
  v_new_balance bigint;
  v_subscription_used bigint:=0;
  v_rollover_used bigint:=0;
  v_purchased_used bigint:=0;
  v_existing public.credit_transactions%rowtype;
  v_transaction public.credit_transactions%rowtype;
begin
  if (select auth.role())<>'service_role' then raise exception using errcode='42501',message='FORBIDDEN'; end if;
  if p_target_user_id is null or p_actor_user_id is null or p_amount is null or p_amount=0
    or p_amount < -1000000000 or p_amount > 1000000000
    or char_length(btrim(coalesce(p_reason,''))) not between 3 and 500
    or char_length(btrim(coalesce(p_idempotency_key,''))) not between 8 and 200
    or coalesce(p_payload_hash,'') !~ '^[0-9a-f]{64}$'
  then raise exception using errcode='22023',message='INVALID_CREDIT_ADJUSTMENT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_target_user_id::text||':'||btrim(p_idempotency_key),0));
  select * into v_existing from public.credit_transactions
  where user_id=p_target_user_id and transaction_type='adjustment' and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.amount<>p_amount or v_existing.payload_hash<>p_payload_hash
      or v_existing.reason<>btrim(p_reason) or v_existing.metadata->>'actor_user_id'<>p_actor_user_id::text
    then raise exception using errcode='22023',message='IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('transaction_id',v_existing.id,'balance',v_existing.balance_after,
      'amount',v_existing.amount,'idempotent',true,'created_at',v_existing.created_at);
  end if;
  select * into v_account from public.credits where user_id=p_target_user_id for update;
  if not found then raise exception using errcode='P0001',message='CREDIT_ACCOUNT_NOT_FOUND'; end if;
  v_new_balance:=v_account.balance+p_amount;
  if v_new_balance<0 then raise exception using errcode='P0001',message='INSUFFICIENT_CREDITS'; end if;
  if p_amount>0 then
    update public.credits set purchased_balance=purchased_balance+p_amount,balance=v_new_balance,updated_at=now()
    where user_id=p_target_user_id returning * into v_account;
  else
    v_subscription_used:=least(v_account.subscription_balance,-p_amount);
    v_rollover_used:=least(v_account.subscription_rollover_balance,v_subscription_used);
    v_purchased_used:=(-p_amount)-v_subscription_used;
    update public.credits set
      subscription_balance=subscription_balance-v_subscription_used,
      subscription_rollover_balance=subscription_rollover_balance-v_rollover_used,
      purchased_balance=purchased_balance-v_purchased_used,balance=v_new_balance,updated_at=now()
    where user_id=p_target_user_id returning * into v_account;
  end if;
  insert into public.credit_transactions (
    user_id,transaction_type,amount,balance_after,idempotency_key,payload_hash,reason,metadata
  ) values (
    p_target_user_id,'adjustment',p_amount,v_account.balance,btrim(p_idempotency_key),p_payload_hash,
    btrim(p_reason),jsonb_build_object('actor_user_id',p_actor_user_id,'source','owner_admin',
      'subscription_amount',v_subscription_used,'purchased_amount',case when p_amount>0 then p_amount else v_purchased_used end)
  ) returning * into v_transaction;
  perform public.write_admin_audit(p_actor_user_id,'credits_adjusted','user',p_target_user_id::text,
    jsonb_build_object('balance',v_account.balance-p_amount),jsonb_build_object(
      'balance',v_account.balance,'amount',p_amount,'transaction_id',v_transaction.id,'reason',btrim(p_reason)
    ));
  return jsonb_build_object('transaction_id',v_transaction.id,'balance',v_account.balance,
    'amount',v_transaction.amount,'idempotent',false,'created_at',v_transaction.created_at);
end;
$$;

revoke all on function public.reserve_credits(uuid,text,text,text,text,bigint,text,jsonb,jsonb,timestamptz)
  from public,anon,authenticated;
revoke all on function public.settle_credits(uuid,uuid,text,text,bigint,jsonb)
  from public,anon,authenticated;
revoke all on function public.release_credits(uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke all on function public.finalize_ai_execution_terminal(
  uuid,uuid,uuid,text,text,text,bigint,boolean,text,text,text,text,jsonb,bigint,text,text,integer
) from public,anon,authenticated;
revoke all on function public.approve_manual_payment(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.admin_adjust_user_credits(uuid,uuid,bigint,text,text,text)
  from public,anon,authenticated;

grant execute on function public.reserve_credits(uuid,text,text,text,text,bigint,text,jsonb,jsonb,timestamptz)
  to service_role;
grant execute on function public.settle_credits(uuid,uuid,text,text,bigint,jsonb) to service_role;
grant execute on function public.release_credits(uuid,uuid,text,text,text) to service_role;
grant execute on function public.finalize_ai_execution_terminal(
  uuid,uuid,uuid,text,text,text,bigint,boolean,text,text,text,text,jsonb,bigint,text,text,integer
) to service_role;
grant execute on function public.approve_manual_payment(uuid,uuid,text) to service_role;
grant execute on function public.admin_adjust_user_credits(uuid,uuid,bigint,text,text,text) to service_role;

comment on column public.credits.subscription_balance is
  'Current paid-period credits, including the separately tracked current rollover portion.';
comment on column public.credits.purchased_balance is
  'Non-expiring purchased/top-up credits; media use still requires eligible paid access.';
comment on column public.credits.subscription_rollover_balance is
  'Non-recursive portion carried into the current Pro period; consumed before current-period base credits.';
comment on column public.credit_reservations.funding_source is
  'Server-selected funding path. Client input never chooses a balance bucket or allowance.';

commit;
