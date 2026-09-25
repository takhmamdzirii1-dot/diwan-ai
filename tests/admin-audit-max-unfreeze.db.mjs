import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`
create schema auth;
create role anon; create role authenticated; create role service_role;
create table auth.users(id uuid primary key, email text);
create function auth.role() returns text language sql stable as 'select ''service_role''::text';

create table public.admin_audit_log(
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  previous_state jsonb,
  new_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create function public.write_admin_audit(
  p_actor_user_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_previous_state jsonb default null,
  p_new_state jsonb default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,previous_state,new_state,metadata)
  values(p_actor_user_id,p_action,p_resource_type,p_resource_id,p_previous_state,p_new_state,p_metadata)
  returning id into v_id;
  return v_id;
end $$;

create table public.payment_plans(
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  plan_code text,
  name text not null,
  description text,
  kind text not null,
  price_dzd integer not null,
  unified_credits bigint not null,
  subscription_credit_allowance bigint,
  included_video_allowance integer,
  access_period_days integer,
  active boolean not null,
  public_visible boolean not null,
  eligibility_required boolean not null,
  display_order integer not null,
  featured boolean not null,
  entitlement jsonb not null default '{}'::jsonb,
  frozen boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create function public.protect_frozen_payment_plan() returns trigger language plpgsql set search_path='' as $$
begin
  if old.frozen and to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception using errcode='55000',message='PAYMENT_PLAN_FROZEN';
  end if;
  return new;
end $$;
create trigger protect_frozen_payment_plan before update or delete on public.payment_plans
for each row execute function public.protect_frozen_payment_plan();
create function public.audit_payment_plan_change() returns trigger language plpgsql as $$
begin return new; end $$;
create trigger payment_plan_admin_audit after insert or update on public.payment_plans
for each row execute function public.audit_payment_plan_change();

create table public.model_runtime_configs(
  model_key text primary key, model_id text, modality text, enabled boolean, archived boolean,
  routing_role text, customer_credit_price bigint, provider_cost_status text,
  provider_cost_minor bigint, provider_cost_currency text, allowed_plans text[],
  customer_display_name text, customer_short_description text, customer_media_url text,
  customer_category text, studio_visible boolean, customer_sort_order integer,
  customer_availability_label text, capabilities jsonb, surface_visibility jsonb,
  capability_source_type text, capability_confidence text, capability_sync_status text,
  updated_by uuid, updated_at timestamptz default now()
);
create table public.model_provider_routes(
  id uuid primary key default gen_random_uuid(), model_key text, provider_id text,
  provider_model_id text, enabled boolean, priority integer, fallback boolean, updated_by uuid
);
create table public.provider_runtime_configs(
  provider_id text primary key, display_name text, adapter_type text, enabled boolean,
  archived boolean, priority integer, emergency_disabled boolean,
  daily_spend_limit_minor bigint, spend_currency text, updated_by uuid
);
create table public.model_plan_access_configs(
  model_key text, plan_code text, access_state text, trial_allowance integer,
  updated_by uuid, updated_at timestamptz default now()
);
create table public.payment_orders(
  id uuid primary key default gen_random_uuid(),
  plan_name text not null,
  amount_dzd integer not null,
  credits_amount bigint not null,
  entitlement jsonb not null
);
create table public.credit_transactions(id uuid primary key, user_id uuid, amount bigint not null);

insert into auth.users(id,email) values
  ('11111111-1111-4111-8111-111111111111','admin-a@joinvantra.com'),
  ('22222222-2222-4222-8222-222222222222','admin-b@joinvantra.com');
insert into public.payment_plans(
  slug,plan_code,name,kind,price_dzd,unified_credits,subscription_credit_allowance,
  access_period_days,active,public_visible,eligibility_required,display_order,featured,frozen
) values
  ('max','max','MAX','subscription',9900,7500,7500,30,true,true,false,30,true,true),
  ('protected','protected','Protected','subscription',1000,100,100,30,true,false,false,40,false,true);
insert into public.payment_orders(plan_name,amount_dzd,credits_amount,entitlement)
values('MAX',9900,7500,'{"plan_code":"max","price_dzd":9900,"credits":7500}');
insert into public.credit_transactions values
  ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',7500);
insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,previous_state,new_state)
values('11111111-1111-4111-8111-111111111111','legacy_plan_review','plan','legacy',null,'{"status":"kept"}');
`);

await db.exec(readFileSync('supabase/migrations/20260925060000_admin_audit_hardening_and_max_unfreeze.sql', 'utf8'));

const maxBefore = (await db.query("select id,frozen from public.payment_plans where plan_code='max'")).rows[0];
assert.equal(maxBefore.frozen, false, 'MAX catalog row must be unfrozen');
assert.equal((await db.query("select frozen from public.payment_plans where plan_code='protected'")).rows[0].frozen, true);

await db.exec(`
update public.payment_plans
set price_dzd=10000, updated_by='11111111-1111-4111-8111-111111111111'
where plan_code='max';
update public.payment_plans
set unified_credits=7600, subscription_credit_allowance=7600,
    updated_by='22222222-2222-4222-8222-222222222222'
where plan_code='max';
`);

const events = (await db.query(`
select actor_user_id,action,resource_id,previous_state,new_state,metadata
from public.admin_audit_log order by created_at,id
`)).rows;
assert.equal(events.length, 3);
assert.ok(events.some((event) => event.action === 'legacy_plan_review' && event.new_state.status === 'kept'));
const priceEvent = events.find((event) => event.new_state.price_dzd === 10000 && event.previous_state.price_dzd === 9900);
const creditEvent = events.find((event) => event.new_state.unified_credits === 7600 && event.previous_state.unified_credits === 7500);
assert.ok(priceEvent);
assert.ok(creditEvent);
assert.equal(priceEvent.actor_user_id, '11111111-1111-4111-8111-111111111111');
assert.equal(priceEvent.action, 'plan_updated');
assert.equal(priceEvent.resource_id, maxBefore.id);
assert.equal(priceEvent.metadata.resource_label, 'MAX (max)');
assert.equal(creditEvent.actor_user_id, '22222222-2222-4222-8222-222222222222');

const historical = (await db.query('select amount_dzd,credits_amount,entitlement from public.payment_orders')).rows[0];
assert.equal(historical.amount_dzd, 9900);
assert.equal(historical.credits_amount, 7500);
assert.equal(historical.entitlement.price_dzd, 9900);
assert.equal(historical.entitlement.credits, 7500);
assert.equal((await db.query('select amount from public.credit_transactions')).rows[0].amount, 7500);

await assert.rejects(
  db.exec("update public.payment_plans set price_dzd=1100 where plan_code='protected'"),
  /PAYMENT_PLAN_FROZEN/
);

console.log('Admin actor attribution, field diffs, MAX unfreeze and historical snapshot immutability passed');
