import assert from 'node:assert/strict';
import test from 'node:test';
import { isClientFunnelEvent } from './client-funnel-events';

test('payment and lifecycle outcomes cannot be forged through the client event route', () => {
  for (const event of [
    'payment_approved', 'payment_rejected',
    'renewal_completed', 'renewal_failed',
    'reactivation_completed', 'reactivation_failed',
    'model_trial_used', 'model_trial_exhausted',
  ]) assert.equal(isClientFunnelEvent(event), false, event);
});

test('client lifecycle intent and reminder events remain recordable', () => {
  for (const event of ['renewal_started', 'reactivation_started', 'renewal_reminder_shown']) {
    assert.equal(isClientFunnelEvent(event), true, event);
  }
});
