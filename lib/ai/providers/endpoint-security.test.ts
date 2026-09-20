import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProviderEndpoint } from './endpoint-security';
import { getProviderConnection, resolveServerProvider } from './registry';
import { routeSnapshot, type ResolvedProviderRoute } from './routes';

test('provider endpoints require public HTTPS destinations', () => {
  assert.equal(validateProviderEndpoint('https://api.example.com/v1/'), 'https://api.example.com/v1');
  for (const endpoint of [
    'http://api.example.com/v1', 'https://localhost/v1', 'https://service.local/v1',
    'https://127.0.0.1/v1', 'https://10.0.0.1/v1', 'https://169.254.169.254/latest/meta-data',
    'https://[::1]/v1', 'https://user:password@api.example.com/v1',
  ]) assert.throws(() => validateProviderEndpoint(endpoint), /PROVIDER_ENDPOINT_/);
});

test('configurable providers use only the slug-derived credential key', () => {
  const original = process.env.VANTRA_PROVIDER_HIGGSFIELD_API_KEY;
  process.env.VANTRA_PROVIDER_HIGGSFIELD_API_KEY = 'configured-for-test';
  try {
    const runtime = {
      provider_id: 'higgsfield', display_name: 'Higgsfield',
      adapter_type: 'openai-compatible-chat', base_endpoint: 'https://api.example.com/v1',
      credential_env: 'UNSAFE_ARBITRARY_ENV',
    } as const;
    const connection = getProviderConnection('higgsfield', runtime);
    assert.equal(connection?.configured, true);
    assert.equal(connection?.apiKey, 'configured-for-test');
    assert.equal(resolveServerProvider('../unsafe', { ...runtime, provider_id: '../unsafe' }), null);
    assert.equal(resolveServerProvider('higgsfield', { ...runtime, archived: true }), null);
  } finally {
    if (original == null) delete process.env.VANTRA_PROVIDER_HIGGSFIELD_API_KEY;
    else process.env.VANTRA_PROVIDER_HIGGSFIELD_API_KEY = original;
  }
});

test('internal execution snapshots omit endpoint and runtime credential config', () => {
  const route: ResolvedProviderRoute = {
    id: 'route-id', modelKey: 'custom:chat:stable', modelId: 'vantra-stable', modality: 'chat',
    providerId: 'higgsfield', providerModelId: 'private-provider-model', priority: 10, fallback: false,
    providerConfig: { provider_id: 'higgsfield', base_endpoint: 'https://api.example.com/v1' },
  };
  const snapshot = routeSnapshot(route);
  assert.equal('providerConfig' in snapshot, false);
  assert.equal('baseEndpoint' in snapshot, false);
  assert.equal(route.modelId, 'vantra-stable');
});
