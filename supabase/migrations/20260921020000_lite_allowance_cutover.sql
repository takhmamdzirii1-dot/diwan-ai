-- Final Lite catalog cutover: configurable Credits and included Videos.
-- Existing orders, periods, balances, and ledger entries remain immutable;
-- only newly created orders snapshot this configuration.
begin;

alter table public.payment_plans
  add column if not exists included_video_allowance smallint;

-- Avoid attributing migration-owned catalog configuration to the last owner.
alter table public.payment_plans disable trigger payment_plan_admin_audit;

do $migration$
declare
  v_lite_plan_count integer;
begin
  select count(*) into v_lite_plan_count
  from public.payment_plans
  where plan_code = 'lite';

  if v_lite_plan_count <> 1 then
    raise exception 'Expected exactly one Lite payment plan, found %', v_lite_plan_count;
  end if;

end;
$migration$;

update public.payment_plans
set
  price_dzd = 2000,
  unified_credits = 600,
  subscription_credit_allowance = 600,
  included_video_allowance = 4
where plan_code = 'lite';

alter table public.payment_plans enable trigger payment_plan_admin_audit;

alter table public.payment_plans
  drop constraint if exists payment_plans_included_video_allowance_check,
  add constraint payment_plans_included_video_allowance_check check (
    (plan_code = 'lite' and included_video_allowance between 0 and 4)
    or (plan_code is distinct from 'lite' and included_video_allowance is null)
  );

