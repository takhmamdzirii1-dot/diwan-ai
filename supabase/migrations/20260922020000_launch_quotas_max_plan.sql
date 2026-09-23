-- Launch quotas and MAX renewal economics (additive).
--
-- The chat-usage migration is already applied in production: this file only
-- upserts values and refines the MAX renewal path. No schema reshapes, no
-- history rewrites, no visibility changes.
--
-- 1. Final chat allowances (canonical source for Admin + Studio metering):
--    Free 120/800, Lite 200/1600, Pro 300/3000, Max 500/6500.
--    fallback_enabled is deliberately preserved per row.
-- 2. MAX renewal economics in approve_manual_payment: 7,500 base,
--    up to 1,500 subscription-only rollover (top-up excluded structurally),
--    9,000 subscription-balance cap at new-period start. Lite/Pro paths,
--    checkout, fulfillment, trial, paywall, and routing are unchanged.
--
-- NOTE: the MAX catalog value update lives in
-- 20260922030000_frozen_max_launch_config.sql. The MAX payment_plans row is
-- frozen, and its BEFORE trigger rejects direct commercial updates, so the
-- catalog change runs there under a transaction-scoped, single-token guard.

begin;

-- 1. Canonical chat allowances.
insert into public.chat_plan_limits (plan_code, five_hour_limit, weekly_limit, fallback_enabled)
values
  ('free', 120, 800, false),
  ('lite', 200, 1600, false),
  ('pro', 300, 3000, false),
  ('max', 500, 6500, false)
on conflict (plan_code) do update set
  five_hour_limit = excluded.five_hour_limit,
  weekly_limit = excluded.weekly_limit,
  updated_at = now();

-- 2. MAX renewal economics (surgical redefinition; Lite/Pro paths byte-identical).

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
  v_now timestamptz := clock_timestamp();
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
      -- MAX final launch economics: 7,500 base allowance per paid period,
      -- up to 1,500 subscription-only rollover carried into the new period
      -- (top-up purchased balances never count), 9,000 subscription-balance
      -- cap at period start. Historical order snapshots stay frozen; only
      -- the renewal math changes.
      v_max_rollover := least(
        greatest(v_account.subscription_balance - v_account.subscription_rollover_balance, 0),
        1500);
      if v_current_plan in ('lite', 'pro') then
        v_old_subscription := v_account.subscription_balance;
        update public.subscription_periods set
          state = 'replaced', eligible_unused_at_close = 0, closed_at = v_now
        where user_id = v_order.user_id and state in ('active', 'scheduled');
        update public.user_entitlements set
          status = 'expired', ends_at = least(coalesce(ends_at, v_now), v_now)
        where user_id = v_order.user_id and status = 'active' and id <> v_entitlement.id;
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
        update public.credits set
          subscription_balance = 0, subscription_rollover_balance = 0,
          balance = purchased_balance
        where user_id = v_order.user_id returning * into v_account;
      end if;
      update public.credits set
        subscription_balance = least(v_allowance + v_max_rollover, 9000),
        subscription_rollover_balance = v_max_rollover,
        balance = purchased_balance + least(v_allowance + v_max_rollover, 9000),
        subscription_plan_code = v_plan_code,
        subscription_entitlement_id = v_entitlement.id,
        subscription_period_ends_at = v_entitlement.ends_at,
        lite_video_remaining = 0,
        lite_video_entitlement_id = null,
        updated_at = now()
      where user_id = v_order.user_id returning * into v_account;
      if v_max_rollover > 0 then
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

commit;
