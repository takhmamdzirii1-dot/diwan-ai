// Local PostgreSQL execution test. One-time optional setup:
// npm install --no-save --package-lock=false --ignore-scripts @electric-sql/pglite@0.3.16
// Run from the repository root: node tests/subscription-period-max-ledger.db.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = readFileSync('supabase/migrations/20260924020000_fix_subscription_period_and_max_ledger.sql', 'utf8');
const lifecycle = readFileSync('supabase/migrations/20260921020000_lite_allowance_cutover.sql', 'utf8');
const start = lifecycle.indexOf('create or replace function public.refresh_subscription_lifecycle(');
const end = lifecycle.indexOf('\n$$;', start);
assert.ok(start >= 0 && end > start);
const refresh = lifecycle.slice(start, end + 4);

await db.exec(`
create schema auth;
create role anon;
create role authenticated;
create role service_role;
create table auth.users (id uuid primary key, created_at timestamptz not null default now());
create function auth.role() returns text language sql stable as $$
  select current_setting('request.jwt.claim.role', true)
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.payment_plans (
  id uuid primary key, plan_code text not null
);
create table public.payment_orders (
  id uuid primary key, user_id uuid not null, plan_id uuid not null,
  order_kind text not null, plan_name text not null, entitlement jsonb not null,
  credits_amount bigint not null, payment_reference text not null,
  amount_dzd integer not null, status text not null, submitted_at timestamptz,
  expires_at timestamptz not null, resulting_credit_transaction_id uuid,
  resulting_entitlement_id uuid, reviewed_at timestamptz, reviewed_by uuid,
  review_note text
);
create table public.user_entitlements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  plan_id uuid not null, plan_name text not null,
  status text not null default 'active' check (status in ('active','cancelled','expired')),
  source_payment_order_id uuid not null, entitlement jsonb not null,
  starts_at timestamptz not null default now(), ends_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.credits (
  user_id uuid primary key, balance bigint not null,
  subscription_balance bigint not null default 0,
  subscription_rollover_balance bigint not null default 0,
  purchased_balance bigint not null default 0,
  subscription_plan_code text, subscription_entitlement_id uuid,
  subscription_period_ends_at timestamptz,
  lite_video_remaining smallint not null default 0,
  lite_video_entitlement_id uuid,
  free_image_remaining smallint not null default 0,
  free_video_remaining smallint not null default 0,
  updated_at timestamptz not null default now()
);
create table public.subscription_periods (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  payment_order_id uuid not null, entitlement_id uuid not null,
  plan_code text not null, period_starts_at timestamptz not null,
  period_ends_at timestamptz not null, base_allowance bigint not null,
  rollover_amount bigint not null default 0, included_videos smallint not null default 0,
  state text not null, activated_at timestamptz,
  eligible_unused_at_close bigint not null default 0, closed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  reservation_id uuid, transaction_type text not null, amount bigint not null,
  balance_after bigint not null, idempotency_key text not null,
  payload_hash text not null, reason text not null, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, transaction_type, idempotency_key)
);
create table public.credit_reservations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  operation_key text not null, payload_hash text not null,
  modality text not null, model_id text not null, amount bigint not null,
  pricing_version text not null, pricing_snapshot jsonb not null,
  route_snapshot jsonb, expires_at timestamptz not null,
  funding_source text, subscription_amount bigint default 0,
  subscription_rollover_amount bigint default 0, purchased_amount bigint default 0,
  allowance_entitlement_id uuid, state text not null default 'reserved'
);
create table public.payment_audit_log (
  id uuid primary key default gen_random_uuid(), payment_order_id uuid not null,
  actor_user_id uuid, action text not null, previous_status text,
  new_status text not null, metadata jsonb not null default '{}'::jsonb
);
create table public.model_plan_access_configs (
  model_key text, plan_code text, access_state text, trial_allowance integer
);
create table public.model_trial_usages (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  model_key text, model_id text, modality text, plan_code text,
  entitlement_id uuid, trial_scope text, operation_key text,
  credit_reservation_id uuid, state text, expires_at timestamptz,
  completed_at timestamptz, released_at timestamptz,
  updated_at timestamptz default now()
);
`);
await db.exec(refresh);
const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const plans = { lite: uuid(1001), pro: uuid(1002), max: uuid(1003) };
await db.exec(`insert into public.payment_plans(id,plan_code) values
  ('${plans.lite}','lite'),('${plans.pro}','pro'),('${plans.max}','max');`);

