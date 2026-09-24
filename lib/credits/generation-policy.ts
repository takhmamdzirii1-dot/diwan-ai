export type GenerationTerminalState =
  | 'completed'
  | 'failed'
  | 'partial_failed'
  | 'user_cancelled'
  | 'provider_cancelled';

export type GenerationFailureOwner = 'customer' | 'provider' | 'vantra' | null;

/**
 * Customer credits and provider economics are deliberately independent.
 * Only a completed result charges the configured request price. A stopped
 * request may charge a smaller amount only when the server already has an
 * authoritative credit amount for the consumed portion.
 */
export function resolveTerminalCustomerCharge(input: {
  state: GenerationTerminalState;
  configuredCharge: number;
  authoritativeConsumedCredits?: number | null;
}) {
  const { state, configuredCharge, authoritativeConsumedCredits } = input;
  if (!Number.isSafeInteger(configuredCharge) || configuredCharge < 0) {
    throw new Error('INVALID_CONFIGURED_CHARGE');
  }
  if (state === 'completed') return configuredCharge;
  if (state !== 'user_cancelled' || authoritativeConsumedCredits == null) return 0;
  if (!Number.isSafeInteger(authoritativeConsumedCredits)
    || authoritativeConsumedCredits < 0
    || authoritativeConsumedCredits > configuredCharge) {
    throw new Error('INVALID_AUTHORITATIVE_USAGE_CHARGE');
  }
  return authoritativeConsumedCredits;
}

export function failureStateForInterruptedStream(outputStarted: boolean) {
  return outputStarted ? 'partial_failed' as const : 'failed' as const;
}

export function providerFailureCategory(code: string, providerStarted: boolean) {
  if (!providerStarted) return 'pre_execution';
  if (/REJECTED|VALIDATION|INVALID_|UNSUPPORTED_/.test(code)) return 'provider_rejection';
  if (/TIMEOUT|NETWORK|TRANSIENT|UNAVAILABLE/.test(code)) return 'provider_unavailable';
  if (/RESULT_NOT_READY|INVALID_RESPONSE/.test(code)) return 'accepted_no_result';
  if (/CANCELLED|CANCELED|INTERRUPTED/.test(code)) return 'interrupted';
  return 'provider_execution';
}
