import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(
  new URL('../../supabase/migrations/20260924020000_fix_subscription_period_and_max_ledger.sql', import.meta.url),
  'utf8'
);
const lifecycle = readFileSync(
  new URL('../../supabase/migrations/20260921020000_lite_allowance_cutover.sql', import.meta.url),
  'utf8'
);

function definition(name: string) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const end = sql.indexOf('\n$$;', start);
  assert.ok(end > start, `unterminated ${name}`);
  return sql.slice(start, end + 4);
}

const trigger = definition('apply_entitlement_access_period');
const plan = definition('get_user_plan_access');
const modelPlan = definition('get_current_model_plan');
const reserve = definition('reserve_credits_v2_base');
const trial = definition('reserve_model_trial_access');
const approve = definition('approve_manual_payment');
const activate = definition('activate_due_subscription_period_for_access');

test('one atomic migration labels future scheduled entitlements without touching balances', () => {
  assert.match(sql, /^begin;[\s\S]*commit;\s*$/m);
  assert.match(sql, /check \(status in \('active', 'scheduled', 'cancelled', 'expired'\)\)/);
  assert.match(sql, /update public\.user_entitlements e set status = 'scheduled'[\s\S]*p\.state = 'scheduled'[\s\S]*p\.period_starts_at > now\(\)[\s\S]*e\.starts_at > now\(\)/);
  assert.match(sql, /update public\.user_entitlements e set status = 'cancelled'[\s\S]*p\.state = 'replaced'[\s\S]*e\.starts_at > now\(\)/);
  const backfill = sql.slice(sql.indexOf('update public.user_entitlements e'), sql.indexOf('create or replace function'));
  assert.doesNotMatch(backfill, /public\.(credits|credit_transactions|payment_orders)/);
});

test('early Lite and Pro renewals chain future periods without making one current early', () => {
  assert.match(trigger, /entitlement\.status in \('active', 'scheduled'\)/);
  assert.match(trigger, /scheduled\.entitlement_id = entitlement\.id and scheduled\.state = 'scheduled'/);
  assert.match(trigger, /replaced\.entitlement_id = entitlement\.id and replaced\.state = 'replaced'/);
  assert.match(trigger, /new\.starts_at := greatest\(now\(\), coalesce\(v_current_end, v_current_period_end\)\)/);
  assert.match(trigger, /new\.ends_at := new\.starts_at \+ make_interval\(days => v_days\)/);
  assert.match(trigger, /new\.status := case when new\.starts_at > now\(\) then 'scheduled' else 'active' end/);
  assert.match(approve, /if v_current_plan = v_plan_code and v_plan_code in \('lite', 'pro'\) then[\s\S]*'scheduled'/);
});

test('exact expiry activates the due period before customer plan and trial reads', () => {
  assert.match(lifecycle, /v_account\.subscription_period_ends_at <= now\(\)/);
  assert.match(lifecycle, /state = 'scheduled'\s+and period_starts_at <= now\(\)/);
  assert.match(lifecycle, /update public\.user_entitlements set status = 'active'/);
  assert.match(plan, /perform public\.refresh_subscription_lifecycle\(v_user_id\)/);
  assert.match(modelPlan, /perform public\.refresh_subscription_lifecycle\(v_user_id\)/);
  assert.match(modelPlan, /entitlement\.starts_at <= now\(\)/);
  assert.match(trial, /perform public\.refresh_subscription_lifecycle\(p_user_id\)/);
  assert.match(plan, /e\.starts_at <= now\(\)/);
  assert.match(plan, /e\.ends_at is null or e\.ends_at > now\(\)/);
  assert.match(activate, /auth\.role\(\)\) <> 'service_role'/);
  assert.match(activate, /perform public\.refresh_subscription_lifecycle\(p_user_id\)/);
  assert.match(sql, /revoke all on function public\.activate_due_subscription_period_for_access\(uuid\)\s+from public, anon, authenticated/);
});

test('future entitlement cannot supply current Lite video allowance or media funding', () => {
  assert.match(reserve, /perform public\.refresh_subscription_lifecycle\(p_user_id\)/);
  assert.match(reserve, /entitlement\.status = 'active'\s+and entitlement\.starts_at <= now\(\)\s+and \(entitlement\.ends_at is null or entitlement\.ends_at > now\(\)\)/);
  assert.match(reserve, /v_account\.lite_video_entitlement_id is distinct from v_entitlement_id/);
  assert.match(reserve, /v_funding_source := 'lite_included_video'/);
});

test('future entitlement cannot open a model trial scope early', () => {
  assert.match(trial, /entitlement\.status = 'active'\s+and entitlement\.starts_at <= now\(\)\s+and \(entitlement\.ends_at is null or entitlement\.ends_at > now\(\)\)/);
  assert.match(trial, /v_scope := 'entitlement:' \|\| v_entitlement_id::text/);
});

