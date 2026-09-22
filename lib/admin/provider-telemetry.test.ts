import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveProviderTelemetry } from './provider-telemetry';

test('provider telemetry keeps request states and recorded cost separate', () => {
  const rows = deriveProviderTelemetry('alpha', [
    { provider: 'alpha', state: 'completed', error_message: null, started_at: '2026-09-21T10:00:00Z', finished_at: '2026-09-21T10:00:02Z' },
    { provider: 'alpha', state: 'failed', error_message: 'Timeout', started_at: '2026-09-21T11:00:00Z', finished_at: '2026-09-21T11:00:03Z' },
    { provider: 'alpha', state: 'started', error_message: null, started_at: '2026-09-21T12:00:00Z', finished_at: null },
    { provider: 'beta', state: 'completed', error_message: null, started_at: '2026-09-21T13:00:00Z', finished_at: null },
  ], [
    { provider: 'alpha', provider_model: 'backend-one', actual_cost_minor: '125', currency: 'USD', created_at: '2026-09-21T10:00:04Z' },
    { provider: 'alpha', provider_model: 'backend-one', actual_cost_minor: null, currency: 'USD', created_at: '2026-09-21T12:00:04Z' },
    { provider: 'beta', provider_model: 'backend-one', actual_cost_minor: '900', currency: 'USD', created_at: '2026-09-21T13:00:04Z' },
  ], new Map([['backend-one', 'Visible Model']]), true, new Date('2026-09-22T00:00:00Z'));
  assert.equal(rows.successfulAttempts, 1);
  assert.equal(rows.terminalAttempts, 2);
  assert.deepEqual([rows.dailyUsage.at(-2)?.successful, rows.dailyUsage.at(-2)?.failed, rows.dailyUsage.at(-2)?.other], [1, 1, 1]);
  assert.equal(rows.dailyUsage.at(-2)?.spendUsdMinor, '125');
  assert.equal(rows.dailyUsage.at(-1)?.spendUsdMinor, null);
  assert.deepEqual(rows.costByModel.map((row) => [row.name, row.records, row.cost.minor]), [['Visible Model', 1, '125']]);
  assert.equal(rows.recentIssues[0]?.message, 'Timeout');
});

test('unknown cost does not become zero spend', () => {
  const rows = deriveProviderTelemetry('alpha', [], [
    { provider: 'alpha', provider_model: 'backend-one', actual_cost_minor: null, currency: 'USD', created_at: '2026-09-21T10:00:00Z' },
  ], new Map(), true, new Date('2026-09-22T00:00:00Z'));
  assert.equal(rows.dailyUsage.at(-2)?.spendUsdMinor, null);
  assert.equal(rows.costByModel.length, 0);
});
