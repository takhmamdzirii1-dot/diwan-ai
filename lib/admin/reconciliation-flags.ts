export const RECONCILIATION_FLAGS = [
  'accepted_no_result',
  'cost_without_success',
  'mismatched_terminal_state',
  'repeated_provider_failure',
  'customer_charged_provider_failed',
  'customer_released_provider_succeeded',
  'stale',
  'abandoned',
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
  creditsCharged?: number;
  reservationState?: string | null;
  createdAt?: string;
  now?: number;
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
  if ((input.creditsCharged ?? 0) > 0 && failedProviderStates.has(providerStatus)) flags.add('customer_charged_provider_failed');
  if (input.reservationState === 'released' && successfulProviderStates.has(providerStatus)) flags.add('customer_released_provider_succeeded');
  if (['reserved', 'streaming'].includes(input.executionState) && input.createdAt
    && (input.now ?? Date.now()) - Date.parse(input.createdAt) >= 30 * 60_000) flags.add('stale');
  return RECONCILIATION_FLAGS.filter((flag) => flags.has(flag));
}
