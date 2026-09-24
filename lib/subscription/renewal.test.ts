import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyRenewalContext,
  renewalEventFor,
  renewalReminderState,
} from './renewal';

const NOW = Date.parse('2026-09-22T10:00:00Z');
const day = 86_400_000;

// Reminder derives from the exact expiration timestamp, never calendar math.
test('no reminder for free plans or missing expiry', () => {
  assert.equal(renewalReminderState({ planCode: 'free', planEndsAt: new Date(NOW + day).toISOString(), nowMs: NOW }), null);
  assert.equal(renewalReminderState({ planCode: 'pro', planEndsAt: null, nowMs: NOW }), null);
  assert.equal(renewalReminderState({ planCode: 'pro', planEndsAt: 'not-a-date', nowMs: NOW }), null);
});

test('reminder tiers at day 25 and day 29 of a 30-day period', () => {
  const start = NOW - 24 * day;
  const endsAt = new Date(start + 30 * day).toISOString();
  // Day 24: six days left → silent.
  assert.equal(renewalReminderState({ planCode: 'pro', planEndsAt: endsAt, nowMs: start + 24 * day }), null);
  // Day 25: five days left → expiring soon.
  assert.deepEqual(renewalReminderState({ planCode: 'pro', planEndsAt: endsAt, nowMs: start + 25 * day }), {
    kind: 'expiring_soon', daysLeft: 5, expiresAt: endsAt,
  });
  // Day 29: one day left → ending soon.
  assert.deepEqual(renewalReminderState({ planCode: 'pro', planEndsAt: endsAt, nowMs: start + 29 * day }), {
    kind: 'ending_soon', daysLeft: 1, expiresAt: endsAt,
  });
  // Day 30: expired → silent (lapsed path owns this state).
  assert.equal(renewalReminderState({ planCode: 'pro', planEndsAt: endsAt, nowMs: start + 30 * day }), null);
});

// Renewal extends; classification separates early, reactivation, upgrade.
test('same-plan renewal before expiry is early, after expiry is reactivation', () => {
  assert.equal(
    classifyRenewalContext({ lifecycleType: 'same_plan_renewal', wasLapsed: false, orderKind: 'subscription' }),
    'early_renewal'
  );
  assert.equal(
    classifyRenewalContext({ lifecycleType: 'same_plan_renewal', wasLapsed: true, orderKind: 'subscription' }),
    'reactivation'
  );
  assert.equal(
    classifyRenewalContext({ lifecycleType: 'upgrade', wasLapsed: false, orderKind: 'subscription' }),
    'upgrade'
  );
  assert.equal(
    classifyRenewalContext({ lifecycleType: 'new_subscription', wasLapsed: false, orderKind: 'subscription' }),
    'new'
  );
  assert.equal(
    classifyRenewalContext({ lifecycleType: null, wasLapsed: false, orderKind: 'credit_pack' }),
    'top_up'
  );
});

test('renewal and reactivation map to distinct started/completed/failed events', () => {
  assert.equal(renewalEventFor('started', 'early_renewal'), 'renewal_started');
  assert.equal(renewalEventFor('completed', 'early_renewal'), 'renewal_completed');
  assert.equal(renewalEventFor('failed', 'early_renewal'), 'renewal_failed');
  assert.equal(renewalEventFor('started', 'reactivation'), 'reactivation_started');
  assert.equal(renewalEventFor('completed', 'reactivation'), 'reactivation_completed');
  assert.equal(renewalEventFor('failed', 'reactivation'), 'reactivation_failed');
  assert.equal(renewalEventFor('completed', 'upgrade'), null);
  assert.equal(renewalEventFor('completed', 'new'), null);
  assert.equal(renewalEventFor('completed', 'top_up'), null);
});