const oldEnds = new Date(Date.now() + 10 * 86_400_000).toISOString();
const scheduledEnds = new Date(Date.now() + 40 * 86_400_000).toISOString();
const oldStarts = new Date(Date.now() - 20 * 86_400_000).toISOString();
async function seed({ user, plan, oldEntitlement, scheduledEntitlement, subscription, priorRollover = 0, purchased, videos = 0 }) {
  const userId = uuid(user);
  const oldId = uuid(oldEntitlement);
  await db.exec(`
    insert into auth.users(id,created_at) values ('${userId}', now() - interval '100 days');
    insert into public.user_entitlements(
      id,user_id,plan_id,plan_name,status,source_payment_order_id,entitlement,starts_at,ends_at
    ) values (
      '${oldId}','${userId}','${plans[plan]}','${plan}','active','${uuid(oldEntitlement + 1000)}',
      '{"access_period_days":30}'::jsonb,'${oldStarts}','${oldEnds}'
    );
    insert into public.credits(
      user_id,balance,subscription_balance,subscription_rollover_balance,purchased_balance,
      subscription_plan_code,subscription_entitlement_id,subscription_period_ends_at,
      lite_video_remaining,lite_video_entitlement_id
    ) values (
      '${userId}',${subscription + purchased},${subscription},${priorRollover},${purchased},
      '${plan}','${oldId}','${oldEnds}',${videos},
      ${plan === 'lite' ? `'${oldId}'` : 'null'}
    );
  `);
  if (plan !== 'max') {
    await db.exec(`insert into public.subscription_periods(
      user_id,payment_order_id,entitlement_id,plan_code,
      period_starts_at,period_ends_at,base_allowance,included_videos,state,activated_at
    ) values (
      '${userId}','${uuid(oldEntitlement + 1000)}','${oldId}','${plan}',
      '${oldStarts}','${oldEnds}',${plan === 'pro' ? 3000 : 850},${videos},'active',now()
    );`);
  }
  if (scheduledEntitlement) {
    const futureId = uuid(scheduledEntitlement);
    await db.exec(`
      insert into public.user_entitlements(
        id,user_id,plan_id,plan_name,status,source_payment_order_id,entitlement,starts_at,ends_at
      ) values (
        '${futureId}','${userId}','${plans[plan]}','${plan}','active','${uuid(scheduledEntitlement + 1000)}',
        '{"access_period_days":30}'::jsonb,'${oldEnds}','${scheduledEnds}'
      );
      insert into public.subscription_periods(
        user_id,payment_order_id,entitlement_id,plan_code,
        period_starts_at,period_ends_at,base_allowance,included_videos,state
      ) values (
        '${userId}','${uuid(scheduledEntitlement + 1000)}','${futureId}','${plan}',
        '${oldEnds}','${scheduledEnds}',${plan === 'pro' ? 3000 : 850},${videos},'scheduled'
      );
    `);
  }
  return { userId, oldId, futureId: scheduledEntitlement ? uuid(scheduledEntitlement) : null };
}
const proEarly = await seed({ user: 1, plan: 'pro', oldEntitlement: 2001, scheduledEntitlement: 2002, subscription: 1000, purchased: 200 });
const lite = await seed({ user: 2, plan: 'lite', oldEntitlement: 2101, scheduledEntitlement: 2102, subscription: 500, purchased: 300, videos: 2 });
const proUpgrade = await seed({ user: 3, plan: 'pro', oldEntitlement: 2201, subscription: 3000, purchased: 500 });
const maxRenew = await seed({ user: 4, plan: 'max', oldEntitlement: 2301, subscription: 4500, priorRollover: 500, purchased: 800 });
const boundary = await seed({ user: 5, plan: 'pro', oldEntitlement: 2401, scheduledEntitlement: 2402, subscription: 1200, purchased: 400 });

