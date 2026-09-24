export type ProviderAvailabilityCode =
  | 'runtime_disabled' | 'credential_missing' | 'missing_required_env'
  | 'adapter_misconfigured' | 'no_supported_routes' | 'health_check_failed'
  | 'capability_sync_failed' | 'no_usable_models' | 'ready';

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
  capabilitySyncFailed: boolean;
}): { code: ProviderAvailabilityCode; reason: string; detail: string | null } {
  if (!input.enabled || input.emergencyDisabled) return {
    code: 'runtime_disabled', reason: 'Provider routing is disabled.',
    detail: input.emergencyDisabled ? 'Emergency stop is active.' : null,
  };
  if (!input.registered) return { code: 'adapter_misconfigured', reason: 'Provider adapter is not configured.', detail: null };
  if (!input.credentialPresent) return { code: 'credential_missing', reason: 'Provider credential is missing.', detail: 'Configure the server-side provider API key.' };
  if (input.deploymentRequired && !input.deploymentPresent) return {
    code: 'missing_required_env', reason: 'A required provider setting is missing.',
    detail: 'Configure the server-side deployment setting.',
  };
  if (!input.endpointPresent || !input.configured) return {
    code: 'adapter_misconfigured', reason: 'Provider endpoint or adapter is misconfigured.', detail: null,
  };
  if (input.supportedRouteCount === 0) return {
    code: 'no_supported_routes', reason: 'No supported model routes are enabled.', detail: null,
  };
  if (input.capabilitySyncFailed) return {
    code: 'capability_sync_failed', reason: 'Model capability sync failed.', detail: 'Inspect model capability sync details in Models.',
  };
  if (input.usableModelCount === 0) return {
    code: 'no_usable_models', reason: 'No usable models are enabled for this provider.', detail: null,
  };
  if (input.lastError) return {
    code: 'health_check_failed', reason: 'A recent provider request or health check failed.', detail: input.lastError,
  };
  return { code: 'ready', reason: 'Provider is ready for routing.', detail: null };
}
