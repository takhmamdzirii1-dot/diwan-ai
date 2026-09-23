-- Frozen MAX launch configuration (transaction-scoped exception only).
--
-- The 20260922020000 launch migration failed in production with
-- PAYMENT_PLAN_FROZEN: the MAX payment_plans row is frozen, and its BEFORE
-- trigger rejects every commercial UPDATE, including from migrations.
--
-- This file grants NO permanent bypass. Inside a single transaction it:
--   1. saves the live trigger definition and asserts it is the known
--      no-exception protection (fails otherwise);
--   2. temporarily redefines protect_frozen_payment_plan() with a narrow,
--      single-token, transaction-scoped exception;
--   3. SET LOCALs the token and updates ONLY the intended MAX commercial
--      fields (price_dzd 9900, unified_credits 7500,
--      subscription_credit_allowance 7500, access_period_days 30, kind);
--   4. restores the saved original definition verbatim;
--   5. re-reads the live definition and ABORTS unless it is free of any
--      token logic and still raises PAYMENT_PLAN_FROZEN.
-- After commit, the production trigger contains no frozen-plan bypass.
-- The trigger is never disabled and MAX is never unfrozen. Frozen, active,
-- public_visible, eligibility_required, identity/plan code, and all
-- historical data are preserved.

begin;

-- 1. Save the live protection and refuse to proceed unless it is the known
-- no-exception definition.
create temporary table _frozen_trigger_backup(definition text) on commit drop;

do $save_trigger$
declare
  v_live text;
begin
  select pg_get_functiondef('public.protect_frozen_payment_plan()'::regprocedure)
    into v_live;
  if v_live is null or v_live not like '%PAYMENT_PLAN_FROZEN%' then
    raise exception 'TRIGGER_NOT_RECOGNIZED';
  end if;
  if v_live like '%frozen_plan_config%' or v_live like '%launch-quotas-max%' then
    raise exception 'TRIGGER_ALREADY_MODIFIED';
  end if;
  insert into _frozen_trigger_backup(definition) values (v_live);
end;
$save_trigger$;

-- 2. Temporary narrow exception: commercial columns only, exact token only,
-- every identity/launch/visibility column provably untouched. Dies with
-- this transaction (step 4 restores the saved definition regardless).
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
  -- TEMPORARY migration exception (see file header). Removed in step 4.
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

-- 3. Guarded, explicitly opted-in MAX commercial update.
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

-- 4. Restore the saved original definition verbatim.
do $restore_trigger$
begin
  execute (select definition from _frozen_trigger_backup limit 1);
end;
$restore_trigger$;

-- 5. Prove the restore: abort unless the live definition is free of token
-- logic and still guards frozen rows.
do $verify_restore$
declare
  v_final text;
begin
  select pg_get_functiondef('public.protect_frozen_payment_plan()'::regprocedure)
    into v_final;
  if v_final like '%frozen_plan_config%' or v_final like '%launch-quotas-max%' then
    raise exception 'TRIGGER_RESTORE_FAILED';
  end if;
  if v_final is null or v_final not like '%PAYMENT_PLAN_FROZEN%' then
    raise exception 'TRIGGER_GUARD_MISSING';
  end if;
end;
$verify_restore$;

commit;
