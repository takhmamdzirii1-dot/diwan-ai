import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const QUOTAS_SQL = readFileSync(
  new URL('../../supabase/migrations/20260922020000_launch_quotas_max_plan.sql', import.meta.url),
  'utf8'
);

const FROZEN_SQL = readFileSync(
  new URL('../../supabase/migrations/20260922030000_frozen_max_launch_config.sql', import.meta.url),
  'utf8'
);

const TOKEN = 'launch-quotas-max-20260922';

// ── Canonical values live in the additive migration ─────────────────────────

test('chat allowances match the final launch quotas', () => {
  for (const row of [
    "('free', 120, 800",
    "('lite', 200, 1600",
    "('pro', 300, 3000",
    "('max', 500, 6500",
  ]) {
    assert.ok(QUOTAS_SQL.includes(row), `missing chat limit row ${row}`);
  }
});

test('failed catalog update was removed from the corrected file', () => {
  assert.ok(!QUOTAS_SQL.includes('update public.payment_plans'), 'catalog update must live in the guarded file only');
  assert.ok(!QUOTAS_SQL.includes('vantra.frozen_plan_config'), 'token must live in the guarded file only');
});

test('MAX catalog carries the final commercial values', () => {
  for (const fragment of [
    'price_dzd = 9900',
    'unified_credits = 7500',
    'subscription_credit_allowance = 7500',
    'access_period_days = 30',
  ]) {
    assert.ok(FROZEN_SQL.includes(fragment), `missing MAX catalog ${fragment}`);
  }
});

test('MAX renewal math caps rollover and period start', () => {
  assert.ok(QUOTAS_SQL.includes("'max_subscription_rollover'"));
  assert.ok(QUOTAS_SQL.includes("'rollover_cap', 1500"));
  assert.ok(QUOTAS_SQL.includes('least(v_allowance + v_max_rollover, 9000)'));
});

test('migration never rewrites history or launch visibility', () => {
  for (const forbidden of [
    'delete from public.payment_orders',
    'delete from public.user_entitlements',
    'delete from public.credit_transactions',
    'delete from public.credits',
    'public_visible =',
    'frozen =',
  ]) {
    assert.ok(!FROZEN_SQL.includes(forbidden), `forbidden statement present: ${forbidden}`);
  }
  // fallback_enabled is seeded on insert but never overwritten on conflict.
  assert.ok(!QUOTAS_SQL.includes('fallback_enabled = excluded'));
});

// ── Frozen-plan update path: trigger stays armed ────────────────────────────

test('frozen protection is never disabled, weakened, or unfreezing', () => {
  for (const forbidden of [
    'disable trigger protect_frozen',
    'DISABLE TRIGGER',
    'session_replication_role',
    'drop trigger if exists protect_frozen',
    'frozen = false',
  ]) {
    assert.ok(!FROZEN_SQL.includes(forbidden), `forbidden bypass present: ${forbidden}`);
  }
  // The original guard still raises on every commercial change.
  assert.ok(FROZEN_SQL.includes("message = 'PAYMENT_PLAN_FROZEN'"));
});

test('exception requires the single-use token and pinned identity/visibility', () => {
  assert.ok(FROZEN_SQL.includes(`set local vantra.frozen_plan_config = '${TOKEN}'`));
  assert.ok(FROZEN_SQL.includes('reset vantra.frozen_plan_config;'));
  assert.ok(FROZEN_SQL.includes(`current_setting('vantra.frozen_plan_config', true) = '${TOKEN}'`));
  for (const pinned of [
    'slug', 'plan_code', 'name', 'description', 'active', 'featured',
    'entitlement', 'public_visible', 'eligibility_required', 'frozen',
  ]) {
    assert.ok(
      FROZEN_SQL.includes(`new.${pinned} is not distinct from old.${pinned}`),
      `missing pin for ${pinned}`
    );
  }
});

// Executable spec of the trigger exception: mirror of the PL/pgSQL predicate.
function frozenUpdateBypassesTrigger(args: {
  frozen: boolean;
  tokenOptIn: boolean;
  changed: string[];
}): boolean {
  const pinned = new Set([
    'slug', 'plan_code', 'name', 'description', 'active', 'featured',
    'entitlement', 'public_visible', 'eligibility_required', 'frozen',
  ]);
  if (!args.frozen) return false; // non-frozen rows never reach the guard
  if (!args.tokenOptIn) return false;
  return args.changed.every((column) => !pinned.has(column));
}

test('exception matrix: token-gated commercial-only updates pass', () => {
  // The reviewed launch update: commercial columns only, token set.
  assert.equal(frozenUpdateBypassesTrigger({
    frozen: true, tokenOptIn: true,
    changed: ['price_dzd', 'unified_credits', 'subscription_credit_allowance', 'access_period_days', 'kind'],
  }), true);
});

test('exception matrix: everything else still raises', () => {
  // No token, even with commercial-only changes.
  assert.equal(frozenUpdateBypassesTrigger({
    frozen: true, tokenOptIn: false,
    changed: ['price_dzd'],
  }), false);
  // Token set but a launch flag moves.
  for (const flag of ['active', 'public_visible', 'frozen', 'plan_code', 'name', 'entitlement']) {
    assert.equal(frozenUpdateBypassesTrigger({
      frozen: true, tokenOptIn: true, changed: ['price_dzd', flag],
    }), false, `flag change must raise: ${flag}`);
  }
  // An empty UPDATE changes nothing and passes; DELETE on a frozen row is
  // handled by the trigger's untouched DELETE branch, which always raises.
  assert.equal(frozenUpdateBypassesTrigger({ frozen: true, tokenOptIn: true, changed: [] }), true);
});

// ── MAX renewal economics (executable spec of the SQL above) ────────────────
// Mirrors the renewed MAX branch: subscription-only rollover capped at
// 1,500, 7,500 base, 9,000 start cap. Top-up (purchased) balances are a
// separate bucket and never feed the cap.

function maxRenewal(subscriptionBalance: number, subscriptionRollover: number, allowance: number) {
  const rollover = Math.min(Math.max(subscriptionBalance - subscriptionRollover, 0), 1500);
  const start = Math.min(allowance + rollover, 9000);
  return { rollover, start };
}

test('fresh MAX period grants the base allowance with no rollover', () => {
  assert.deepEqual(maxRenewal(0, 0, 7500), { rollover: 0, start: 7500 });
});

test('MAX renewal carries at most 1,500 and starts capped at 9,000', () => {
  assert.deepEqual(maxRenewal(2000, 0, 7500), { rollover: 1500, start: 9000 });
  assert.deepEqual(maxRenewal(800, 0, 7500), { rollover: 800, start: 8300 });
});

test('prior rollover portion is excluded from the next rollover', () => {
  // 2,000 balance of which 1,500 is last period's rollover → only 500 fresh.
  assert.deepEqual(maxRenewal(2000, 1500, 7500), { rollover: 500, start: 8000 });
});

test('historical snapshots keep their own base under the same caps', () => {
  // A frozen pre-launch order snapshot still renews under live cap rules.
  assert.deepEqual(maxRenewal(1000, 0, 3000), { rollover: 1000, start: 4000 });
});
