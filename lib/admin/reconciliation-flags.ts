export const RECONCILIATION_FLAGS = [
  'accepted_no_result',
  'cost_without_success',
  'mismatched_terminal_state',
  'repeated_provider_failure',
] as const;

export type ReconciliationFlag = (typeof RECONCILIATION_FLAGS)[number];

const allowedFlags = new Set<string>(RECONCILIATION_FLAGS);
const successfulProviderStates = new Set(['completed', 'succeeded', 'success']);
const failedProviderStates = new Set([
  'cancelled', 'canceled', 'error', 'failed', 'rejected', 'timeout', 'unavailable',
]);

export function reconciliationFlags(input: {
  stored?: unknown;
  executionState: string;
  failureCategory?: string | null;
  providerStatus?: string | null;
  providerCostRecorded?: boolean;
  failedAttemptCount?: number;
}) {
  const flags = new Set<ReconciliationFlag>();
  if (Array.isArray(input.stored)) {
    for (const value of input.stored) {
      if (typeof value === 'string' && allowedFlags.has(value)) flags.add(value as ReconciliationFlag);
    }
  }
  if (input.failureCategory === 'accepted_no_result') flags.add('accepted_no_result');
  if (input.providerCostRecorded && input.executionState !== 'completed') flags.add('cost_without_success');

  const providerStatus = input.providerStatus?.trim().toLowerCase() ?? '';
  if ((input.executionState === 'completed' && failedProviderStates.has(providerStatus))
    || (input.executionState !== 'completed' && successfulProviderStates.has(providerStatus))) {
    flags.add('mismatched_terminal_state');
  }
  if ((input.failedAttemptCount ?? 0) >= 2) flags.add('repeated_provider_failure');
  return RECONCILIATION_FLAGS.filter((flag) => flags.has(flag));
}
