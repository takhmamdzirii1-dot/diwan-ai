import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRouteCapabilities } from './capability-v2';

const routeA = { id: 'a', providerId: 'provider-one', providerModelId: 'model-one' };
const routeB = { id: 'b', providerId: 'provider-two', providerModelId: 'model-two' };

test('catalog and provider metadata resolve without a provider call; unknown stays disabled', () => {
  const result = resolveRouteCapabilities({ route: routeA, catalog: { streaming: true, visionInput: true }, providerMetadata: { visionInput: false } });
  assert.equal(result.resolved.streaming.state, 'supported');
  assert.equal(result.resolved.streaming.source, 'vantra_catalog');
  assert.equal(result.resolved.visionInput.state, 'unsupported');
  assert.equal(result.resolved.visionInput.source, 'provider_metadata');
  assert.equal(result.resolved.tools.state, 'unknown');
});

test('active route, provider identity and manual overrides are authoritative', () => {
  const first = resolveRouteCapabilities({ route: routeA, providerMetadata: { visionInput: true } });
  const store = { a: { ...first.record, overrides: { visionInput: 'force_disabled' as const } } };
  assert.equal(resolveRouteCapabilities({ route: routeA, stored: store }).resolved.visionInput.state, 'unsupported');
  assert.equal(resolveRouteCapabilities({ route: routeB, stored: store }).resolved.visionInput.state, 'unknown');
  assert.equal(resolveRouteCapabilities({ route: { ...routeA, providerModelId: 'changed' }, stored: store }).resolved.visionInput.state, 'unknown');
  const enabled = { a: { ...first.record, overrides: { visionInput: 'force_enabled' as const } } };
  assert.equal(resolveRouteCapabilities({ route: routeA, stored: enabled, providerMetadata: { visionInput: false } }).resolved.visionInput.state, 'supported');
});

test('cached verified evidence survives an empty sync; no probe is required', () => {
  const first = resolveRouteCapabilities({ route: routeA, providerMetadata: { tools: true }, now: '2026-09-25T00:00:00Z' });
  const second = resolveRouteCapabilities({ route: routeA, stored: { a: first.record } });
  assert.equal(second.resolved.tools.state, 'supported');
  assert.equal(second.resolved.tools.checkedAt, '2026-09-25T00:00:00Z');
});
