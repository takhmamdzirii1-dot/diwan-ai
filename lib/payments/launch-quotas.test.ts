import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const MIGRATION_SQL = readFileSync(
  new URL('../../supabase/migrations/20260922020000_launch_quotas_max_plan.sql', import.meta.url),
  'utf8'
);

// ── Canonical values live in the additive migration ─────────────────────────

test('chat allowances match the final launch quotas', () => {
  for (const row of [
    "('free', 120, 800",
    "('lite', 200, 1600",
    "('pro', 300, 3000",
    "('max', 500, 6500",
  ]) {
    assert.ok(MIGRATION_SQL.includes(row), `missing chat limit row ${row}`);
  }
});

test('MAX catalog carries the final commercial values', () => {
  for (const fragment of [
    'price_dzd = 9900',
    'unified_credits = 7500',
    'subscription_credit_allowance = 7500',
    'access_period_days = 30',
  ]) {
    assert.ok(MIGRATION_SQL.includes(fragment), `missing MAX catalog ${fragment}`);
  }
});

test('MAX renewal math caps rollover and period start', () => {
  assert.ok(MIGRATION_SQL.includes("'max_subscription_rollover'"));
  assert.ok(MIGRATION_SQL.includes("'rollover_cap', 1500"));
  assert.ok(MIGRATION_SQL.includes('least(v_allowance + v_max_rollover, 9000)'));
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
    assert.ok(!MIGRATION_SQL.includes(forbidden), `forbidden statement present: ${forbidden}`);
  }
  // fallback_enabled is seeded on insert but never overwritten on conflict.
  assert.ok(!MIGRATION_SQL.includes('fallback_enabled = excluded'));
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
