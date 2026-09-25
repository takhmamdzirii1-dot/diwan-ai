import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveStudioAccess, freeVideoDurationAllowed, generationAccessError, type AccessEntitlement } from '../lib/access/trial-state';

const createdAt = '2026-09-01T00:00:00.000Z';

test('Free media remains available after day seven', () => {
  assert.equal(deriveStudioAccess({ createdAt, now: new Date('2026-09-07T23:59:59Z') }).kind, 'trial_active');
  assert.equal(deriveStudioAccess({ createdAt, now: new Date('2026-10-08T00:00:00Z') }).kind, 'trial_active');
});

test('media counters do not alter the time based Chat trial state', () => {
  // Media exhaustion is enforced by the existing credit reservation RPCs;
  // this access state intentionally depends only on time and paid access.
  assert.equal(deriveStudioAccess({ createdAt, now: new Date('2026-09-05T00:00:00Z') }).kind, 'trial_active');
});

test('day eight keeps Chat and unused media open', () => {
  const access = deriveStudioAccess({ createdAt, now: new Date('2026-09-09T00:00:00Z') });
  assert.equal(generationAccessError(access, 'chat'), null);
  assert.equal(generationAccessError(access, 'image'), null);
  assert.equal(generationAccessError(access, 'video'), null);
});

test('Free video cannot exceed five seconds even when its model supports longer output', () => {
  assert.equal(freeVideoDurationAllowed('free', 5), true);
  assert.equal(freeVideoDurationAllowed('free', 6), false);
  assert.equal(freeVideoDurationAllowed('lite', 5), true);
  assert.equal(freeVideoDurationAllowed('lite', 6), false);
  assert.equal(freeVideoDurationAllowed('pro', 15), true);
});

test('active paid access overrides the free trial clock', () => {
  const entitlement: AccessEntitlement = {
    plan_id: 'pro-plan', status: 'active', starts_at: '2026-09-02T00:00:00Z', ends_at: '2026-10-02T00:00:00Z',
    payment_plans: { plan_code: 'pro', name: 'Pro' },
  };
  assert.equal(deriveStudioAccess({ createdAt, now: new Date('2026-09-20T00:00:00Z'), entitlements: [entitlement] }).kind, 'paid_active');
});

test('future renewal never replaces the current paid entitlement before its start', () => {
  const current: AccessEntitlement = {
    plan_id: 'lite-current', status: 'active', starts_at: '2026-09-01T00:00:00Z', ends_at: '2026-10-01T00:00:00Z',
    payment_plans: { plan_code: 'lite', name: 'Lite' },
  };
  const future: AccessEntitlement = {
    plan_id: 'lite-future', status: 'active', starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-10-31T00:00:00Z',
    payment_plans: { plan_code: 'lite', name: 'Lite' },
  };
  const before = deriveStudioAccess({ createdAt, now: new Date('2026-09-30T23:59:59.999Z'), entitlements: [future, current] });
  assert.equal(before.kind, 'paid_active');
  assert.equal(before.paidPlanId, 'lite-current');
  const atBoundary = deriveStudioAccess({ createdAt, now: new Date('2026-10-01T00:00:00Z'), entitlements: [future, current] });
  assert.equal(atBoundary.kind, 'paid_active');
  assert.equal(atBoundary.paidPlanId, 'lite-future');
});

test('previously paid users return to Free eligibility after expiry', () => {
  const entitlement: AccessEntitlement = {
    plan_id: 'pro-plan', status: 'expired', starts_at: '2026-08-01T00:00:00Z', ends_at: '2026-09-01T00:00:00Z',
    payment_plans: { plan_code: 'pro', name: 'Pro' },
  };
  const state = deriveStudioAccess({ createdAt, now: new Date('2026-09-20T00:00:00Z'), entitlements: [entitlement] });
  assert.equal(state.kind, 'trial_active');
  assert.equal(state.paidPlanCode, 'pro');
  assert.equal(generationAccessError(state, 'chat'), null);
  assert.equal(generationAccessError({ ...state, freeEligibility: 'review_required' }, 'chat'), 'FREE_ACCESS_RESTRICTED');
});

test('persists Lite-offer funnel state from auth metadata', () => {
  assert.equal(deriveStudioAccess({ createdAt, now: new Date('2026-09-20T00:00:00Z'), hasSeenLiteOffer: true }).hasSeenLiteOffer, true);
});
