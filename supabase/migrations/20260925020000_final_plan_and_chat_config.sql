-- Future catalog only. Historical order snapshots and credit ledger are immutable.
begin;

insert into public.chat_plan_limits(plan_code,five_hour_limit,weekly_limit,fallback_enabled)
values ('free',120,800,false),('lite',200,1600,false),
  ('pro',300,3000,false),('max',600,6500,false)
on conflict(plan_code) do update set five_hour_limit=excluded.five_hour_limit,
  weekly_limit=excluded.weekly_limit, updated_at=now();

alter table public.payment_plans disable trigger payment_plan_admin_audit;
update public.payment_plans set price_dzd=0,unified_credits=0,
  subscription_credit_allowance=0,active=false,public_visible=true
  where plan_code='free';
update public.payment_plans set price_dzd=2000,unified_credits=600,
  subscription_credit_allowance=600,included_video_allowance=4,
  access_period_days=30,public_visible=false
  where plan_code='lite';
update public.payment_plans set price_dzd=5000,unified_credits=3000,
  subscription_credit_allowance=3000,access_period_days=30,public_visible=true
  where plan_code='pro';
alter table public.payment_plans enable trigger payment_plan_admin_audit;

-- MAX remains frozen. Permit only this exact price change inside this
-- transaction, then restore the original trigger definition verbatim.
create temporary table _max_frozen_guard(definition text) on commit drop;
do $save_guard$ declare v_definition text;
begin
  select pg_get_functiondef('public.protect_frozen_payment_plan()'::regprocedure)
    into v_definition;
  if v_definition is null or v_definition not like '%PAYMENT_PLAN_FROZEN%'
    or v_definition like '%frozen_plan_config%' then
    raise exception 'MAX_FROZEN_GUARD_UNEXPECTED';
  end if;
  insert into _max_frozen_guard values(v_definition);
  if (select count(*) from public.payment_plans where plan_code='max'
      and price_dzd in (9900,10000) and unified_credits=7500
      and subscription_credit_allowance=7500 and frozen) <> 1 then
    raise exception 'MAX_PLAN_CONFIGURATION_UNEXPECTED';
  end if;
end; $save_guard$;

