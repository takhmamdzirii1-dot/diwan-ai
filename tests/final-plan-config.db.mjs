import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`
create schema auth;
create role anon; create role authenticated; create role service_role;
create table auth.users(id uuid primary key);
create table public.chat_plan_limits(plan_code text primary key,five_hour_limit int,weekly_limit int,fallback_enabled boolean,updated_at timestamptz default now());
create table public.payment_plans(
  id uuid primary key default gen_random_uuid(),slug text unique,plan_code text,name text,kind text,
  price_dzd int,unified_credits bigint,subscription_credit_allowance bigint,
  included_video_allowance int,access_period_days int,active boolean,public_visible boolean,
  display_order int,featured boolean,entitlement jsonb,updated_at timestamptz default now(),frozen boolean default false
);
create function public.protect_frozen_payment_plan() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.frozen and (to_jsonb(new)-'updated_at') is distinct from (to_jsonb(old)-'updated_at') then
    raise exception using errcode='55000',message='PAYMENT_PLAN_FROZEN';
  end if;
  return new;
end; $$;
create trigger payment_plan_frozen before update on public.payment_plans
  for each row execute function public.protect_frozen_payment_plan();
create function public.noop_plan_audit() returns trigger language plpgsql as $$
begin return new; end; $$;
create trigger payment_plan_admin_audit after update on public.payment_plans
  for each row execute function public.noop_plan_audit();
create table public.user_entitlements(user_id uuid,plan_id uuid,status text,starts_at timestamptz,ends_at timestamptz);
create table public.payment_orders(id uuid primary key,user_id uuid,order_kind text,status text,
  entitlement jsonb,reviewed_at timestamptz,amount_dzd int,credits_amount bigint);
create table public.model_runtime_configs(id uuid primary key,modality text,customer_credit_price bigint);
create table public.chat_usage_records(id uuid primary key,weight int);
insert into public.payment_plans(slug,plan_code,name,kind,price_dzd,unified_credits,
  subscription_credit_allowance,included_video_allowance,access_period_days,active,public_visible,display_order,featured,entitlement,frozen)
values
  ('free','free','Free','subscription',0,0,0,null,null,false,true,0,false,'{}',false),
  ('lite','lite','Lite','subscription',2000,600,600,4,30,true,false,1,false,'{}',false),
  ('pro','pro','Pro','subscription',5000,3000,3000,null,30,true,true,2,false,'{}',false),
  ('max','max','Max','subscription',9900,7500,7500,null,30,true,true,3,false,'{}',true);
insert into public.model_runtime_configs values(gen_random_uuid(),'chat',0);
`);
const originalGuard = (await db.query("select pg_get_functiondef('public.protect_frozen_payment_plan()'::regprocedure) as body")).rows[0].body;
await db.exec(readFileSync('supabase/migrations/20260925020000_final_plan_and_chat_config.sql', 'utf8'));
const currentGuard = (await db.query("select pg_get_functiondef('public.protect_frozen_payment_plan()'::regprocedure) as body")).rows[0].body;
assert.equal(currentGuard, originalGuard);
const limits = (await db.query('select plan_code,five_hour_limit,weekly_limit from public.chat_plan_limits order by plan_code')).rows;
assert.deepEqual(Object.fromEntries(limits.map((row) => [row.plan_code,[row.five_hour_limit,row.weekly_limit]])),
  { free:[120,800], lite:[200,1600], max:[600,6500], pro:[300,3000] });
assert.equal((await db.query("select price_dzd from public.payment_plans where plan_code='max'")).rows[0].price_dzd,10000);
assert.equal((await db.query("select customer_credit_price from public.model_runtime_configs where modality='chat'")).rows[0].customer_credit_price,10);
const controls = (await db.query('select cost_normalization_enabled,complexity_enabled from public.chat_cost_controls')).rows[0];
assert.deepEqual(controls,{cost_normalization_enabled:false,complexity_enabled:false});

const user = '11111111-1111-4111-8111-111111111111';
const liteId = (await db.query("select id from public.payment_plans where plan_code='lite'")).rows[0].id;
await db.exec(`insert into auth.users values('${user}');
  insert into public.user_entitlements values('${user}','${liteId}','active',now()-interval '1 day',now()+interval '29 days')`);
const pack = (await db.query("select entitlement from public.payment_plans where slug='lite_300'")).rows[0].entitlement;
assert.equal(pack.top_up_plan_code,'lite');
await assert.rejects(db.exec(`insert into public.payment_orders values(gen_random_uuid(),'${user}','credit_pack','pending','{"top_up_plan_code":"pro"}',null,1200,500)`), /TOP_UP_PLAN_NOT_ELIGIBLE/);
await db.exec(`insert into public.payment_orders values
  ('22222222-2222-4222-8222-222222222221','${user}','credit_pack','pending','{"top_up_plan_code":"lite"}',null,1000,300),
  ('22222222-2222-4222-8222-222222222222','${user}','credit_pack','pending','{"top_up_plan_code":"lite"}',null,1000,300);
update public.payment_orders set status='approved',reviewed_at=now() where id='22222222-2222-4222-8222-222222222221';
update public.payment_orders set status='approved',reviewed_at=now() where id='22222222-2222-4222-8222-222222222222';`);
await assert.rejects(db.exec(`insert into public.payment_orders values(gen_random_uuid(),'${user}','credit_pack','pending','{"top_up_plan_code":"lite"}',null,1000,300)`), /LITE_TOP_UP_LIMIT_REACHED/);
console.log('Final plan, Chat, frozen MAX and Lite top-up guards passed on local PostgreSQL WASM');
