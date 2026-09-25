import assert from 'node:assert/strict';
import test from 'node:test';
import { eligibleTopUpRows, liteTopUpsRemaining, topUpPlanCode } from './top-up-catalog';
import { paidTopUpPlanLabel, topUpPackLimit, topUpPackLimitLabel } from './top-up-pack';

const packs = [
  { slug: 'lite_300', priceDzd: 1000, credits: 300, entitlement: { top_up_plan_code: 'lite' } },
  { slug: 'pro_500', priceDzd: 1200, credits: 500, entitlement: { top_up_plan_code: 'pro' } },
  { slug: 'pro_1000', priceDzd: 2000, credits: 1000, entitlement: { top_up_plan_code: 'pro' } },
  { slug: 'pro_2000', priceDzd: 3800, credits: 2000, entitlement: { top_up_plan_code: 'pro' } },
  { slug: 'legacy', priceDzd: 1, credits: 9999, entitlement: {} },
] as const;

test('Free and lapsed accounts receive no Top-up packs', () => {
  assert.deepEqual(eligibleTopUpRows(packs, null, null), []);
});

test('Lite receives only +300 and has two approvals per paid period', () => {
  assert.deepEqual(eligibleTopUpRows(packs, 'lite', liteTopUpsRemaining(0)).map((pack) => pack.slug), ['lite_300']);
  assert.equal(liteTopUpsRemaining(0), 2);
  assert.equal(liteTopUpsRemaining(1), 1);
  assert.equal(liteTopUpsRemaining(2), 0);
  assert.deepEqual(eligibleTopUpRows(packs, 'lite', liteTopUpsRemaining(2)), []);
});

test('a new paid period starts with a fresh Lite allowance', () => {
  const approvalsInNewPeriod = 0;
  assert.equal(liteTopUpsRemaining(approvalsInNewPeriod), 2);
});

test('Pro receives only explicitly configured Pro packs', () => {
  assert.deepEqual(eligibleTopUpRows(packs, 'pro', null).map((pack) => pack.slug), [
    'pro_500', 'pro_1000', 'pro_2000',
  ]);
});

test('cross-plan and untagged packs are excluded, including for MAX', () => {
  assert.equal(topUpPlanCode({ top_up_plan_code: 'lite' }), 'lite');
  assert.equal(topUpPlanCode({ top_up_plan_code: 'free' }), null);
  assert.deepEqual(eligibleTopUpRows(packs, 'max', null), []);
});

test('Admin labels exact paid-plan eligibility and supported period limits', () => {
  assert.equal(paidTopUpPlanLabel('lite'), 'Lite');
  assert.equal(paidTopUpPlanLabel('pro'), 'Pro');
  assert.equal(paidTopUpPlanLabel('max'), 'MAX');
  assert.equal(paidTopUpPlanLabel(null), 'Not configured');
  assert.equal(topUpPackLimit({ top_up_purchase_limit_per_period: 2 }), 2);
  assert.equal(topUpPackLimit({ top_up_purchase_limit_per_period: 0 }), null);
  assert.equal(topUpPackLimitLabel({ top_up_plan_code: 'lite' }), '2 / paid period');
  assert.equal(topUpPackLimitLabel({ top_up_plan_code: 'pro' }), 'No pack limit');
});
