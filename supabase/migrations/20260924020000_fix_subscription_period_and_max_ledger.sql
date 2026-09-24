-- Current paid periods and MAX grants; historical migrations remain immutable.
-- This migration changes definitions and a provably future-only status label.
-- It does not infer or repair historical credit ownership or ledger amounts.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '5min';

alter table public.user_entitlements
  drop constraint if exists user_entitlements_status_check,
  add constraint user_entitlements_status_check
    check (status in ('active', 'scheduled', 'cancelled', 'expired'));

-- A scheduled period is authoritative evidence that its future entitlement
-- has not started. No balance, order, or historical amount is changed here.
update public.user_entitlements e set status = 'scheduled'
from public.subscription_periods p
where p.entitlement_id = e.id
  and p.state = 'scheduled'
  and p.period_starts_at > now()
  and e.starts_at > now()
  and e.status = 'active';

-- A replaced period cannot later become current or extend another renewal.
-- The period state proves cancellation; its original timestamps are retained.
update public.user_entitlements e set status = 'cancelled'
from public.subscription_periods p
where p.entitlement_id = e.id
  and p.state = 'replaced'
  and e.starts_at > now()
  and e.status in ('active', 'scheduled');



create or replace function public.apply_entitlement_access_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer;
  v_plan_code text;
  v_current_end timestamptz;
  v_current_plan text;
  v_current_period_end timestamptz;
begin
  if not (new.entitlement ? 'access_period_days') then return new; end if;
  begin
    v_days := (new.entitlement->>'access_period_days')::integer;
  exception when others then
    raise exception using errcode = '22023', message = 'INVALID_ACCESS_PERIOD';
  end;
  if v_days is null or v_days not between 1 and 3650 then
    raise exception using errcode = '22023', message = 'INVALID_ACCESS_PERIOD';
  end if;

  select plan_code into v_plan_code from public.payment_plans where id = new.plan_id;
  if v_plan_code in ('lite', 'pro') and v_days <> 30 then
    raise exception using errcode = '22023', message = 'INVALID_ACCESS_PERIOD';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':subscription-access', 0));
  select account.subscription_plan_code, account.subscription_period_ends_at
    into v_current_plan, v_current_period_end
  from public.credits account where account.user_id = new.user_id;
  select max(entitlement.ends_at) into v_current_end
  from public.user_entitlements entitlement
  join public.payment_plans plan on plan.id = entitlement.plan_id
  where entitlement.user_id = new.user_id
    and entitlement.status in ('active', 'scheduled')
    and plan.plan_code = v_plan_code
    and entitlement.ends_at > now()
    and (
      entitlement.starts_at <= now()
      or exists (
        select 1 from public.subscription_periods scheduled
        where scheduled.entitlement_id = entitlement.id and scheduled.state = 'scheduled'
      )
    )
    and not exists (
      select 1 from public.subscription_periods replaced
      where replaced.entitlement_id = entitlement.id and replaced.state = 'replaced'
    );

  if v_plan_code in ('lite', 'pro')
    and v_current_plan = v_plan_code
    and v_current_period_end > now()
  then
    new.starts_at := greatest(now(), coalesce(v_current_end, v_current_period_end));
    new.ends_at := new.starts_at + make_interval(days => v_days);
  elsif v_plan_code = 'max' and v_current_end > now() then
    new.starts_at := coalesce(new.starts_at, now());
    new.ends_at := v_current_end + make_interval(days => v_days);
  else
    new.starts_at := now();
    new.ends_at := new.starts_at + make_interval(days => v_days);
  end if;
  new.status := case when new.starts_at > now() then 'scheduled' else 'active' end;
  return new;
end;
$$;

create or replace function public.get_user_plan_access()
returns table (
  plan_code text,
  plan_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  access_state text
)
language plpgsql volatile security definer set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  perform public.refresh_subscription_lifecycle(v_user_id);
  return query
    select p.plan_code, e.plan_name, e.starts_at, e.ends_at,
      case
        when e.status = 'expired' or e.ends_at <= now() then 'EXPIRED'
        when e.ends_at <= now() + interval '7 days' then 'EXPIRING_SOON'
        else 'ACTIVE'
      end
    from public.user_entitlements e
    join public.payment_plans p on p.id = e.plan_id
    where e.user_id = v_user_id
      and e.status in ('active', 'expired')
      and e.starts_at <= now()
    order by case when e.status = 'active'
        and (e.ends_at is null or e.ends_at > now()) then 0 else 1 end,
      e.starts_at desc, e.created_at desc
    limit 1;
