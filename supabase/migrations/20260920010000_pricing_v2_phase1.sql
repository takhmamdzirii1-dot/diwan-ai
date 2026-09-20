-- Pricing V2, phase 1: authoritative catalog visibility and manual access periods.
-- Existing payment snapshots, balances, and MAX commercial values remain unchanged.

begin;

alter table public.payment_plans
  add column if not exists plan_code text,
  add column if not exists access_period_days integer,
  add column if not exists public_visible boolean not null default true,
  add column if not exists eligibility_required boolean not null default false,
  add column if not exists subscription_credit_allowance bigint,
  add column if not exists frozen boolean not null default false;

alter table public.payment_plans
  drop constraint if exists payment_plans_plan_code_check,
  add constraint payment_plans_plan_code_check
    check (plan_code is null or plan_code ~ '^[a-z0-9_]{1,80}$'),
  drop constraint if exists payment_plans_access_period_days_check,
  add constraint payment_plans_access_period_days_check
    check (access_period_days is null or access_period_days between 1 and 3650),
  drop constraint if exists payment_plans_subscription_credit_allowance_check,
  add constraint payment_plans_subscription_credit_allowance_check
    check (subscription_credit_allowance is null or subscription_credit_allowance >= 0),
  drop constraint if exists payment_plans_price_dzd_check,
  add constraint payment_plans_price_dzd_check check (price_dzd >= 0),
  drop constraint if exists payment_plans_unified_credits_check,
  add constraint payment_plans_unified_credits_check check (unified_credits >= 0);

create unique index if not exists payment_plans_plan_code_key
  on public.payment_plans (plan_code) where plan_code is not null;
create index if not exists payment_plans_public_order_idx
  on public.payment_plans (public_visible, display_order, created_at);

-- Avoid attributing migration-owned catalog normalization to the last human editor.
alter table public.payment_plans disable trigger payment_plan_admin_audit;

-- Preserve the historical slugs used by existing orders. plan_code is the stable
-- business identity going forward.
update public.payment_plans
set plan_code = 'pro',
    price_dzd = 5000,
    unified_credits = 3000,
    kind = 'subscription',
    active = true,
    public_visible = true,
    eligibility_required = false,
    access_period_days = 30,
    subscription_credit_allowance = 3000
where lower(name) = 'pro' and plan_code is null;

update public.payment_plans
set plan_code = 'max', frozen = true
where lower(name) = 'max' and plan_code is null;

insert into public.payment_plans (
  slug, plan_code, name, description, kind, price_dzd, unified_credits,
  active, display_order, featured, entitlement, access_period_days,
  public_visible, eligibility_required, subscription_credit_allowance, frozen
) values (
  'free', 'free', 'Free', null, 'subscription', 0, 0,
  false, -10, false, '{"plan_code":"free"}'::jsonb, null,
  true, false, 0, false
)
on conflict (slug) do update set
  plan_code = 'free', name = 'Free', kind = 'subscription', price_dzd = 0,
  unified_credits = 0, active = false, public_visible = true,
  eligibility_required = false, subscription_credit_allowance = 0;

insert into public.payment_plans (
  slug, plan_code, name, description, kind, price_dzd, unified_credits,
  active, display_order, featured, entitlement, access_period_days,
  public_visible, eligibility_required, subscription_credit_allowance, frozen
) values (
  'lite', 'lite', 'Lite', null, 'subscription', 2000, 850,
  true, 5, false, '{"plan_code":"lite"}'::jsonb, 30,
  false, true, 850, false
)
on conflict (slug) do update set
  plan_code = 'lite', name = 'Lite', kind = 'subscription', price_dzd = 2000,
  unified_credits = 850, active = true, access_period_days = 30,
  public_visible = false, eligibility_required = true,
  subscription_credit_allowance = 850;

alter table public.payment_plans enable trigger payment_plan_admin_audit;

-- Existing active Pro access receives the same 30-day term from its original
-- approval time. No balance or payment snapshot is changed.
update public.user_entitlements entitlement
set ends_at = entitlement.starts_at + interval '30 days'
from public.payment_plans plan
where entitlement.plan_id = plan.id
  and plan.plan_code = 'pro'
  and entitlement.status = 'active'
  and entitlement.ends_at is null;

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

  if v_plan.frozen and v_plan.plan_code = 'max' then
    -- MAX remains purchasable exactly as configured before Pricing V2.
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
    'subscription_credit_allowance', v_plan.subscription_credit_allowance
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

-- Apply an immutable order's access-period snapshot when approval inserts the
-- entitlement. An advisory lock serializes same-user, same-plan renewals.
create or replace function public.apply_entitlement_access_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer;
  v_current_end timestamptz;
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

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':' || new.plan_id::text, 0));
  select max(entitlement.ends_at) into v_current_end
  from public.user_entitlements entitlement
  where entitlement.user_id = new.user_id
    and entitlement.plan_id = new.plan_id
    and entitlement.status = 'active'
    and entitlement.ends_at > now();

  new.starts_at := coalesce(new.starts_at, now());
  new.ends_at := greatest(now(), coalesce(v_current_end, now())) + make_interval(days => v_days);
  new.status := 'active';
  return new;
end;
$$;

drop trigger if exists user_entitlement_access_period on public.user_entitlements;
create trigger user_entitlement_access_period
  before insert on public.user_entitlements
  for each row execute function public.apply_entitlement_access_period();

create or replace function public.get_user_plan_access()
returns table (
  plan_code text,
  plan_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  access_state text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select plan.plan_code, entitlement.plan_name, entitlement.starts_at, entitlement.ends_at,
    case
      when entitlement.ends_at is not null and entitlement.ends_at <= now() then 'EXPIRED'
      when entitlement.ends_at is not null and entitlement.ends_at <= now() + interval '7 days' then 'EXPIRING_SOON'
      else 'ACTIVE'
    end
  from public.user_entitlements entitlement
  join public.payment_plans plan on plan.id = entitlement.plan_id
  where entitlement.user_id = (select auth.uid())
    and entitlement.status in ('active', 'expired')
  order by entitlement.starts_at desc, entitlement.created_at desc
  limit 1;
$$;

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

drop trigger if exists protect_frozen_payment_plan on public.payment_plans;
create trigger protect_frozen_payment_plan
  before update or delete on public.payment_plans
  for each row execute function public.protect_frozen_payment_plan();

revoke all on function public.apply_entitlement_access_period() from public, anon, authenticated;
revoke all on function public.get_user_plan_access() from public, anon;
grant execute on function public.get_user_plan_access() to authenticated;

comment on column public.payment_plans.plan_code is 'Stable business plan identity; historical slugs remain unchanged.';
comment on column public.payment_plans.public_visible is 'Controls generic public catalog visibility; purchase eligibility is separately enforced server-side.';
comment on column public.payment_plans.subscription_credit_allowance is 'Subscription credit allowance snapshotted into new payment orders.';
comment on function public.get_user_plan_access() is 'Derived manual-access state: ACTIVE, EXPIRING_SOON, or EXPIRED. No auto-renewal semantics.';

commit;
