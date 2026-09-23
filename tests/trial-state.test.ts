import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveStudioAccess, trialExpiresAt, type AccessEntitlement } from '../lib/access/trial-state';

const createdAt = '2026-09-01T00:00:00.000Z';

test('uses auth account creation as the single seven day trial clock', () => {
  assert.equal(trialExpiresAt(createdAt), '2026-09-08T00:00:00.000Z');
  assert.equal(deriveStudioAccess({ createdAt, now: new Date('2026-09-07T23:59:59Z') }).kind, 'trial_active');
  assert.equal(deriveStudioAccess({ createdAt, now: new Date('2026-09-08T00:00:00Z') }).kind, 'trial_expired');
});

test('media counters do not alter the time based Chat trial state', () => {
  // Media exhaustion is enforced by the existing credit reservation RPCs;
  // this access state intentionally depends only on time and paid access.
  assert.equal(deriveStudioAccess({ createdAt, now: new Date('2026-09-05T00:00:00Z') }).kind, 'trial_active');
});

test('active paid access overrides the free trial clock', () => {
  const entitlement: AccessEntitlement = {
    plan_id: 'pro-plan', status: 'active', starts_at: '2026-09-02T00:00:00Z', ends_at: '2026-10-02T00:00:00Z',
    payment_plans: { plan_code: 'pro', name: 'Pro' },
  };
  assert.equal(deriveStudioAccess({ createdAt, now: new Date('2026-09-20T00:00:00Z'), entitlements: [entitlement] }).kind, 'paid_active');
});

test('previously paid users use the reactivation path after access expires', () => {
  const entitlement: AccessEntitlement = {
    plan_id: 'pro-plan', status: 'expired', starts_at: '2026-08-01T00:00:00Z', ends_at: '2026-09-01T00:00:00Z',
    payment_plans: { plan_code: 'pro', name: 'Pro' },
  };
  const state = deriveStudioAccess({ createdAt, now: new Date('2026-09-20T00:00:00Z'), entitlements: [entitlement] });
  assert.equal(state.kind, 'paid_lapsed');
  assert.equal(state.paidPlanCode, 'pro');
});

test('persists Lite-offer funnel state from auth metadata', () => {
  assert.equal(deriveStudioAccess({ createdAt, now: new Date('2026-09-20T00:00:00Z'), hasSeenLiteOffer: true }).hasSeenLiteOffer, true);
});
