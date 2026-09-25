import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`
create schema auth;
create role anon; create role authenticated; create role service_role;
create table auth.users(id uuid primary key, email text, created_at timestamptz default now());
create function auth.role() returns text language sql stable as $$
  select current_setting('request.jwt.claim.role', true)
$$;
create table public.admin_audit_log(
  id uuid primary key default gen_random_uuid(), actor_user_id uuid,
  action text, resource_type text, resource_id text, previous_state jsonb,
  new_state jsonb, metadata jsonb default '{}'::jsonb, created_at timestamptz default now()
);
create table public.payment_plans(id uuid primary key, plan_code text);
create table public.user_entitlements(user_id uuid,plan_id uuid,status text,starts_at timestamptz,ends_at timestamptz,source_payment_order_id uuid);
create table public.payment_orders(id uuid primary key,user_id uuid,status text,order_kind text,entitlement jsonb);
create table public.credit_reservations(id uuid primary key,user_id uuid,funding_source text);
create table public.chat_usage_records(id uuid primary key,user_id uuid,plan_code text);
create table public.model_trial_usages(id uuid primary key,user_id uuid,plan_code text);
create table public.credits(user_id uuid primary key,free_image_remaining int,free_video_remaining int);
create or replace function public.reserve_model_trial_access(
  p_user_id uuid,p_model_key text,p_model_id text,p_modality text,
  p_plan_code text,p_operation_key text,p_credit_reservation_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user_created_at timestamptz;
begin
  if p_plan_code = 'free' then
    select created_at into v_user_created_at from auth.users where id = p_user_id;
    if not found then raise exception using errcode = 'P0001', message = 'MODEL_ACCESS_CHANGED'; end if;
    if p_modality in ('image','video') and now() >= v_user_created_at + interval '7 days' then
      raise exception using errcode = 'P0001', message = 'FREE_MEDIA_EXPIRED';
    end if;
  end if;
  return '{}'::jsonb;
end;
$$;
`);
await db.exec("set request.jwt.claim.role='service_role'");
await db.exec(readFileSync('supabase/migrations/20260925010000_free_access_eligibility.sql', 'utf8'));

const old = '11111111-1111-4111-8111-111111111111';
const alias = '22222222-2222-4222-8222-222222222222';
const paidPlan = '33333333-3333-4333-8333-333333333333';
const order = '44444444-4444-4444-8444-444444444444';
const unrelated = '55555555-5555-4555-8555-555555555555';
await db.exec(`insert into auth.users(id,email,created_at) values
  ('${old}','person@example.com',now()-interval '40 days'),
  ('${alias}','person+again@example.com',now()),
  ('${unrelated}','someone-else@example.com',now()-interval '90 days');
insert into public.payment_plans values('${paidPlan}','lite');
insert into public.credits values('${old}',2,1);`);

assert.equal((await db.query(`select public.assess_free_access('${unrelated}') as state`)).rows[0].state, 'eligible');
assert.equal((await db.query(`select public.assess_free_access('${old}') as state`)).rows[0].state, 'review_required');
assert.equal((await db.query(`select count(*)::int as n from public.admin_audit_log where action='free_account_sent_to_review'`)).rows[0].n, 1);
assert.equal((await db.query(`select public.free_access_execution_allowed('${old}') as allowed`)).rows[0].allowed, false);
await assert.rejects(db.exec(`insert into public.chat_usage_records values(gen_random_uuid(),'${old}','free')`), /FREE_ACCESS_RESTRICTED/);
await assert.rejects(db.exec(`insert into public.credit_reservations values(gen_random_uuid(),'${old}','free_trial_image')`), /FREE_ACCESS_RESTRICTED/);
await assert.rejects(db.exec(`insert into public.model_trial_usages values(gen_random_uuid(),'${old}','free')`), /FREE_ACCESS_RESTRICTED/);

await db.exec(`insert into public.user_entitlements values('${old}','${paidPlan}','active',now()-interval '1 day',now()+interval '1 day','${order}')`);
assert.equal((await db.query(`select public.free_access_execution_allowed('${old}') as allowed`)).rows[0].allowed, true);
await db.exec(`insert into public.chat_usage_records values(gen_random_uuid(),'${old}','free')`);
await db.exec(`insert into public.payment_orders values('${order}','${old}','pending','subscription','{"plan_code":"lite"}')`);
await db.exec(`update public.payment_orders set status='approved' where id='${order}'`);
await db.exec(`update public.payment_orders set status='approved' where id='${order}'`);
assert.equal((await db.query(`select count(*)::int as n from public.admin_audit_log where action='flagged_free_account_converted_to_paid'`)).rows[0].n, 1);
await db.exec(`insert into public.payment_orders values(gen_random_uuid(),'${old}','pending','subscription','{"plan_code":"lite"}')`);
await db.exec(`update public.payment_orders set status='approved' where user_id='${old}' and status='pending'`);
assert.equal((await db.query(`select count(*)::int as n from public.admin_audit_log where action='flagged_free_account_converted_to_paid'`)).rows[0].n, 1);
await db.exec(`update public.user_entitlements set ends_at=now()-interval '1 second' where user_id='${old}'`);
assert.equal((await db.query(`select public.free_access_execution_allowed('${old}') as allowed`)).rows[0].allowed, false);