create or replace function public.create_manual_payment_order(p_plan_id uuid, p_payment_method text)
returns public.payment_orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_plan public.payment_plans%rowtype;
  v_order public.payment_orders%rowtype;
  v_reference text;
  v_entitlement jsonb;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED'; end if;
  if p_payment_method not in ('baridimob', 'ccp') then
    raise exception using errcode = '22023', message = 'PAYMENT_METHOD_UNAVAILABLE';
  end if;

  select * into v_plan from public.payment_plans where id = p_plan_id and active = true;
  if not found then raise exception using errcode = '22023', message = 'PAYMENT_PLAN_UNAVAILABLE'; end if;

  if v_plan.kind = 'credit_pack' and not exists (
    select 1 from public.user_entitlements entitlement
    join public.payment_plans active_plan on active_plan.id = entitlement.plan_id
    where entitlement.user_id = v_user_id
      and entitlement.status = 'active'
      and entitlement.starts_at <= now()
      and (entitlement.ends_at is null or entitlement.ends_at > now())
      and active_plan.plan_code in ('lite', 'pro', 'max')
  ) then
    raise exception using errcode = '42501', message = 'ACTIVE_PAID_PLAN_REQUIRED';
  elsif v_plan.frozen and v_plan.plan_code = 'max' then
    null;
  elsif v_plan.eligibility_required and not exists (
    select 1
    from public.user_entitlements entitlement
    join public.payment_plans prior_plan on prior_plan.id = entitlement.plan_id
    where entitlement.user_id = v_user_id
      and prior_plan.plan_code in ('lite', 'pro', 'max')
  ) then
    raise exception using errcode = '42501', message = 'PAYMENT_PLAN_NOT_ELIGIBLE';
  end if;

  v_entitlement := v_plan.entitlement || jsonb_strip_nulls(jsonb_build_object(
    'plan_code', v_plan.plan_code,
    'access_period_days', v_plan.access_period_days,
    'subscription_credit_allowance', v_plan.subscription_credit_allowance,
    'included_video_allowance', v_plan.included_video_allowance
  ));
  v_reference := 'VAN-' || to_char(clock_timestamp(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.payment_orders (
    user_id, plan_id, order_kind, plan_name, plan_description, payment_method,
    amount_dzd, credits_amount, entitlement, payment_reference, status
  ) values (
    v_user_id, v_plan.id, v_plan.kind, v_plan.name, v_plan.description, p_payment_method,
    v_plan.price_dzd, v_plan.unified_credits, v_entitlement, v_reference, 'draft'
  ) returning * into v_order;
  insert into public.payment_audit_log (payment_order_id, actor_user_id, action, new_status)
    values (v_order.id, v_user_id, 'created', 'draft');
  return v_order;
end;
$$;

create or replace function public.refresh_subscription_lifecycle(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.credits%rowtype;
  v_period public.subscription_periods%rowtype;
  v_previous public.subscription_periods%rowtype;
  v_expired_amount bigint;
  v_eligible_unused bigint;
  v_rollover bigint;
  v_expired_entitlement_id uuid;
begin
  select * into v_account from public.credits where user_id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CREDIT_ACCOUNT_NOT_FOUND';
  end if;

  loop
    if v_account.subscription_period_ends_at is not null
      and v_account.subscription_period_ends_at <= now()
    then
      v_expired_amount := v_account.subscription_balance;
      v_expired_entitlement_id := v_account.subscription_entitlement_id;
      v_eligible_unused := greatest(
        v_account.subscription_balance - v_account.subscription_rollover_balance, 0
      );

      select * into v_period
      from public.subscription_periods
      where user_id = p_user_id
        and entitlement_id = v_account.subscription_entitlement_id
        and state = 'active'
      for update;

      if found then
        update public.subscription_periods set
          state = 'expired',
          eligible_unused_at_close = v_eligible_unused,
          closed_at = v_period.period_ends_at
        where id = v_period.id;
      end if;

      update public.user_entitlements set
        status = 'expired', ends_at = least(coalesce(ends_at, now()), now())
      where id = v_account.subscription_entitlement_id
        and ends_at <= now();

      update public.credits set
        subscription_balance = 0,
        subscription_rollover_balance = 0,
        balance = purchased_balance,
        subscription_plan_code = null,
        subscription_entitlement_id = null,
        subscription_period_ends_at = null,
        lite_video_remaining = 0,
        lite_video_entitlement_id = null,
        updated_at = now()
      where user_id = p_user_id
      returning * into v_account;

      if v_expired_amount > 0 then
        insert into public.credit_transactions (
          user_id, transaction_type, amount, balance_after,
          idempotency_key, payload_hash, reason, metadata
        ) values (
          p_user_id, 'adjustment', -v_expired_amount, v_account.balance,
          'subscription-expired:' || coalesce(v_period.id::text, 'legacy-' ||
            coalesce(v_expired_entitlement_id::text, 'unknown')),
          encode(sha256(('subscription-expired:' || p_user_id::text || ':' ||
            coalesce(v_period.id::text, v_expired_entitlement_id::text, 'legacy'))::bytea), 'hex'),
          'subscription_period_expired',
          jsonb_build_object('source_bucket', 'subscription', 'eligible_unused', v_eligible_unused)
        ) on conflict (user_id, transaction_type, idempotency_key) do nothing;
      end if;
    end if;

    select * into v_period
    from public.subscription_periods
    where user_id = p_user_id
      and state = 'scheduled'
      and period_starts_at <= now()
    order by period_starts_at, created_at
    limit 1
    for update;

    if not found then exit; end if;

    v_rollover := 0;
    if v_period.plan_code = 'pro' then
      select * into v_previous
      from public.subscription_periods
      where user_id = p_user_id
        and plan_code = 'pro'
        and state = 'expired'
        and period_ends_at <= v_period.period_starts_at
        and period_ends_at >= v_period.period_starts_at - interval '30 days'
      order by period_ends_at desc
      limit 1;
      if found then
        v_rollover := least(v_previous.eligible_unused_at_close, 600);
      end if;
    end if;

    update public.subscription_periods set
      state = 'active', rollover_amount = v_rollover, activated_at = now()
    where id = v_period.id;
    update public.user_entitlements set status = 'active'
    where id = v_period.entitlement_id;
    update public.credits set
      subscription_balance = v_period.base_allowance,
      subscription_rollover_balance = 0,
      balance = purchased_balance + v_period.base_allowance,
      subscription_plan_code = v_period.plan_code,
      subscription_entitlement_id = v_period.entitlement_id,
      subscription_period_ends_at = v_period.period_ends_at,
      lite_video_remaining = case when v_period.plan_code = 'lite' then v_period.included_videos else 0 end,
      lite_video_entitlement_id = case when v_period.plan_code = 'lite'
        then v_period.entitlement_id else null end,
      updated_at = now()
    where user_id = p_user_id
    returning * into v_account;

    insert into public.credit_transactions (
      user_id, transaction_type, amount, balance_after,
      idempotency_key, payload_hash, reason, metadata
    ) values (
      p_user_id, 'grant', v_period.base_allowance, v_account.balance,
      'payment:' || v_period.payment_order_id::text || ':period-activation',
      encode(sha256((v_period.payment_order_id::text || ':period-activation')::bytea), 'hex'),
      'subscription_period_activated', jsonb_build_object(
        'payment_order_id', v_period.payment_order_id,
        'subscription_period_id', v_period.id,
        'plan_code', v_period.plan_code,
        'source_bucket', 'subscription'
      )
    ) on conflict (user_id, transaction_type, idempotency_key) do nothing;

    if v_rollover > 0 then
      update public.credits set
        subscription_balance = subscription_balance + v_rollover,
        subscription_rollover_balance = v_rollover,
        balance = balance + v_rollover,
        updated_at = now()
      where user_id = p_user_id
      returning * into v_account;
      insert into public.credit_transactions (
        user_id, transaction_type, amount, balance_after,
        idempotency_key, payload_hash, reason, metadata
      ) values (
        p_user_id, 'grant', v_rollover, v_account.balance,
        'payment:' || v_period.payment_order_id::text || ':rollover',
        encode(sha256((v_period.payment_order_id::text || ':rollover')::bytea), 'hex'),
        'pro_subscription_rollover', jsonb_build_object(
          'payment_order_id', v_period.payment_order_id,
          'subscription_period_id', v_period.id,
          'source_bucket', 'subscription',
          'rollover_cap', 600
        )
      ) on conflict (user_id, transaction_type, idempotency_key) do nothing;
    end if;

    -- Re-read because this period may also be past due when multiple prepaid
    -- periods are activated lazily in one transaction.
    select * into v_account from public.credits where user_id = p_user_id for update;
  end loop;
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
      -- MAX values and same-plan behavior stay exactly as snapshotted. An
      -- upgrade only removes the lower-plan allowance before the MAX grant.
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
        subscription_balance = subscription_balance + v_order.credits_amount,
        balance = balance + v_order.credits_amount,
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
      'subscription_rollover', v_rollover
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
    'subscription_rollover', v_rollover,
    'idempotent', false
  );
end;
$$;

create or replace function public.audit_payment_plan_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := case when tg_op = 'INSERT' then new.updated_by else coalesce(new.updated_by, old.updated_by) end;
begin
  if v_actor is not null then
    perform public.write_admin_audit(
      v_actor,
      case when tg_op = 'INSERT' then 'plan_created'
        when old.active and not new.active then 'plan_archived'
        else 'plan_updated' end,
      'plan', new.id::text,
      case when tg_op = 'INSERT' then null else jsonb_build_object(
        'name', old.name, 'kind', old.kind, 'price_dzd', old.price_dzd,
        'unified_credits', old.unified_credits,
        'subscription_credit_allowance', old.subscription_credit_allowance,
        'included_video_allowance', old.included_video_allowance, 'active', old.active,
        'display_order', old.display_order, 'featured', old.featured
      ) end,
      jsonb_build_object(
        'name', new.name, 'kind', new.kind, 'price_dzd', new.price_dzd,
        'unified_credits', new.unified_credits,
        'subscription_credit_allowance', new.subscription_credit_allowance,
        'included_video_allowance', new.included_video_allowance, 'active', new.active,
        'display_order', new.display_order, 'featured', new.featured
      )
    );
  end if;
  return new;
end;
$$;

comment on column public.payment_plans.included_video_allowance is
  'Lite included-video allowance snapshotted into new payment orders.';

commit;
