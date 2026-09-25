begin;

-- New orders snapshot this optional per-pack limit from payment_plans.entitlement.
-- Existing order snapshots and approved ledger entries remain unchanged.
create or replace function public.guard_plan_top_up_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_period_start timestamptz;
  v_global_count integer;
  v_pack_count integer;
  v_pack_plan text;
  v_limit_text text;
  v_pack_limit integer;
begin
  if new.order_kind <> 'credit_pack' then return new; end if;
  if tg_op = 'UPDATE' and (new.status <> 'approved' or old.status = 'approved') then return new; end if;

  select plan.plan_code, entitlement.starts_at into v_plan, v_period_start
  from public.user_entitlements entitlement
  join public.payment_plans plan on plan.id = entitlement.plan_id
  where entitlement.user_id = new.user_id and entitlement.status = 'active'
    and entitlement.starts_at <= now()
    and (entitlement.ends_at is null or entitlement.ends_at > now())
    and plan.plan_code in ('lite', 'pro', 'max')
  order by entitlement.starts_at desc limit 1 for update of entitlement;
  if v_plan is null then
    raise exception using errcode = '42501', message = 'ACTIVE_PAID_PLAN_REQUIRED';
  end if;
  v_pack_plan := new.entitlement->>'top_up_plan_code';
  if v_pack_plan is distinct from v_plan then
    raise exception using errcode = '42501', message = 'TOP_UP_PLAN_NOT_ELIGIBLE';
  end if;

  v_limit_text := new.entitlement->>'top_up_purchase_limit_per_period';
  if v_limit_text is not null then
    if v_limit_text !~ '^[1-9][0-9]{0,3}$' or v_limit_text::integer > 1000 then
      raise exception using errcode = '22023', message = 'INVALID_TOP_UP_LIMIT';
    end if;
    v_pack_limit := v_limit_text::integer;
  end if;

  if v_plan = 'lite' then
    select count(*) into v_global_count from public.payment_orders payment_order
    where payment_order.user_id = new.user_id and payment_order.order_kind = 'credit_pack'
      and payment_order.status = 'approved' and payment_order.reviewed_at >= v_period_start;
    if v_global_count >= 2 then
      raise exception using errcode = '42501', message = 'LITE_TOP_UP_LIMIT_REACHED';
    end if;
  end if;
  if v_pack_limit is not null then
    select count(*) into v_pack_count from public.payment_orders payment_order
    where payment_order.user_id = new.user_id and payment_order.plan_id = new.plan_id
      and payment_order.order_kind = 'credit_pack' and payment_order.status = 'approved'
      and payment_order.reviewed_at >= v_period_start;
    if v_pack_count >= v_pack_limit then
      raise exception using errcode = '42501', message = 'TOP_UP_PACK_LIMIT_REACHED';
    end if;
  end if;
  return new;
end;
$$;

commit;
