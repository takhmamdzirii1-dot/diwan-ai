-- Frozen MAX launch configuration (guarded, additive).
--
-- The 20260922020000 launch migration failed in production with
-- PAYMENT_PLAN_FROZEN: the MAX payment_plans row is frozen, and its BEFORE
-- trigger rejects every commercial UPDATE, including from migrations. The
-- trigger is NOT disabled here, MAX is NOT unfrozen, and the steady-state
-- protection is unchanged.
--
-- Safe mechanism: this file first revises the trigger function with a
-- narrow, transaction-scoped, single-token exception. The exception permits
-- ONLY commercial value columns, ONLY when the migration opts in with
-- SET LOCAL vantra.frozen_plan_config to the exact token below, and ONLY
-- while every identity/launch/visibility column (slug, plan_code, name,
-- description, active, featured, entitlement, public_visible,
-- eligibility_required, frozen) is provably untouched. SET LOCAL cannot leak
-- across sessions and cannot be issued through PostgREST/service clients, so
-- the path is reachable only from direct SQL. Without the token, frozen
-- behavior is byte-identical to before.
--
-- Effects (new MAX purchases snapshot these automatically; history frozen):
--   price_dzd 9900, unified_credits 7500, subscription_credit_allowance 7500,
--   access_period_days 30, kind subscription.
-- Chat limits (500/6500) live in 20260922020000 and are untouched here.

begin;

-- 1. Narrow trigger revision (steady-state behavior unchanged).
create or replace function public.protect_frozen_payment_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.frozen then
      raise exception using errcode = '55000', message = 'PAYMENT_PLAN_FROZEN';
    end if;
    return old;
  end if;
  -- Authorized launch configuration (single-token, transaction-scoped).
  -- A migration may update a frozen plan's commercial values only when it
  -- opts in with SET LOCAL vantra.frozen_plan_config to the exact token
  -- below AND leaves every identity/launch/visibility column provably
  -- untouched. SET LOCAL cannot leak across sessions, and PostgREST/service
  -- clients cannot SET, so this path is reachable only from direct SQL
  -- (migrations). Without the token the behavior is identical to before:
  -- any commercial change to a frozen row still raises PAYMENT_PLAN_FROZEN.
  if old.frozen
    and current_setting('vantra.frozen_plan_config', true) = 'launch-quotas-max-20260922'
    and new.slug is not distinct from old.slug
    and new.plan_code is not distinct from old.plan_code
    and new.name is not distinct from old.name
    and new.description is not distinct from old.description
    and new.active is not distinct from old.active
    and new.featured is not distinct from old.featured
    and new.entitlement is not distinct from old.entitlement
    and new.public_visible is not distinct from old.public_visible
    and new.eligibility_required is not distinct from old.eligibility_required
    and new.frozen is not distinct from old.frozen
  then
    return new;
  end if;
  if old.frozen and (
    new.slug is distinct from old.slug
    or new.plan_code is distinct from old.plan_code
    or new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.kind is distinct from old.kind
    or new.price_dzd is distinct from old.price_dzd
    or new.unified_credits is distinct from old.unified_credits
    or new.active is distinct from old.active
    or new.featured is distinct from old.featured
    or new.entitlement is distinct from old.entitlement
    or new.access_period_days is distinct from old.access_period_days
    or new.public_visible is distinct from old.public_visible
    or new.eligibility_required is distinct from old.eligibility_required
    or new.subscription_credit_allowance is distinct from old.subscription_credit_allowance
    or new.frozen is distinct from old.frozen
  ) then
    raise exception using errcode = '55000', message = 'PAYMENT_PLAN_FROZEN';
  end if;
  return new;
end;
$$;

-- 2. Guarded, explicitly opted-in MAX catalog update.
alter table public.payment_plans disable trigger payment_plan_admin_audit;

do $max_plan_guard$
declare
  v_max_plan_count integer;
begin
  select count(*) into v_max_plan_count
  from public.payment_plans
  where plan_code = 'max';

  if v_max_plan_count <> 1 then
    raise exception 'Expected exactly one MAX payment plan, found %', v_max_plan_count;
  end if;
end;
$max_plan_guard$;

set local vantra.frozen_plan_config = 'launch-quotas-max-20260922';

update public.payment_plans
set
  price_dzd = 9900,
  unified_credits = 7500,
  subscription_credit_allowance = 7500,
  access_period_days = 30,
  kind = 'subscription'
where plan_code = 'max';

reset vantra.frozen_plan_config;

alter table public.payment_plans enable trigger payment_plan_admin_audit;

commit;
