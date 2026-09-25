import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/20260925050000_credit_pack_period_limits.sql', 'utf8');
const adminCreate = readFileSync('app/api/admin/payments/plans/route.ts', 'utf8');
const adminUpdate = readFileSync('app/api/admin/payments/plans/[id]/route.ts', 'utf8');

assert.match(sql, /entitlement\.status = 'active'/);
assert.match(sql, /plan\.plan_code in \('lite', 'pro', 'max'\)/);
assert.match(sql, /v_pack_plan is distinct from v_plan/);
assert.match(sql, /top_up_purchase_limit_per_period/);
assert.match(sql, /v_limit_text !~ '\^\[1-9\]\[0-9\]\{0,3\}\$'/);
assert.match(sql, /payment_order\.reviewed_at >= v_period_start/);
assert.match(sql, /payment_order\.plan_id = new\.plan_id/);
assert.match(sql, /if v_global_count >= 2 then[\s\S]*LITE_TOP_UP_LIMIT_REACHED/);
assert.match(sql, /if v_pack_count >= v_pack_limit then[\s\S]*TOP_UP_PACK_LIMIT_REACHED/);
assert.doesNotMatch(sql, /update public\.credits|credit_transactions|subscription_balance|purchased_balance/);
assert.match(adminCreate, /topUpPlanCode: z\.enum\(\['lite', 'pro', 'max'\]\)/);
assert.match(adminUpdate, /topUpPlanCode: z\.enum\(\['lite', 'pro', 'max'\]\)/);
assert.doesNotMatch(adminCreate, /topUpPlanCode: z\.enum\([^\n]*'free'/);
assert.doesNotMatch(adminUpdate, /topUpPlanCode: z\.enum\([^\n]*'free'/);

console.log('Credit-pack plan match, per-pack limit, Lite global cap and MAX scope are enforced by the forward-only guard');
