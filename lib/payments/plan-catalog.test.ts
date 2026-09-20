import assert from 'node:assert/strict';
import test from 'node:test';
import type { PaymentPlan } from './types';
import { isPublicCatalogPlan, isPurchasablePlan } from './plan-catalog';

const plan = (overrides: Partial<PaymentPlan>): PaymentPlan => ({
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'plan',
  planCode: 'pro',
  name: 'Pro',
  description: null,
  kind: 'subscription',
  priceDzd: 5000,
  unifiedCredits: 3000,
  active: true,
  displayOrder: 0,
  featured: true,
  accessPeriodDays: 30,
  publicVisible: true,
  ...overrides,
});

test('public catalog exposes only Free, Pro, and MAX', () => {
  assert.equal(isPublicCatalogPlan(plan({ planCode: 'free', priceDzd: 0, unifiedCredits: 0, active: false })), true);
  assert.equal(isPublicCatalogPlan(plan({ planCode: 'pro' })), true);
  assert.equal(isPublicCatalogPlan(plan({ planCode: 'max' })), true);
  assert.equal(isPublicCatalogPlan(plan({ planCode: 'lite', publicVisible: false })), false);
  assert.equal(isPublicCatalogPlan(plan({ planCode: 'lite', publicVisible: true })), false);
});

test('checkout excludes non-purchasable catalog entries', () => {
  assert.equal(isPurchasablePlan(plan({ planCode: 'free', priceDzd: 0, unifiedCredits: 0, active: false })), false);
  assert.equal(isPurchasablePlan(plan({ planCode: 'pro' })), true);
  assert.equal(isPurchasablePlan(plan({ planCode: 'pro', active: false })), false);
});
