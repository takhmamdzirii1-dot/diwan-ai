import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = readFileSync(
  new URL('../../supabase/migrations/20260925020000_final_plan_and_chat_config.sql', import.meta.url),
  'utf8',
);
const lifecycle = readFileSync(
  new URL('../../supabase/migrations/20260924020000_fix_subscription_period_and_max_ledger.sql', import.meta.url),
  'utf8',
);
const orderLifecycle = readFileSync(
  new URL('../../supabase/migrations/20260921020000_lite_allowance_cutover.sql', import.meta.url),
  'utf8',
);
const rejectionLifecycle = readFileSync(
  new URL('../../supabase/migrations/20260910020000_payment_lifecycle_integrity.sql', import.meta.url),
  'utf8',
);
const strictGuard = readFileSync(
  new URL('../../supabase/migrations/20260925040000_strict_top_up_plan_guard.sql', import.meta.url),
  'utf8',
);
const orderRoute = readFileSync(
  new URL('../../app/api/payments/orders/route.ts', import.meta.url),
  'utf8',
);

function definition(sql: string, name: string) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const end = sql.indexOf('\n$$;', start);
  assert.ok(end > start, `unterminated ${name}`);
  return sql.slice(start, end + 4);
}

const approve = definition(lifecycle, 'approve_manual_payment');
const reserve = definition(lifecycle, 'reserve_credits_v2_base');
const createOrder = definition(orderLifecycle, 'create_manual_payment_order');
const rejectOrder = definition(rejectionLifecycle, 'reject_manual_payment');

test('approved pack prices and Credits are configured server-side', () => {
  assert.match(config, /\('lite_300','Lite \+300','credit_pack',1000,300/);
  assert.match(config, /\('pro_500','Pro \+500','credit_pack',1200,500/);
  assert.match(config, /\('pro_1000','Pro \+1000','credit_pack',2000,1000/);
  assert.match(config, /\('pro_2000','Pro \+2000','credit_pack',3800,2000/);
});

test('client cannot submit plan economics and the database snapshots canonical values', () => {
  assert.match(orderRoute, /z\.object\(\{\s*planId: z\.string\(\)\.uuid\(\),\s*method: z\.enum/);
  assert.doesNotMatch(orderRoute, /priceDzd|creditsAmount|userId/);
  assert.match(createOrder, /select \* into v_plan from public\.payment_plans where id = p_plan_id and active = true/);
  assert.match(createOrder, /v_plan\.price_dzd, v_plan\.unified_credits, v_entitlement, v_reference, 'draft'/);
  assert.match(strictGuard, /v_pack_plan is distinct from v_plan/);
});

test('approval grants purchased Credits exactly once and never changes included videos', () => {
  const packBranch = approve.slice(
    approve.indexOf("if v_order.order_kind = 'credit_pack' then"),
    approve.indexOf("elsif v_order.order_kind = 'subscription' then"),
  );
  assert.match(packBranch, /purchased_balance = purchased_balance \+ v_order\.credits_amount/);
  assert.match(packBranch, /balance = balance \+ v_order\.credits_amount/);
  assert.doesNotMatch(packBranch, /subscription_balance|lite_video_remaining/);
  assert.match(approve, /where id = p_payment_order_id for update/);
  assert.match(approve, /if v_order\.status = 'approved' then[\s\S]*'idempotent', true/);
  assert.match(approve, /idempotency_key[^\n]*'payment:' \|\| v_order\.id::text/);
  assert.match(approve, /'source_bucket', case when v_order\.order_kind = 'subscription' then 'subscription' else 'purchased' end/);
  assert.doesNotMatch(rejectOrder, /public\.credits|public\.credit_transactions|user_entitlements/);
});

test('an active paid entitlement is required while purchased Credits survive expiry', () => {
  assert.match(approve, /v_order\.order_kind = 'credit_pack'[\s\S]*active_plan\.plan_code in \('lite', 'pro', 'max'\)/);
  assert.match(lifecycle, /balance = purchased_balance,\s*subscription_plan_code = null/);
  assert.match(reserve, /entitlement\.status = 'active'[\s\S]*plan\.plan_code in \('lite', 'pro', 'max'\)/);
  assert.match(reserve, /v_purchased_amount := p_amount - v_subscription_amount/);
  assert.match(reserve, /purchased_balance = purchased_balance - v_purchased_amount/);
});

test('Lite approval limit is serialized and scoped to the current paid period', () => {
  assert.match(strictGuard, /for update of entitlement/);
  assert.match(strictGuard, /payment_order\.status = 'approved'/);
  assert.match(strictGuard, /payment_order\.reviewed_at >= v_period_start/);
  assert.match(strictGuard, /if v_count >= 2 then[\s\S]*LITE_TOP_UP_LIMIT_REACHED/);
});