function maxPeriod(oldPlan: 'pro' | 'max' | null, subscription: number, priorRollover: number, purchased: number, allowance = 7500) {
  const cap = Number(approve.match(/greatest\(v_account\.subscription_balance - v_account\.subscription_rollover_balance, 0\),\s*(\d+),\s*9000 - v_allowance/)?.[1]);
  assert.equal(cap, 1500);
  const rollover = oldPlan === 'max' ? Math.min(Math.max(subscription - priorRollover, 0), cap, 9000 - allowance) : 0;
  const ledger = [
    ...(subscription > 0 ? [-subscription] : []),
    allowance,
    ...(rollover > 0 ? [rollover] : []),
  ];
  return { subscription: allowance + rollover, purchased, rollover, ledger, delta: ledger.reduce((sum, amount) => sum + amount, 0) };
}

test('Pro to MAX upgrade has no lower-plan rollover and preserves purchased credits', () => {
  assert.match(approve, /v_max_rollover := case when v_current_plan = 'max' then least\(/);
  assert.match(approve, /if v_current_plan in \('lite', 'pro'\) then[\s\S]*update public\.user_entitlements e set status = 'cancelled'[\s\S]*e\.status = 'scheduled'/);
  assert.deepEqual(maxPeriod('pro', 3000, 0, 800), {
    subscription: 7500, purchased: 800, rollover: 0, ledger: [-3000, 7500], delta: 4500,
  });
});

test('MAX to MAX carries at most 1500 and never carries old rollover twice', () => {
  assert.deepEqual(maxPeriod('max', 4000, 500, 900), {
    subscription: 9000, purchased: 900, rollover: 1500, ledger: [-4000, 7500, 1500], delta: 5000,
  });
  assert.equal(maxPeriod('max', 1200, 500, 900).rollover, 700);
});

test('Pro renewal cap stays 600 and purchased credits remain outside rollover', () => {
  assert.match(lifecycle, /v_rollover := least\(v_previous\.eligible_unused_at_close, 600\)/);
  assert.match(approve, /v_rollover := least\(v_previous_period\.eligible_unused_at_close, 600\)/);
  assert.match(lifecycle, /v_account\.subscription_balance - v_account\.subscription_rollover_balance/);
  assert.match(lifecycle, /balance = purchased_balance/);
  assert.match(approve, /balance = purchased_balance \+ v_allowance/);
  assert.doesNotMatch(approve.slice(approve.indexOf('v_max_rollover := case'), approve.indexOf('if v_current_plan in', approve.indexOf('v_max_rollover := case'))), /purchased_balance/);
});

test('MAX reset, base grant and rollover each have matching ordered ledger entries', () => {
  const reset = approve.indexOf('v_old_subscription := v_account.subscription_balance;', approve.indexOf('v_max_rollover := case'));
  const resetUpdate = approve.indexOf('subscription_balance = 0,', reset);
  const adjustment = approve.indexOf("'adjustment', -v_old_subscription, v_account.balance", reset);
  const baseUpdate = approve.indexOf('subscription_balance = v_allowance,', adjustment);
  const baseLedger = approve.indexOf("'payment:' || v_order.id::text,", baseUpdate);
  const rolloverUpdate = approve.indexOf('subscription_balance = subscription_balance + v_max_rollover', baseLedger);
  const rolloverLedger = approve.indexOf("'payment:' || v_order.id::text || ':max-rollover'", rolloverUpdate);
  assert.ok(reset < resetUpdate && resetUpdate < adjustment && adjustment < baseUpdate && baseUpdate < baseLedger && baseLedger < rolloverUpdate && rolloverUpdate < rolloverLedger);
  assert.match(approve, /if v_order\.order_kind = 'subscription' and v_plan_code = 'max'\s+and v_allowance > 9000 then/);
  assert.match(approve, /9000 - v_allowance/);
});

test('replayed and concurrent approval cannot repeat periods or credit mutations', () => {
  const orderLock = approve.indexOf('where id = p_payment_order_id for update');
  const replay = approve.indexOf("if v_order.status = 'approved' then", orderLock);
  const refresh = approve.indexOf('perform public.refresh_subscription_lifecycle', replay);
  const creditLock = approve.indexOf('for update;', refresh);
  const insertEntitlement = approve.indexOf('insert into public.user_entitlements', creditLock);
  assert.ok(orderLock >= 0 && orderLock < replay && replay < refresh && refresh < creditLock && creditLock < insertEntitlement);
  assert.match(approve.slice(replay, refresh), /'idempotent', true/);
  assert.match(approve, /'payment:' \|\| v_order\.id::text \|\| ':subscription-reset'/);
  assert.match(approve, /'payment:' \|\| v_order\.id::text \|\| ':max-rollover'/);
});