assert.equal((await db.query(`select public.set_free_access_eligibility('${old}','manually_approved','${alias}','Owner reviewed duplicate email') as result`)).rows[0].result.state, 'manually_approved');
assert.equal((await db.query(`select public.free_access_execution_allowed('${old}') as allowed`)).rows[0].allowed, true);
assert.equal((await db.query(`select public.assess_free_access('${old}') as state`)).rows[0].state, 'manually_approved');
assert.deepEqual((await db.query(`select free_image_remaining,free_video_remaining from public.credits where user_id='${old}'`)).rows[0],
  { free_image_remaining: 2, free_video_remaining: 1 });
assert.deepEqual((await db.query(`select public.reserve_model_trial_access('${old}','m','m','image','free','op',null) as result`)).rows[0].result, {});
await db.exec(`insert into public.credit_reservations values(gen_random_uuid(),'${old}','free_trial_video')`);
assert.equal((await db.query(`select count(*)::int as n from public.admin_audit_log where action='free_eligibility_manually_overridden'`)).rows[0].n, 1);
await db.exec("set request.jwt.claim.role='authenticated'");
await assert.rejects(db.exec(`select public.set_free_access_eligibility('${old}','ineligible','${alias}','Unauthorized')`), /FORBIDDEN/);
await db.exec("set request.jwt.claim.role='service_role'");
await db.exec(readFileSync('supabase/migrations/20260925030000_free_access_anti_abuse_v1.sql', 'utf8'));
const first = '66666666-6666-4666-8666-666666666666';
const second = '77777777-7777-4777-8777-777777777777';
const keyOnly = '88888888-8888-4888-8888-888888888888';
const concurrent = '99999999-9999-4999-8999-999999999999';
const concurrentOther = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const installHash = '1'.repeat(64);
const keyHash = '2'.repeat(64);
await db.exec(`insert into auth.users(id,email) values
  ('${first}','first@example.org'),('${second}','second@example.org'),
  ('${keyOnly}','third@example.org'),('${concurrent}','fourth@example.org'),
  ('${concurrentOther}','fifth@example.org');
insert into public.credits values('${second}',3,1);`);
assert.equal((await db.query(`select public.link_free_device_identity('${first}','installation','${installHash}') as state`)).rows[0].state, 'eligible');
await db.exec("set request.headers.x_forwarded_for='100.64.1.1'");
assert.equal((await db.query(`select public.assess_free_access('${first}') as state`)).rows[0].state, 'eligible');
await db.exec("set request.headers.x_forwarded_for='203.0.113.9'");
assert.equal((await db.query(`select public.free_access_execution_allowed('${first}') as allowed`)).rows[0].allowed, true);
assert.equal((await db.query(`select public.link_free_device_identity('${second}','installation','${installHash}') as state`)).rows[0].state, 'review_required');
assert.equal((await db.query(`select public.link_free_device_identity('${first}','installation','${installHash}') as state`)).rows[0].state, 'eligible');
await assert.rejects(db.exec(`insert into public.chat_usage_records values(gen_random_uuid(),'${second}','free')`), /FREE_ACCESS_RESTRICTED/);
assert.deepEqual((await db.query(`select public.free_device_risk_summary('${second}') as result`)).rows[0].result,
  { linked_accounts: 1, shared_installations: 1, shared_browser_keys: 0 });
await db.exec(`insert into public.user_entitlements values('${second}','${paidPlan}','active',now()-interval '1 day',now()+interval '1 day',null)`);
assert.equal((await db.query(`select public.free_access_execution_allowed('${second}') as allowed`)).rows[0].allowed, true);
await db.exec(`update public.user_entitlements set ends_at=now()-interval '1 second' where user_id='${second}'`);
assert.equal((await db.query(`select public.free_access_execution_allowed('${second}') as allowed`)).rows[0].allowed, false);
await db.exec(`select public.set_free_access_eligibility('${second}','manually_approved','${first}','Reviewed shared device')`);
assert.equal((await db.query(`select public.link_free_device_identity('${second}','installation','${installHash}') as state`)).rows[0].state, 'manually_approved');
assert.deepEqual((await db.query(`select free_image_remaining,free_video_remaining from public.credits where user_id='${second}'`)).rows[0],
  { free_image_remaining: 3, free_video_remaining: 1 });
assert.equal((await db.query(`select public.link_free_device_identity('${first}','webcrypto','${keyHash}') as state`)).rows[0].state, 'eligible');
assert.equal((await db.query(`select public.link_free_device_identity('${keyOnly}','webcrypto','${keyHash}') as state`)).rows[0].state, 'review_required');
const simultaneousHash = '3'.repeat(64);
const simultaneous = await Promise.all([
  db.query(`select public.link_free_device_identity('${concurrent}','installation','${simultaneousHash}') as state`),
  db.query(`select public.link_free_device_identity('${concurrentOther}','installation','${simultaneousHash}') as state`),
]);
assert.deepEqual(simultaneous.map((result) => result.rows[0].state).sort(), ['eligible','review_required']);
await db.exec("set request.jwt.claim.role='authenticated'");
await assert.rejects(db.exec(`select public.link_free_device_identity('${first}','installation','${'4'.repeat(64)}')`), /FORBIDDEN/);
await assert.rejects(db.exec(`select public.free_device_risk_summary('${first}')`), /FORBIDDEN/);
console.log('Free eligibility, device linkage, paid bypass and execution guards passed on local PostgreSQL WASM');