end;
$$;

-- A due scheduled period must also be current for direct model-plan RPC reads.
create or replace function public.get_current_model_plan()
returns table (plan_code text, plan_name text)
language plpgsql volatile security definer set search_path = '' as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;
  perform public.refresh_subscription_lifecycle(v_user_id);
  return query
    select plan.plan_code, entitlement.plan_name
    from public.user_entitlements entitlement
    join public.payment_plans plan on plan.id = entitlement.plan_id
    where entitlement.user_id = v_user_id
      and entitlement.status = 'active'
      and entitlement.starts_at <= now()
      and (entitlement.ends_at is null or entitlement.ends_at > now())
      and plan.plan_code in ('lite','pro','max')
    order by entitlement.starts_at desc, entitlement.created_at desc
    limit 1;
end;
$$;

create or replace function public.reserve_credits_v2_base(
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

  -- Activate any due scheduled period before choosing the current allowance.
  perform public.refresh_subscription_lifecycle(p_user_id);
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
    and entitlement.starts_at <= now()
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

create or replace function public.reserve_model_trial_access(
  p_user_id uuid,
  p_model_key text,
  p_model_id text,
  p_modality text,
  p_plan_code text,
  p_operation_key text,
  p_credit_reservation_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_access public.model_plan_access_configs%rowtype;
  v_existing public.model_trial_usages%rowtype;
  v_effective_plan text := 'free';
  v_entitlement_id uuid;
  v_scope text;
  v_used integer;
  v_expiry timestamptz := now() + interval '20 minutes';
  v_trial_id uuid;
  v_user_created_at timestamptz;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_user_id is null or p_modality not in ('chat','image','video')
    or p_plan_code not in ('free','lite','pro','max')
    or char_length(btrim(coalesce(p_model_key,''))) = 0
    or char_length(btrim(coalesce(p_model_id,''))) = 0
    or char_length(btrim(coalesce(p_operation_key,''))) not between 1 and 200
  then raise exception using errcode = '22023', message = 'INVALID_MODEL_TRIAL_REQUEST'; end if;

  perform public.refresh_subscription_lifecycle(p_user_id);

  select entitlement.id, plan.plan_code into v_entitlement_id, v_effective_plan
  from public.user_entitlements entitlement
  join public.payment_plans plan on plan.id = entitlement.plan_id
  where entitlement.user_id = p_user_id and entitlement.status = 'active'
    and entitlement.starts_at <= now()
    and (entitlement.ends_at is null or entitlement.ends_at > now())
    and plan.plan_code in ('lite','pro','max')
  order by entitlement.starts_at desc, entitlement.created_at desc limit 1;
  if not found then v_effective_plan := 'free'; v_entitlement_id := null; end if;
  if v_effective_plan <> p_plan_code then
    raise exception using errcode = 'P0001', message = 'MODEL_ACCESS_CHANGED';
  end if;

  select * into v_access from public.model_plan_access_configs
  where model_key = p_model_key and plan_code = v_effective_plan;
  if not found or v_access.access_state <> 'trial' or v_access.trial_allowance is null then
    raise exception using errcode = 'P0001', message = 'MODEL_TRIAL_UNCONFIGURED';
  end if;

  if v_effective_plan = 'free' then
    select created_at into v_user_created_at from auth.users where id = p_user_id;
    if not found then raise exception using errcode = 'P0001', message = 'MODEL_ACCESS_CHANGED'; end if;
    if p_modality in ('image','video') and now() >= v_user_created_at + interval '7 days' then
      raise exception using errcode = 'P0001', message = 'FREE_MEDIA_EXPIRED';
    end if;
    v_scope := 'free:one-time';
  else
    v_scope := 'entitlement:' || v_entitlement_id::text;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_model_key || ':' || v_scope, 0));
  select * into v_existing from public.model_trial_usages
  where user_id = p_user_id and operation_key = p_operation_key;
  if found then
    if v_existing.model_key <> p_model_key or v_existing.plan_code <> v_effective_plan
      or v_existing.trial_scope <> v_scope or v_existing.state = 'released'
    then raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('trial_usage_id',v_existing.id,'state',v_existing.state,'idempotent',true);
  end if;

  update public.model_trial_usages set state = 'released', released_at = now(), updated_at = now()
  where user_id = p_user_id and model_key = p_model_key and plan_code = v_effective_plan
    and trial_scope = v_scope and state = 'reserved' and expires_at <= now();
  select count(*) into v_used from public.model_trial_usages
  where user_id = p_user_id and model_key = p_model_key and plan_code = v_effective_plan
    and trial_scope = v_scope and (state = 'completed' or (state = 'reserved' and expires_at > now()));
  if v_used >= v_access.trial_allowance then
    raise exception using errcode = 'P0001', message = 'MODEL_TRIAL_EXHAUSTED';
  end if;

  if p_credit_reservation_id is not null then
    select least(expires_at, v_expiry) into v_expiry from public.credit_reservations
    where id = p_credit_reservation_id and user_id = p_user_id and operation_key = p_operation_key;
    if not found then raise exception using errcode = 'P0001', message = 'MODEL_ACCESS_CHANGED'; end if;
  end if;
  insert into public.model_trial_usages (
    user_id, model_key, model_id, modality, plan_code, entitlement_id, trial_scope,
    operation_key, credit_reservation_id, state, expires_at
  ) values (
    p_user_id,p_model_key,p_model_id,p_modality,v_effective_plan,v_entitlement_id,v_scope,
    p_operation_key,p_credit_reservation_id,'reserved',v_expiry
  ) returning id into v_trial_id;
  return jsonb_build_object('trial_usage_id',v_trial_id,'state','reserved','idempotent',false);
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
  v_period public.subscription_periods%rowtype;
  v_previous_period public.subscription_periods%rowtype;
  v_existing_transaction public.credit_transactions%rowtype;
  v_existing_entitlement public.user_entitlements%rowtype;
  v_hash text;
  v_plan_code text;
  v_current_plan text;
  v_previous_plan text;
  v_lifecycle_type text;
  v_allowance bigint;
  v_included_videos smallint := 0;
  v_rollover bigint := 0;
  v_max_rollover bigint := 0;
  v_old_subscription bigint := 0;
  v_scheduled boolean := false;
  -- Match refresh_subscription_lifecycle's transaction timestamp at expiry.
  v_now timestamptz := now();
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_actor_user_id is null then raise exception using errcode = '22023', message = 'ACTOR_REQUIRED'; end if;

  select * into v_order from public.payment_orders where id = p_payment_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PAYMENT_ORDER_NOT_FOUND'; end if;
  if v_order.status = 'approved' then
    if v_order.resulting_credit_transaction_id is null then
      raise exception using errcode = 'P0001', message = 'PAYMENT_APPROVAL_INTEGRITY_ERROR';
    end if;
    select * into v_existing_transaction from public.credit_transactions
      where id = v_order.resulting_credit_transaction_id;
    if not found
      or v_existing_transaction.user_id is distinct from v_order.user_id
      or v_existing_transaction.transaction_type is distinct from 'grant'
      or v_existing_transaction.idempotency_key is distinct from 'payment:' || v_order.id::text
      or v_existing_transaction.metadata->>'payment_order_id' is distinct from v_order.id::text
    then
      raise exception using errcode = 'P0001', message = 'PAYMENT_APPROVAL_INTEGRITY_ERROR';
    end if;
    if v_order.order_kind = 'subscription' then
      select * into v_existing_entitlement from public.user_entitlements
        where id = v_order.resulting_entitlement_id;
      if not found
        or v_existing_entitlement.user_id is distinct from v_order.user_id
        or v_existing_entitlement.source_payment_order_id is distinct from v_order.id
      then
        raise exception using errcode = 'P0001', message = 'PAYMENT_APPROVAL_INTEGRITY_ERROR';
      end if;
    end if;
    return jsonb_build_object(
      'payment_order_id', v_order.id,
      'status', 'approved',
      'credit_transaction_id', v_order.resulting_credit_transaction_id,
      'entitlement_id', v_order.resulting_entitlement_id,
      'lifecycle_type', v_existing_transaction.metadata->>'lifecycle_type',
      'activation', v_existing_transaction.metadata->>'activation',
      'idempotent', true
    );
  end if;
  if v_order.status <> 'pending' or v_order.submitted_at is null or v_order.expires_at <= v_now then
    raise exception using errcode = '22023', message = 'PAYMENT_ORDER_NOT_APPROVABLE';
  end if;
  if exists (
    select 1 from public.credit_transactions
    where user_id = v_order.user_id and transaction_type = 'grant'
      and idempotency_key = 'payment:' || v_order.id::text
  ) then
    raise exception using errcode = 'P0001', message = 'PAYMENT_APPROVAL_INTEGRITY_ERROR';
  end if;

  perform public.refresh_subscription_lifecycle(v_order.user_id);
  select * into v_account from public.credits where user_id = v_order.user_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'CREDIT_ACCOUNT_NOT_FOUND'; end if;

  v_plan_code := coalesce(v_order.entitlement->>'plan_code',
    (select plan_code from public.payment_plans where id = v_order.plan_id));
  v_allowance := coalesce(
    (v_order.entitlement->>'subscription_credit_allowance')::bigint,
    v_order.credits_amount
  );
  if v_allowance <> v_order.credits_amount then
    raise exception using errcode = 'P0001', message = 'PAYMENT_APPROVAL_INTEGRITY_ERROR';
  end if;
  if v_plan_code = 'pro' and v_allowance <> 3000 then
    raise exception using errcode = 'P0001', message = 'PAYMENT_APPROVAL_INTEGRITY_ERROR';
  end if;
  -- The existing MAX start cap must never silently undergrant a frozen order.
  if v_order.order_kind = 'subscription' and v_plan_code = 'max'
    and v_allowance > 9000 then
    raise exception using errcode = 'P0001', message = 'PAYMENT_APPROVAL_INTEGRITY_ERROR';
  end if;

  v_included_videos := case
    when v_plan_code = 'lite' and v_order.entitlement ? 'included_video_allowance'
      then (v_order.entitlement->>'included_video_allowance')::smallint
    -- Legacy Lite orders predate video snapshots; preserve their original offer.
    when v_plan_code = 'lite' then 4
    else 0
  end;
  if v_plan_code = 'lite' and v_included_videos is null then
    raise exception using errcode = 'P0001', message = 'PAYMENT_APPROVAL_INTEGRITY_ERROR';
  end if;

  v_current_plan := case
    when v_account.subscription_period_ends_at > v_now then v_account.subscription_plan_code
    else null
  end;
  if v_current_plan is null then
    select prior_plan.plan_code into v_previous_plan
    from public.user_entitlements prior_entitlement
    join public.payment_plans prior_plan on prior_plan.id = prior_entitlement.plan_id
    where prior_entitlement.user_id = v_order.user_id
      and prior_entitlement.starts_at <= v_now
      and prior_plan.plan_code in ('lite', 'pro', 'max')
    order by prior_entitlement.ends_at desc nulls last, prior_entitlement.created_at desc
    limit 1;
  end if;

  if v_order.order_kind = 'credit_pack' then
    if not exists (
      select 1 from public.user_entitlements entitlement
      join public.payment_plans active_plan on active_plan.id = entitlement.plan_id
      where entitlement.user_id = v_order.user_id
        and entitlement.status = 'active'
        and entitlement.starts_at <= v_now
        and (entitlement.ends_at is null or entitlement.ends_at > v_now)
        and active_plan.plan_code in ('lite', 'pro', 'max')
    ) then
      raise exception using errcode = '42501', message = 'ACTIVE_PAID_PLAN_REQUIRED';
    end if;
    v_lifecycle_type := 'top_up';
    update public.credits set
      purchased_balance = purchased_balance + v_order.credits_amount,
      balance = balance + v_order.credits_amount,
      updated_at = now()
    where user_id = v_order.user_id returning * into v_account;
  elsif v_order.order_kind = 'subscription' then
    if v_plan_code not in ('lite', 'pro', 'max') then
      raise exception using errcode = '22023', message = 'INVALID_SUBSCRIPTION_PLAN';
    end if;

    v_lifecycle_type := case
      when v_current_plan is null and v_previous_plan = v_plan_code then 'same_plan_renewal'
      when v_current_plan is null
        and (case v_plan_code when 'lite' then 1 when 'pro' then 2 when 'max' then 3 end)
          > (case v_previous_plan when 'lite' then 1 when 'pro' then 2 when 'max' then 3 end)
        then 'upgrade'
      when v_current_plan is null then 'new_subscription'
      when v_current_plan = v_plan_code then 'same_plan_renewal'
      when (case v_plan_code when 'lite' then 1 when 'pro' then 2 when 'max' then 3 end)
        > (case v_current_plan when 'lite' then 1 when 'pro' then 2 when 'max' then 3 end)
        then 'upgrade'
      else 'plan_change'
    end;

    insert into public.user_entitlements (
      user_id, plan_id, plan_name, source_payment_order_id, entitlement
    ) values (
      v_order.user_id, v_order.plan_id, v_order.plan_name, v_order.id, v_order.entitlement
    ) returning * into v_entitlement;
    v_entitlement_id := v_entitlement.id;

    if v_current_plan = v_plan_code and v_plan_code in ('lite', 'pro') then
      v_scheduled := true;
      insert into public.subscription_periods (
        user_id, payment_order_id, entitlement_id, plan_code,
        period_starts_at, period_ends_at, base_allowance, included_videos, state
      ) values (
        v_order.user_id, v_order.id, v_entitlement.id, v_plan_code,
        v_entitlement.starts_at, v_entitlement.ends_at, v_allowance,
        v_included_videos,
        'scheduled'
      ) returning * into v_period;
    elsif v_plan_code in ('lite', 'pro') then
      v_old_subscription := v_account.subscription_balance;
      if v_current_plan is not null then
        update public.subscription_periods set
          state = 'replaced', eligible_unused_at_close = 0, closed_at = v_now
        where user_id = v_order.user_id and state in ('active', 'scheduled');
        update public.user_entitlements e set status = 'cancelled'
        from public.subscription_periods p
        where p.entitlement_id = e.id and p.user_id = v_order.user_id
          and p.state = 'replaced' and p.closed_at = v_now
          and e.status = 'scheduled';
        update public.user_entitlements set
          status = 'expired', ends_at = least(coalesce(ends_at, v_now), v_now)
        where user_id = v_order.user_id and status = 'active' and id <> v_entitlement.id;
      end if;

      if v_plan_code = 'pro' and v_current_plan is null then
        select * into v_previous_period
        from public.subscription_periods
        where user_id = v_order.user_id
          and plan_code = 'pro'
          and state = 'expired'
          and period_ends_at <= v_now
          and period_ends_at >= v_now - interval '30 days'
        order by period_ends_at desc
        limit 1;
        if found then
          v_rollover := least(v_previous_period.eligible_unused_at_close, 600);
        end if;
      end if;

      if v_old_subscription > 0 then
        insert into public.credit_transactions (
          user_id, transaction_type, amount, balance_after,
          idempotency_key, payload_hash, reason, metadata
        ) values (
          v_order.user_id, 'adjustment', -v_old_subscription, v_account.purchased_balance,
          'payment:' || v_order.id::text || ':subscription-reset',
          encode(sha256((v_order.id::text || ':subscription-reset')::bytea), 'hex'),
          'subscription_upgrade_replaced', jsonb_build_object(
            'source_bucket', 'subscription', 'previous_plan_code', v_current_plan
          )
        );
      end if;

      insert into public.subscription_periods (
        user_id, payment_order_id, entitlement_id, plan_code,
        period_starts_at, period_ends_at, base_allowance, rollover_amount,
        included_videos, state, activated_at
      ) values (
        v_order.user_id, v_order.id, v_entitlement.id, v_plan_code,
        v_entitlement.starts_at, v_entitlement.ends_at, v_allowance, v_rollover,
        v_included_videos,
        'active', v_now
      ) returning * into v_period;

      update public.credits set
        subscription_balance = v_allowance,
        subscription_rollover_balance = 0,
        balance = purchased_balance + v_allowance,
        subscription_plan_code = v_plan_code,
        subscription_entitlement_id = v_entitlement.id,
        subscription_period_ends_at = v_entitlement.ends_at,
        lite_video_remaining = v_included_videos,
        lite_video_entitlement_id = case when v_plan_code = 'lite' then v_entitlement.id else null end,
        updated_at = now()
      where user_id = v_order.user_id returning * into v_account;
    else
      -- Only unused subscription credits from an active MAX period can roll.
      -- Purchased credits remain in their separate bucket through every reset.
      v_max_rollover := case when v_current_plan = 'max' then least(
        greatest(v_account.subscription_balance - v_account.subscription_rollover_balance, 0),
        1500,
        9000 - v_allowance
      ) else 0 end;
      if v_current_plan in ('lite', 'pro') then
        update public.subscription_periods set
          state = 'replaced', eligible_unused_at_close = 0, closed_at = v_now
        where user_id = v_order.user_id and state in ('active', 'scheduled');
        update public.user_entitlements e set status = 'cancelled'
        from public.subscription_periods p
        where p.entitlement_id = e.id and p.user_id = v_order.user_id
          and p.state = 'replaced' and p.closed_at = v_now
          and e.status = 'scheduled';
        update public.user_entitlements set
          status = 'expired', ends_at = least(coalesce(ends_at, v_now), v_now)
        where user_id = v_order.user_id and status = 'active' and id <> v_entitlement.id;
      end if;

      v_old_subscription := v_account.subscription_balance;
      if v_old_subscription > 0 then
        update public.credits set
          subscription_balance = 0,
          subscription_rollover_balance = 0,
          balance = purchased_balance,
          updated_at = now()
        where user_id = v_order.user_id returning * into v_account;
        insert into public.credit_transactions (
          user_id, transaction_type, amount, balance_after,
          idempotency_key, payload_hash, reason, metadata
        ) values (
          v_order.user_id, 'adjustment', -v_old_subscription, v_account.balance,
          'payment:' || v_order.id::text || ':subscription-reset',
          encode(sha256((v_order.id::text || ':subscription-reset')::bytea), 'hex'),
          case when v_current_plan = 'max' then 'subscription_period_replaced'
            else 'subscription_upgrade_replaced' end,
          jsonb_build_object(
            'payment_order_id', v_order.id,
            'source_bucket', 'subscription',
            'previous_plan_code', v_current_plan,
            'old_subscription_balance', v_old_subscription
          )
        );
      end if;

      -- Base grant is recorded by the common payment ledger insert below.
      update public.credits set
        subscription_balance = v_allowance,
        subscription_rollover_balance = 0,
        balance = purchased_balance + v_allowance,
        subscription_plan_code = v_plan_code,
        subscription_entitlement_id = v_entitlement.id,
        subscription_period_ends_at = v_entitlement.ends_at,
        lite_video_remaining = 0,
        lite_video_entitlement_id = null,
        updated_at = now()
      where user_id = v_order.user_id returning * into v_account;
    end if;
  else
    raise exception using errcode = '22023', message = 'INVALID_PAYMENT_ORDER_KIND';
  end if;

  v_hash := md5(v_order.id::text || ':' || v_order.user_id::text) ||
    md5(v_order.id::text || ':payment-grant');
  insert into public.credit_transactions (
    user_id, transaction_type, amount, balance_after,
    idempotency_key, payload_hash, reason, metadata
  ) values (
    v_order.user_id,
    'grant',
    case when v_scheduled then 0 else v_order.credits_amount end,
    v_account.balance,
    'payment:' || v_order.id::text,
    v_hash,
    case when v_scheduled then 'subscription_period_scheduled' else 'manual_payment_approved' end,
    jsonb_build_object(
      'payment_order_id', v_order.id,
      'payment_reference', v_order.payment_reference,
      'amount_dzd', v_order.amount_dzd,
      'plan_id', v_order.plan_id,
      'plan_name', v_order.plan_name,
      'plan_code', v_plan_code,
      'approved_by', p_actor_user_id,
      'lifecycle_type', v_lifecycle_type,
      'activation', case when v_scheduled then 'scheduled' else 'immediate' end,
      'scheduled_allowance', case when v_scheduled then v_order.credits_amount else 0 end,
      'source_bucket', case when v_order.order_kind = 'subscription' then 'subscription' else 'purchased' end
    )
  ) returning id into v_transaction_id;

  if v_max_rollover > 0 then
    update public.credits set
      subscription_balance = subscription_balance + v_max_rollover,
      subscription_rollover_balance = v_max_rollover,
      balance = balance + v_max_rollover,
      updated_at = now()
    where user_id = v_order.user_id returning * into v_account;
    insert into public.credit_transactions (
      user_id, transaction_type, amount, balance_after,
      idempotency_key, payload_hash, reason, metadata
    ) values (
      v_order.user_id, 'grant', v_max_rollover, v_account.balance,
      'payment:' || v_order.id::text || ':max-rollover',
      encode(sha256((v_order.id::text || ':max-rollover')::bytea), 'hex'),
      'max_subscription_rollover', jsonb_build_object(
        'payment_order_id', v_order.id,
        'source_bucket', 'subscription',
        'rollover_cap', 1500
      )
    );
  end if;

  if v_rollover > 0 then
    update public.credits set
      subscription_balance = subscription_balance + v_rollover,
      subscription_rollover_balance = v_rollover,
      balance = balance + v_rollover,
      updated_at = now()
    where user_id = v_order.user_id returning * into v_account;
    insert into public.credit_transactions (
      user_id, transaction_type, amount, balance_after,
      idempotency_key, payload_hash, reason, metadata
    ) values (
      v_order.user_id, 'grant', v_rollover, v_account.balance,
      'payment:' || v_order.id::text || ':rollover',
      encode(sha256((v_order.id::text || ':rollover')::bytea), 'hex'),
      'pro_subscription_rollover', jsonb_build_object(
        'payment_order_id', v_order.id,
        'subscription_period_id', v_period.id,
        'source_bucket', 'subscription',
        'rollover_cap', 600
      )
    );
  end if;

  update public.payment_orders set
    status = 'approved', reviewed_at = v_now, reviewed_by = p_actor_user_id,
    review_note = nullif(btrim(coalesce(p_review_note, '')), ''),
    resulting_credit_transaction_id = v_transaction_id,
    resulting_entitlement_id = v_entitlement_id
  where id = v_order.id;
  insert into public.payment_audit_log (
    payment_order_id, actor_user_id, action, previous_status, new_status, metadata
  ) values (
    v_order.id, p_actor_user_id, 'approved', 'pending', 'approved', jsonb_build_object(
      'credit_transaction_id', v_transaction_id,
      'entitlement_id', v_entitlement_id,
      'subscription_period_id', v_period.id,
      'lifecycle_type', v_lifecycle_type,
      'activation', case when v_scheduled then 'scheduled' else 'immediate' end,
      'subscription_rollover', v_rollover + v_max_rollover
    )
  );
  return jsonb_build_object(
    'payment_order_id', v_order.id,
    'status', 'approved',
    'credit_transaction_id', v_transaction_id,
    'entitlement_id', v_entitlement_id,
    'subscription_period_id', v_period.id,
    'lifecycle_type', v_lifecycle_type,
    'activation', case when v_scheduled then 'scheduled' else 'immediate' end,
    'subscription_rollover', v_rollover + v_max_rollover,
    'idempotent', false
  );
