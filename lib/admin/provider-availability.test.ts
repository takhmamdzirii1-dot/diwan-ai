import assert from 'node:assert/strict';
import test from 'node:test';
import { providerAvailabilityReason } from './provider-availability';

const ready = {
  enabled: true, emergencyDisabled: false, registered: true, configured: true,
  credentialPresent: true, endpointPresent: true, deploymentPresent: true,
  deploymentRequired: false, supportedRouteCount: 1, usableModelCount: 1,
  lastError: null, capabilitySyncFailed: false,
};

test('unavailable provider reasons distinguish setup, routing, health and sync', () => {
  assert.equal(providerAvailabilityReason({ ...ready, credentialPresent: false }).code, 'credential_missing');
  assert.equal(providerAvailabilityReason({ ...ready, deploymentRequired: true, deploymentPresent: false }).code, 'missing_required_env');
  assert.equal(providerAvailabilityReason({ ...ready, endpointPresent: false }).code, 'adapter_misconfigured');
  assert.equal(providerAvailabilityReason({ ...ready, supportedRouteCount: 0 }).code, 'no_supported_routes');
  assert.equal(providerAvailabilityReason({ ...ready, capabilitySyncFailed: true }).code, 'capability_sync_failed');
  assert.equal(providerAvailabilityReason({ ...ready, usableModelCount: 0 }).code, 'no_usable_models');
  assert.equal(providerAvailabilityReason({ ...ready, lastError: 'TIMEOUT' }).code, 'health_check_failed');
  assert.equal(providerAvailabilityReason({ ...ready, emergencyDisabled: true }).code, 'runtime_disabled');
});
