import assert from 'node:assert/strict';
import test from 'node:test';
import { reconciliationFlags } from './reconciliation-flags';

test('derives only evidence-backed reconciliation flags', () => {
  assert.deepEqual(reconciliationFlags({
    executionState: 'failed',
    failureCategory: 'accepted_no_result',
    providerStatus: 'succeeded',
    providerCostRecorded: true,
    failedAttemptCount: 2,
  }), [
    'accepted_no_result',
    'cost_without_success',
    'mismatched_terminal_state',
    'repeated_provider_failure',
  ]);
});

test('preserves allowlisted stored flags and ignores unknown metadata', () => {
  assert.deepEqual(reconciliationFlags({
    executionState: 'completed',
    stored: ['accepted_no_result', 'not_a_real_flag'],
    providerStatus: 'completed',
  }), ['accepted_no_result']);
});

test('does not invent flags for a consistent successful execution', () => {
  assert.deepEqual(reconciliationFlags({
    executionState: 'completed',
    providerStatus: 'succeeded',
    providerCostRecorded: true,
    failedAttemptCount: 0,
  }), []);
});

test('media mismatches and stale/abandoned executions are evidence-backed', () => {
  assert.ok(reconciliationFlags({ executionState: 'completed', providerStatus: 'failed', creditsCharged: 20 }).includes('customer_charged_provider_failed'));
  assert.ok(reconciliationFlags({ executionState: 'failed', providerStatus: 'succeeded', reservationState: 'released' }).includes('customer_released_provider_succeeded'));
  assert.deepEqual(reconciliationFlags({ executionState: 'streaming', createdAt: '2026-10-03T10:00:00Z', now: Date.parse('2026-10-03T10:30:00Z') }), ['stale']);
  assert.deepEqual(reconciliationFlags({ executionState: 'failed', stored: ['abandoned'] }), ['abandoned']);
});
