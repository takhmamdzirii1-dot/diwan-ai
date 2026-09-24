export type ProviderAvailabilityCode =
  | 'runtime_disabled' | 'credential_missing' | 'missing_required_env'
  | 'adapter_misconfigured' | 'no_supported_routes' | 'health_degraded'
  | 'health_unavailable' | 'request_issue' | 'stale_error' | 'recovered'
  | 'capability_sync_failed' | 'no_usable_models' | 'ready_unverified' | 'ready';

export type ProviderHealthState = 'ready' | 'degraded' | 'unavailable';

const HEALTH_ERROR_WINDOW_MS = 60 * 60 * 1000;

const timestamp = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function errorScope(value: string): 'request' | 'auth' | 'infrastructure' | 'unknown' {
  const code = value.trim().toUpperCase();
  if (code === 'PROVIDER_REQUEST_REJECTED'
    || /(VALIDATION|INVALID_(REQUEST|INPUT|PARAMETER)|UNSUPPORTED|BAD_(INPUT|MEDIA)|CONTENT_REJECTED|MODEL_INPUT)/.test(code)) return 'request';
  if (/(AUTH|UNAUTHORIZED|FORBIDDEN|INVALID_CREDENTIAL|API_KEY)/.test(code)) return 'auth';
  if (/(TIMEOUT|TIMED_OUT|NETWORK|CONNECTION|ENDPOINT|UNAVAILABLE|OUTAGE|5\d\d|SERVER_ERROR|SERVICE_ERROR)/.test(code)) return 'infrastructure';
  return 'unknown';
}

export function classifyProviderRuntimeHealth(input: {
  lastError: string | null;
  lastErrorAt?: string | null;
  lastSuccessAt?: string | null;
  repeatedProviderFailure?: boolean;
  connectionTestSupported?: boolean;
  now?: Date;
}): { state: ProviderHealthState; code: ProviderAvailabilityCode; reason: string; detail: string | null } {
  if (!input.lastError) return input.connectionTestSupported === false
    ? { state: 'ready', code: 'ready_unverified', reason: 'Provider is configured and ready for routing.', detail: 'Connectivity is unverified because this adapter does not support a synthetic connection test.' }
    : { state: 'ready', code: 'ready', reason: 'Provider is ready for routing.', detail: null };

  const errorAt = timestamp(input.lastErrorAt);
  const successAt = timestamp(input.lastSuccessAt);
  if (errorAt !== null && successAt !== null && successAt >= errorAt) return {
    state: 'ready', code: 'recovered', reason: 'Provider is ready; a successful request followed the recorded error.', detail: input.lastError,
  };
  if (errorAt !== null && (input.now ?? new Date()).getTime() - errorAt > HEALTH_ERROR_WINDOW_MS) return {
    state: 'ready', code: 'stale_error', reason: 'Provider is ready; the recorded error is outside the health window.', detail: input.lastError,
  };

  const scope = errorScope(input.lastError);
  if (scope === 'request' || scope === 'unknown') return {
    state: 'ready', code: 'request_issue', reason: 'Provider is ready; the latest issue was request-specific.', detail: input.lastError,
  };
  if (scope === 'auth') return {
    state: 'unavailable', code: 'health_unavailable', reason: 'Provider authentication failed.', detail: input.lastError,
  };
  if (input.repeatedProviderFailure) return {
    state: 'unavailable', code: 'health_unavailable', reason: 'Repeated provider infrastructure failures make this route unusable.', detail: input.lastError,
  };
  return { state: 'degraded', code: 'health_degraded', reason: 'A recent provider infrastructure failure needs attention.', detail: input.lastError };
}

export function providerAvailabilityReason(input: {
  enabled: boolean;
  emergencyDisabled: boolean;
  registered: boolean;
  configured: boolean;
  credentialPresent: boolean;
  endpointPresent: boolean;
  deploymentPresent: boolean;
  deploymentRequired: boolean;
  supportedRouteCount: number;
  usableModelCount: number;
  lastError: string | null;
  lastErrorAt?: string | null;
  lastSuccessAt?: string | null;
  repeatedProviderFailure?: boolean;
  connectionTestSupported?: boolean;
  now?: Date;
  capabilitySyncFailed: boolean;
}): { state: ProviderHealthState; code: ProviderAvailabilityCode; reason: string; detail: string | null } {
  if (!input.enabled || input.emergencyDisabled) return {
    state: 'unavailable', code: 'runtime_disabled', reason: 'Provider routing is disabled.',
    detail: input.emergencyDisabled ? 'Emergency stop is active.' : null,
  };
  if (!input.registered) return { state: 'unavailable', code: 'adapter_misconfigured', reason: 'Provider adapter is not configured.', detail: null };
  if (!input.credentialPresent) return { state: 'unavailable', code: 'credential_missing', reason: 'Provider credential is missing.', detail: 'Configure the server-side provider API key.' };
  if (input.deploymentRequired && !input.deploymentPresent) return {
    state: 'unavailable', code: 'missing_required_env', reason: 'A required provider setting is missing.',
    detail: 'Configure the server-side deployment setting.',
  };
  if (!input.endpointPresent || !input.configured) return {
    state: 'unavailable', code: 'adapter_misconfigured', reason: 'Provider endpoint or adapter is misconfigured.', detail: null,
  };
  if (input.supportedRouteCount === 0) return {
    state: 'unavailable', code: 'no_supported_routes', reason: 'No supported model routes are enabled.', detail: null,
  };
  if (input.capabilitySyncFailed) return {
    state: 'unavailable', code: 'capability_sync_failed', reason: 'Model capability sync failed.', detail: 'Inspect model capability sync details in Models.',
  };
  if (input.usableModelCount === 0) return {
    state: 'unavailable', code: 'no_usable_models', reason: 'No usable models are enabled for this provider.', detail: null,
  };
  return classifyProviderRuntimeHealth(input);
}