end;
$$;



-- Server access snapshots activate due periods without making the private
-- lifecycle function callable by customers. The application tolerates this
-- new RPC being absent until this migration is applied.
create or replace function public.activate_due_subscription_period_for_access(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) <> 'service_role' or p_user_id is null then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  perform public.refresh_subscription_lifecycle(p_user_id);
end;
$$;

-- Preserve private internal RPC access. Customer reads use the authenticated,
-- user-scoped get_user_plan_access() wrapper.
revoke all on function public.refresh_subscription_lifecycle(uuid) from public, anon, authenticated;
revoke all on function public.activate_due_subscription_period_for_access(uuid)
  from public, anon, authenticated;
grant execute on function public.activate_due_subscription_period_for_access(uuid) to service_role;
revoke all on function public.reserve_credits_v2_base(
  uuid, text, text, text, text, bigint, text, jsonb, jsonb, timestamptz
) from public, anon, authenticated;
revoke all on function public.get_user_plan_access() from public, anon;
grant execute on function public.get_user_plan_access() to authenticated, service_role;
revoke all on function public.get_current_model_plan() from public, anon;
grant execute on function public.get_current_model_plan() to authenticated, service_role;
revoke all on function public.reserve_model_trial_access(uuid,text,text,text,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_model_trial_access(uuid,text,text,text,text,text,uuid)
  to service_role;
revoke all on function public.approve_manual_payment(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.approve_manual_payment(uuid,uuid,text) to service_role;

notify pgrst, 'reload schema';

commit;
