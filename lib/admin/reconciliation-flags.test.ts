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
