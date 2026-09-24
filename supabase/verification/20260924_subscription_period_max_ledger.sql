-- READ ONLY. Run the BEFORE section before applying
-- 20260924020000_fix_subscription_period_and_max_ledger.sql.

-- BEFORE 1: future entitlements tied to scheduled or replaced periods.
select e.id as entitlement_id, e.user_id, e.status, e.starts_at, e.ends_at,
  p.id as period_id, p.state as period_state, p.period_starts_at
from public.user_entitlements e
join public.subscription_periods p on p.entitlement_id = e.id
where e.starts_at > now() and p.state in ('scheduled', 'replaced')
order by e.starts_at, e.user_id;

-- BEFORE 2: historical MAX approvals needing manual ledger/rollover review.
-- A missing reset with positive rollover is a definite ledger gap. A missing
-- reset on other same-plan renewals is only a candidate: old balance may be 0.
select o.id as payment_order_id, o.user_id, o.reviewed_at,
  g.metadata->>'lifecycle_type' as lifecycle_type,
  r.amount as max_rollover, reset.amount as subscription_reset,
  case
    when g.metadata->>'lifecycle_type' = 'upgrade' and r.id is not null
      then 'lower_plan_rollover'
    when r.amount > 0 and reset.id is null then 'definite_missing_reset'
    when g.metadata->>'lifecycle_type' = 'same_plan_renewal' and reset.id is null
      then 'review_old_balance'
  end as review_reason
from public.payment_orders o
join public.credit_transactions g on g.id = o.resulting_credit_transaction_id
left join public.credit_transactions r on r.user_id = o.user_id
  and r.transaction_type = 'grant'
  and r.idempotency_key = 'payment:' || o.id::text || ':max-rollover'
left join public.credit_transactions reset on reset.user_id = o.user_id
  and reset.transaction_type = 'adjustment'
  and reset.idempotency_key = 'payment:' || o.id::text || ':subscription-reset'
where o.status = 'approved' and o.order_kind = 'subscription'
  and g.metadata->>'plan_code' = 'max'
  and (
    (g.metadata->>'lifecycle_type' = 'upgrade' and r.id is not null)
    or (g.metadata->>'lifecycle_type' = 'same_plan_renewal' and reset.id is null)
  )
order by o.reviewed_at desc;

-- BEFORE 3: pending MAX snapshots that would exceed the existing 9,000
-- subscription start cap and will fail closed after the migration.
select o.id, o.user_id, o.credits_amount,
  o.entitlement->>'subscription_credit_allowance' as snapshotted_allowance
from public.payment_orders o
join public.payment_plans p on p.id = o.plan_id
where o.status = 'pending' and o.order_kind = 'subscription'
  and p.plan_code = 'max' and o.credits_amount > 9000;

-- AFTER applying the migration, run the following read-only checks.

-- AFTER 1: no future entitlement for a scheduled or replaced period is active.
select p.state, count(*) as incorrectly_active
from public.user_entitlements e
join public.subscription_periods p on p.entitlement_id = e.id
where e.starts_at > now() and e.status = 'active'
  and p.state in ('scheduled', 'replaced')
group by p.state;

-- AFTER 2: customer roles cannot call the server activation helper.
select
  has_function_privilege('authenticated',
    'public.activate_due_subscription_period_for_access(uuid)', 'EXECUTE')
    as authenticated_can_activate,
  has_function_privilege('service_role',
    'public.activate_due_subscription_period_for_access(uuid)', 'EXECUTE')
    as service_role_can_activate;

-- AFTER 3: verify newly approved MAX orders after the migration. Compare
-- reviewed_at with your migration application time; older rows are not repaired.
select o.id as payment_order_id, o.reviewed_at,
  g.metadata->>'lifecycle_type' as lifecycle_type,
  reset.amount as reset_delta, reset.balance_after as balance_after_reset,
  g.amount as base_grant, g.balance_after as balance_after_base,
  r.amount as rollover_grant, r.balance_after as balance_after_rollover,
  (reset.id is null or g.balance_after = reset.balance_after + g.amount)
    as base_reconciles,
  (r.id is null or r.balance_after = g.balance_after + r.amount)
    as rollover_reconciles
from public.payment_orders o
join public.credit_transactions g on g.id = o.resulting_credit_transaction_id
left join public.credit_transactions reset on reset.user_id = o.user_id
  and reset.transaction_type = 'adjustment'
  and reset.idempotency_key = 'payment:' || o.id::text || ':subscription-reset'
left join public.credit_transactions r on r.user_id = o.user_id
  and r.transaction_type = 'grant'
  and r.idempotency_key = 'payment:' || o.id::text || ':max-rollover'
where o.status = 'approved' and o.order_kind = 'subscription'
  and g.metadata->>'plan_code' = 'max'
order by o.reviewed_at desc
limit 50;