create or replace function public.protect_frozen_payment_plan()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.frozen then raise exception using errcode='55000',message='PAYMENT_PLAN_FROZEN'; end if;
    return old;
  end if;
  if old.frozen and old.plan_code='max'
    and current_setting('vantra.frozen_plan_config',true)='final-max-price-20260925'
    and old.price_dzd=9900 and new.price_dzd=10000
    and (to_jsonb(new) - 'price_dzd' - 'updated_at') = (to_jsonb(old) - 'price_dzd' - 'updated_at')
  then return new; end if;
  if old.frozen and (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
    raise exception using errcode='55000',message='PAYMENT_PLAN_FROZEN';
  end if;
  return new;
end; $$;

alter table public.payment_plans disable trigger payment_plan_admin_audit;
set local vantra.frozen_plan_config='final-max-price-20260925';
update public.payment_plans set price_dzd=10000 where plan_code='max' and price_dzd=9900;
reset vantra.frozen_plan_config;
alter table public.payment_plans enable trigger payment_plan_admin_audit;
do $restore_guard$ begin
  execute (select definition from _max_frozen_guard limit 1);
  if (select pg_get_functiondef('public.protect_frozen_payment_plan()'::regprocedure))
    is distinct from (select definition from _max_frozen_guard limit 1) then
    raise exception 'MAX_FROZEN_GUARD_RESTORE_FAILED';
  end if;
end; $restore_guard$;

-- These plans are new catalog options; old order entitlements remain unchanged.
insert into public.payment_plans(slug,name,kind,price_dzd,unified_credits,
  active,display_order,featured,entitlement,public_visible)
values
  ('lite_300','Lite +300','credit_pack',1000,300,true,40,false,'{"top_up_plan_code":"lite"}'::jsonb,false),
  ('pro_500','Pro +500','credit_pack',1200,500,true,41,false,'{"top_up_plan_code":"pro"}'::jsonb,false),
  ('pro_1000','Pro +1000','credit_pack',2000,1000,true,42,false,'{"top_up_plan_code":"pro"}'::jsonb,false),
  ('pro_2000','Pro +2000','credit_pack',3800,2000,true,43,false,'{"top_up_plan_code":"pro"}'::jsonb,false)
on conflict(slug) do update set price_dzd=excluded.price_dzd,
  unified_credits=excluded.unified_credits,active=true,
  entitlement=excluded.entitlement,public_visible=false;

create or replace function public.guard_plan_top_up_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_plan text; v_period_start timestamptz; v_count integer; v_pack_plan text;
begin
  if new.order_kind <> 'credit_pack' then return new; end if;
  if tg_op='UPDATE' and (new.status <> 'approved' or old.status='approved') then return new; end if;
  select p.plan_code,e.starts_at into v_plan,v_period_start
    from public.user_entitlements e join public.payment_plans p on p.id=e.plan_id
    where e.user_id=new.user_id and e.status='active'
      and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())
      and p.plan_code in ('lite','pro','max')
    order by e.starts_at desc limit 1 for update of e;
  if v_plan is null then
    raise exception using errcode='42501',message='ACTIVE_PAID_PLAN_REQUIRED';
  end if;
  v_pack_plan := new.entitlement->>'top_up_plan_code';
  if (v_plan in ('lite','pro') and v_pack_plan is distinct from v_plan)
    or (v_plan='max' and v_pack_plan in ('lite','pro')) then
    raise exception using errcode='42501',message='TOP_UP_PLAN_NOT_ELIGIBLE';
  end if;
  if v_plan='lite' then
    select count(*) into v_count from public.payment_orders o
      where o.user_id=new.user_id and o.order_kind='credit_pack'
        and o.status='approved' and o.reviewed_at>=v_period_start;
    if v_count>=2 then
      raise exception using errcode='42501',message='LITE_TOP_UP_LIMIT_REACHED';
    end if;
  end if;
  return new;
end; $$;
create trigger payment_top_up_create_guard before insert on public.payment_orders
  for each row execute function public.guard_plan_top_up_order();
create trigger payment_top_up_approval_guard before update of status on public.payment_orders
  for each row execute function public.guard_plan_top_up_order();

-- Chat weights are internal and always positive, independent of provider cost.
alter table public.model_runtime_configs
  add column if not exists chat_base_class text not null default 'standard'
    check (chat_base_class in ('fast','standard','advanced','heavy'));
update public.model_runtime_configs set chat_base_class=case
    when customer_credit_price between 1 and 5 then 'fast'
    when customer_credit_price between 11 and 15 then 'advanced'
    when customer_credit_price>15 then 'heavy'
    else 'standard' end
  where modality='chat';
update public.model_runtime_configs set customer_credit_price=case chat_base_class
    when 'fast' then 5 when 'advanced' then 15 when 'heavy' then 25 else 10 end
  where modality='chat' and coalesce(customer_credit_price,0)=0;
create table public.chat_cost_controls (
  singleton boolean primary key default true check (singleton),
  cost_normalization_enabled boolean not null default false,
  usage_unit_cost_usd numeric(14,8),
  complexity_enabled boolean not null default false,
  complexity_rules jsonb not null default '{}'::jsonb,
  context_controls jsonb not null default '{}'::jsonb,
  output_controls jsonb not null default '{}'::jsonb,
  concurrency_controls jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.chat_cost_controls(singleton) values(true) on conflict do nothing;
alter table public.chat_usage_records add constraint chat_usage_positive_weight
  check (weight > 0) not valid;
alter table public.chat_cost_controls enable row level security;
revoke all on public.chat_cost_controls from public,anon,authenticated;
grant select,update on public.chat_cost_controls to service_role;

commit;