await db.exec(migration);
await db.exec(`create trigger user_entitlement_access_period before insert
  on public.user_entitlements for each row execute function public.apply_entitlement_access_period();`);
await db.exec(`set request.jwt.claim.role = 'service_role';`);

for (const fixture of [proEarly, lite, boundary]) {
  const row = await db.query(`select status from public.user_entitlements where id = $1::uuid`, [fixture.futureId]);
  assert.equal(row.rows[0].status, 'scheduled');
}

async function order(userId, plan, number, allowance) {
  const id = uuid(number);
  const entitlement = JSON.stringify({ plan_code: plan, access_period_days: 30, subscription_credit_allowance: allowance, included_video_allowance: plan === 'lite' ? 2 : null });
  await db.query(`insert into public.payment_orders(
    id,user_id,plan_id,order_kind,plan_name,entitlement,credits_amount,
    payment_reference,amount_dzd,status,submitted_at,expires_at
  ) values ($1::uuid,$2::uuid,$3::uuid,'subscription',$4,$5::jsonb,$6,$7,9900,
    'pending',now()-interval '1 minute',now()+interval '1 day')`,
    [id, userId, plans[plan], plan, entitlement, allowance, `REF-${number}`]);
  return id;
}
async function approve(id) {
  const result = await db.query(`select public.approve_manual_payment($1::uuid,$2::uuid,null) as result`, [id, uuid(999)]);
  return result.rows[0].result;
}
async function account(userId) {
  const result = await db.query(`select * from public.credits where user_id = $1::uuid`, [userId]);
  return result.rows[0];
}

const proOrder = await order(proEarly.userId, 'pro', 5001, 3000);
const proResult = await approve(proOrder);
assert.equal(proResult.activation, 'scheduled');
const chained = await db.query(`select period_starts_at,period_ends_at,state from public.subscription_periods where payment_order_id=$1::uuid`, [proOrder]);
assert.equal(chained.rows[0].state, 'scheduled');
assert.equal(new Date(chained.rows[0].period_starts_at).toISOString(), scheduledEnds);
assert.equal((await account(proEarly.userId)).subscription_balance, 1000);

const liteReservation = await db.query(`select public.reserve_credits_v2_base(
  $1::uuid,'lite-video-operation',$2,'video','lite-model',0,'test','{}'::jsonb,null,
  now()+interval '15 minutes') as result`, [lite.userId, 'a'.repeat(64)]);
const liteReservationId = liteReservation.rows[0].result.reservation_id;
const liteRow = await db.query(`select allowance_entitlement_id,funding_source from public.credit_reservations where id=$1::uuid`, [liteReservationId]);
assert.equal(liteRow.rows[0].allowance_entitlement_id, lite.oldId);
assert.equal(liteRow.rows[0].funding_source, 'lite_included_video');
assert.equal((await account(lite.userId)).lite_video_remaining, 1);

await db.exec(`insert into public.model_plan_access_configs(model_key,plan_code,access_state,trial_allowance)
  values ('test-model','pro','trial',1);`);
const trialResult = await db.query(`select public.reserve_model_trial_access(
  $1::uuid,'test-model','test-model-id','chat','pro','trial-op',null) as result`, [proEarly.userId]);
const trialId = trialResult.rows[0].result.trial_usage_id;
const trialRow = await db.query(`select entitlement_id from public.model_trial_usages where id=$1::uuid`, [trialId]);
assert.equal(trialRow.rows[0].entitlement_id, proEarly.oldId);

const upgradeOrder = await order(proUpgrade.userId, 'max', 5002, 7500);
const upgrade = await approve(upgradeOrder);
assert.equal(upgrade.lifecycle_type, 'upgrade');
assert.equal(upgrade.subscription_rollover, 0);
const upgradeAccount = await account(proUpgrade.userId);
assert.equal(upgradeAccount.subscription_balance, 7500);
assert.equal(upgradeAccount.purchased_balance, 500);
assert.equal(upgradeAccount.balance, 8000);

