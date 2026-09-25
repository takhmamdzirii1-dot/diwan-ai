import assert from 'node:assert/strict';
import test from 'node:test';
import { createModelsDevCatalogAdapter, findModelsDevModel, indexModelsDevCatalog, mapModelsDevCapabilities, vantraFallbackCapabilities } from './models-dev-catalog';
import { resolveRouteCapabilities, routeAllowsAttachment } from './capability-v2';

const fixture = {
  openai: { models: { 'gpt-test': { id: 'gpt-test', modalities: { input: ['text', 'image', 'pdf'], output: ['text'] }, attachment: true, tool_call: true, structured_output: true } } },
  openrouter: { models: { 'shared-test': { id: 'shared-test', modalities: { input: ['text', 'image'] }, tool_call: true } } },
  agnes: { models: { 'agnes-3.0-flash': { id: 'agnes-3.0-flash', modalities: { input: ['text', 'image'] }, tool_call: true } } },
};

test('backend model identity drives lookup and catalog mappings', () => {
  const index = indexModelsDevCatalog(fixture);
  const route = { providerId: 'vercel_ai_gateway', providerModelId: 'openai/gpt-test', displayName: 'GPT-5.6 Sol' };
  const model = findModelsDevModel(index, route);
  assert.equal(model?.modelId, 'gpt-test');
  assert.deepEqual(mapModelsDevCapabilities(model), { visionInput: true, fileInput: true, tools: true, structuredOutput: true });
  assert.equal(findModelsDevModel(index, { providerId: 'openai', providerModelId: route.displayName }), null);
  assert.equal(findModelsDevModel(index, { providerId: 'orca_router', providerModelId: 'shared-test' }), null);
});

test('missing fields stay unknown; explicit false and route metadata override generic support', () => {
  const index = indexModelsDevCatalog({ demo: { models: { sparse: { id: 'sparse', attachment: true, tool_call: false } } } });
  const route = { id: 'route-one', providerId: 'demo', providerModelId: 'sparse' };
  const mapped = mapModelsDevCapabilities(findModelsDevModel(index, route));
  assert.deepEqual(mapped, { tools: false });
  const result = resolveRouteCapabilities({ route, modelsDev: { visionInput: true, tools: true }, providerMetadata: { visionInput: false } });
  assert.equal(result.resolved.visionInput.state, 'unsupported');
  assert.equal(result.resolved.visionInput.source, 'provider_metadata');
  assert.equal(result.resolved.tools.source, 'models_dev');
  assert.equal(result.resolved.parallelTools.state, 'unknown');
  const pdf = resolveRouteCapabilities({ route, modelsDev: { fileInput: true } });
  assert.equal(routeAllowsAttachment(pdf.resolved, 'application/pdf'), true);
  assert.equal(routeAllowsAttachment(pdf.resolved, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), false);
  const override = resolveRouteCapabilities({ route, modelsDev: { tools: true }, stored: { 'route-one': { ...result.record, overrides: { tools: 'force_disabled' } } } });
  assert.equal(override.resolved.tools.state, 'unsupported');
  assert.equal(override.resolved.tools.source, 'manual_override');
});

test('Agnes fallback fills only capabilities missing from a matched Models.dev model', () => {
  const route = { providerId: 'agnes', providerModelId: 'agnes-3.0-flash', displayName: 'GPT-5.6 Sol' };
  assert.deepEqual(vantraFallbackCapabilities(route), { streaming: true, visionInput: true, tools: true });
  const catalogModel = findModelsDevModel(indexModelsDevCatalog(fixture), route);
  assert.equal(catalogModel?.providerId, 'agnes');
  assert.equal(mapModelsDevCapabilities(catalogModel).visionInput, true);
  const merged = resolveRouteCapabilities({ route: { id: 'agnes-route', ...route },
    modelsDev: { ...mapModelsDevCapabilities(catalogModel), structuredOutput: false },
    catalog: vantraFallbackCapabilities(route) });
  assert.equal(merged.resolved.streaming.state, 'supported');
  assert.equal(merged.resolved.streaming.source, 'vantra_catalog');
  assert.equal(merged.resolved.visionInput.state, 'supported');
  assert.equal(merged.resolved.visionInput.source, 'models_dev');
  assert.equal(merged.resolved.tools.state, 'supported');
  assert.equal(merged.resolved.tools.source, 'models_dev');
  assert.equal(merged.resolved.structuredOutput.state, 'unsupported');
  assert.equal(merged.resolved.structuredOutput.source, 'models_dev');
  assert.equal(merged.resolved.fileInput.state, 'unknown');
  assert.equal(merged.resolved.parallelTools.state, 'unknown');
});

test('route evidence contains capability booleans, not raw catalog fields or secrets', () => {
  const catalog = indexModelsDevCatalog({ demo: { models: { test: { id: 'test', tool_call: true, api_key: 'secret-value' } } } });
  const route = { id: 'safe-route', providerId: 'demo', providerModelId: 'test' };
  const evidence = resolveRouteCapabilities({ route, modelsDev: mapModelsDevCapabilities(findModelsDevModel(catalog, route)) }).record;
  assert.equal(evidence.evidence.tools?.source, 'models_dev');
  assert.doesNotMatch(JSON.stringify(evidence), /secret-value|api_key/);
});

test('one cached catalog fetch is shared across model lookups and concurrent Sync requests', async () => {
  let calls = 0;
  let clock = 1_790_310_000_000;
  const adapter = createModelsDevCatalogAdapter(async (_url, init) => {
    calls++;
    assert.equal((init as RequestInit & { next?: { revalidate: number } }).next?.revalidate, 86_400);
    return new Response(JSON.stringify(fixture), { status: 200 });
  }, () => clock);
  const [first, second] = await Promise.all([adapter.load(), adapter.load()]);
  assert.equal(calls, 1);
  assert.equal(first.status, 'fresh');
  assert.ok(findModelsDevModel(first.catalog!, { providerId: 'openai', providerModelId: 'gpt-test' }));
  assert.ok(findModelsDevModel(second.catalog!, { providerId: 'agnes', providerModelId: 'agnes-3.0-flash' }));
  await adapter.load();
  assert.equal(calls, 1);
  clock += 86_400_001;
  await adapter.load();
  assert.equal(calls, 2);
});

test('failed refresh uses stale safe catalog evidence', async () => {
  let clock = 1_790_310_000_000;
  let calls = 0;
  const adapter = createModelsDevCatalogAdapter(async () => {
    calls++;
    if (calls > 1) throw new Error('NETWORK_ERROR');
    return new Response(JSON.stringify(fixture), { status: 200 });
  }, () => clock);
  await adapter.load();
  clock += 86_400_001;
  const stale = await adapter.load();
  assert.equal(stale.status, 'stale');
  assert.ok(findModelsDevModel(stale.catalog!, { providerId: 'openai', providerModelId: 'gpt-test' }));
});
