import assert from 'node:assert/strict';
import test from 'node:test';
import {
  failureStateForInterruptedStream,
  resolveTerminalCustomerCharge,
} from './generation-policy';

test('preflight/provider/partial failures and provider cancellation charge zero', () => {
  for (const state of ['failed', 'partial_failed', 'provider_cancelled'] as const) {
    assert.equal(resolveTerminalCustomerCharge({ state, configuredCharge: 25 }), 0);
  }
});

test('success charges the configured server price exactly once at finalization', () => {
  assert.equal(resolveTerminalCustomerCharge({ state: 'completed', configuredCharge: 25 }), 25);
});

test('user cancellation charges only an authoritative bounded amount', () => {
  assert.equal(resolveTerminalCustomerCharge({ state: 'user_cancelled', configuredCharge: 25 }), 0);
  assert.equal(resolveTerminalCustomerCharge({
    state: 'user_cancelled',
    configuredCharge: 25,
    authoritativeConsumedCredits: 7,
  }), 7);
  assert.throws(() => resolveTerminalCustomerCharge({
    state: 'user_cancelled',
    configuredCharge: 25,
    authoritativeConsumedCredits: 26,
  }), /INVALID_AUTHORITATIVE_USAGE_CHARGE/);
});

test('interrupted streams distinguish no-output failure from partial failure', () => {
  assert.equal(failureStateForInterruptedStream(false), 'failed');
  assert.equal(failureStateForInterruptedStream(true), 'partial_failed');
});