const maxOrder = await order(maxRenew.userId, 'max', 5003, 7500);
const maxResult = await approve(maxOrder);
assert.equal(maxResult.lifecycle_type, 'same_plan_renewal');
assert.equal(maxResult.subscription_rollover, 1500);
const maxAccount = await account(maxRenew.userId);
assert.equal(maxAccount.subscription_balance, 9000);
assert.equal(maxAccount.subscription_rollover_balance, 1500);
assert.equal(maxAccount.purchased_balance, 800);
assert.equal(maxAccount.balance, 9800);
const maxLedger = await db.query(`select transaction_type,amount,balance_after,idempotency_key
  from public.credit_transactions where user_id=$1::uuid
  order by created_at,id`, [maxRenew.userId]);
assert.equal(maxLedger.rows.reduce((sum, row) => sum + Number(row.amount), 0), 4500);
assert.equal(maxLedger.rows.length, 3);
const byKey = Object.fromEntries(maxLedger.rows.map((row) => [row.idempotency_key, row]));
assert.equal(byKey[`payment:${maxOrder}:subscription-reset`].amount, -4500);
assert.equal(byKey[`payment:${maxOrder}:subscription-reset`].balance_after, 800);
assert.equal(byKey[`payment:${maxOrder}`].amount, 7500);
assert.equal(byKey[`payment:${maxOrder}`].balance_after, 8300);
assert.equal(byKey[`payment:${maxOrder}:max-rollover`].amount, 1500);
assert.equal(byKey[`payment:${maxOrder}:max-rollover`].balance_after, 9800);
const beforeReplay = maxLedger.rows.length;
assert.equal((await approve(maxOrder)).idempotent, true);
const afterReplay = await db.query(`select count(*)::integer as n from public.credit_transactions where user_id=$1::uuid`, [maxRenew.userId]);
assert.equal(afterReplay.rows[0].n, beforeReplay);

await db.exec(`
  update public.credits set subscription_period_ends_at=now() where user_id='${boundary.userId}';
  update public.user_entitlements set ends_at=now() where id='${boundary.oldId}';
  update public.subscription_periods set period_ends_at=now() where entitlement_id='${boundary.oldId}';
  update public.user_entitlements set starts_at=now(),ends_at=now()+interval '30 days'
    where id='${boundary.futureId}';
  update public.subscription_periods set period_starts_at=now(),period_ends_at=now()+interval '30 days'
    where entitlement_id='${boundary.futureId}';
`);
const boundaryReservation = await db.query(`select public.reserve_credits_v2_base(
  $1::uuid,'boundary-chat-operation',$2,'chat','chat-model',10,'test','{}'::jsonb,null,
  now()+interval '15 minutes') as result`, [boundary.userId, 'b'.repeat(64)]);
const boundaryReservationRow = await db.query(`select allowance_entitlement_id,subscription_amount
  from public.credit_reservations where id=$1::uuid`, [boundaryReservation.rows[0].result.reservation_id]);
assert.equal(boundaryReservationRow.rows[0].allowance_entitlement_id, boundary.futureId);
assert.equal(boundaryReservationRow.rows[0].subscription_amount, 10);
await db.exec(`set request.jwt.claim.role = 'authenticated';
  set request.jwt.claim.sub = '${boundary.userId}';`);
const access = await db.query(`select * from public.get_user_plan_access()`);
assert.equal(access.rows[0].access_state, 'ACTIVE');
assert.equal(new Date(access.rows[0].starts_at).getTime() <= Date.now(), true);
const currentModelPlan = await db.query(`select * from public.get_current_model_plan()`);
assert.equal(currentModelPlan.rows[0].plan_code, 'pro');
assert.equal((await account(boundary.userId)).subscription_balance, 3590);
assert.equal((await account(boundary.userId)).purchased_balance, 400);

console.log('Migration parsed and executed on local PostgreSQL WASM');
console.log('DB scenarios passed: future periods, Lite allowance, model trial, Pro→MAX, MAX→MAX, replay, expiry activation');
await db.close();
