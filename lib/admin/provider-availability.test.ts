import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyProviderRuntimeHealth, providerAvailabilityReason } from './provider-availability';

const ready = {
  enabled: true, emergencyDisabled: false, registered: true, configured: true,
  credentialPresent: true, endpointPresent: true, deploymentPresent: true,
  deploymentRequired: false, supportedRouteCount: 1, usableModelCount: 1,
  lastError: null, lastErrorAt: null, lastSuccessAt: null,
  repeatedProviderFailure: false, connectionTestSupported: true, capabilitySyncFailed: false,
};

test('unavailable provider reasons distinguish setup, routing and sync', () => {
  assert.equal(providerAvailabilityReason({ ...ready, credentialPresent: false }).code, 'credential_missing');
  assert.equal(providerAvailabilityReason({ ...ready, deploymentRequired: true, deploymentPresent: false }).code, 'missing_required_env');
  assert.equal(providerAvailabilityReason({ ...ready, endpointPresent: false }).code, 'adapter_misconfigured');
  assert.equal(providerAvailabilityReason({ ...ready, supportedRouteCount: 0 }).code, 'no_supported_routes');
  assert.equal(providerAvailabilityReason({ ...ready, capabilitySyncFailed: true }).code, 'capability_sync_failed');
  assert.equal(providerAvailabilityReason({ ...ready, usableModelCount: 0 }).code, 'no_usable_models');
  assert.equal(providerAvailabilityReason({ ...ready, emergencyDisabled: true }).code, 'runtime_disabled');
});

test('a single request rejection remains ready instead of marking the provider unavailable', () => {
  const result = providerAvailabilityReason({
    ...ready, lastError: 'PROVIDER_REQUEST_REJECTED', lastErrorAt: '2026-09-24T10:00:00.000Z',
    now: new Date('2026-09-24T10:10:00.000Z'),
  });
  assert.equal(result.state, 'ready');
  assert.equal(result.code, 'request_issue');
});

test('authentication and missing credentials make the provider unavailable', () => {
  assert.equal(providerAvailabilityReason({ ...ready, credentialPresent: false }).state, 'unavailable');
  assert.equal(providerAvailabilityReason({
    ...ready, lastError: 'PROVIDER_AUTH_FAILED', lastErrorAt: '2026-09-24T10:00:00.000Z',
    now: new Date('2026-09-24T10:10:00.000Z'),
  }).state, 'unavailable');
});

test('infrastructure failures degrade once and become unavailable only as a repeated pattern', () => {
  const failure = { ...ready, lastError: 'PROVIDER_TIMEOUT', lastErrorAt: '2026-09-24T10:00:00.000Z', now: new Date('2026-09-24T10:10:00.000Z') };
  assert.equal(providerAvailabilityReason(failure).state, 'degraded');
  assert.equal(providerAvailabilityReason({ ...failure, repeatedProviderFailure: true }).state, 'unavailable');
});

test('success and age clear stale error impact without erasing diagnostic history', () => {
  assert.equal(classifyProviderRuntimeHealth({
    lastError: 'PROVIDER_TIMEOUT', lastErrorAt: '2026-09-24T10:00:00.000Z',
    lastSuccessAt: '2026-09-24T10:01:00.000Z', now: new Date('2026-09-24T10:10:00.000Z'),
  }).code, 'recovered');
  assert.equal(classifyProviderRuntimeHealth({
    lastError: 'PROVIDER_TIMEOUT', lastErrorAt: '2026-09-24T08:00:00.000Z',
    now: new Date('2026-09-24T10:10:00.000Z'),
  }).code, 'stale_error');
});

test('an unsupported synthetic connection test does not imply unavailability', () => {
  const result = providerAvailabilityReason({ ...ready, connectionTestSupported: false });
  assert.equal(result.state, 'ready');
  assert.equal(result.code, 'ready_unverified');
});
