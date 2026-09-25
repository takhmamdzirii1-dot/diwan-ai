import assert from 'node:assert/strict';
import test from 'node:test';
import { createModelsDevCatalogAdapter, findModelsDevModel, indexModelsDevCatalog, lookupModelsDevModel, mapModelsDevCapabilities, vantraFallbackCapabilities } from './models-dev-catalog';
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

test('representative router and gateway identities resolve by exact provider then explicit namespace alias', () => {
  const index = indexModelsDevCatalog({
    openai: { models: { 'gpt-test': { id: 'gpt-test', tool_call: true } } },
    'z-ai': { models: { 'glm-5.3-flash': { id: 'glm-5.3-flash', modalities: { input: ['image'] } },
      'glm-5.3-flash-free': { id: 'glm-5.3-flash-free', tool_call: false } } },
    qwen: { models: { 'qwen3.8-flash': { id: 'qwen3.8-flash', structured_output: true } } },
    agnes: { models: { 'agnes-3.0-flash': { id: 'agnes-3.0-flash', tool_call: true } } },
  });
  const openRouter = lookupModelsDevModel(index, { providerId: 'openrouter', providerModelId: 'openai/gpt-test' });
  assert.equal(openRouter.model?.providerId, 'openai');
  assert.equal(openRouter.canonicalLookupId, 'openai/gpt-test');
  assert.equal(openRouter.aliasUsed, false);
  const vercel = lookupModelsDevModel(index, { providerId: 'vercel_ai_gateway', providerModelId: 'zai/glm-5.3-flash' });
  assert.equal(vercel.model?.providerId, 'z-ai');
  assert.equal(vercel.canonicalLookupId, 'z-ai/glm-5.3-flash');
  assert.equal(vercel.aliasUsed, true);
  const qwenGateway = lookupModelsDevModel(index, { providerId: 'vercel_ai_gateway', providerModelId: 'alibaba/qwen3.8-flash' });
  assert.equal(qwenGateway.model?.providerId, 'qwen');
  const orca = lookupModelsDevModel(index, { providerId: 'orca_router', providerModelId: 'z-ai/glm-5.3-flash-free' });
  assert.equal(orca.model?.modelId, 'glm-5.3-flash-free');
  assert.equal(mapModelsDevCapabilities(orca.model).tools, false);
  const agnes = lookupModelsDevModel(index, { providerId: 'agnes', providerModelId: 'agnes-3.0-flash' });
  assert.equal(agnes.model?.providerId, 'agnes');
  assert.equal(agnes.aliasUsed, false);
  assert.equal(lookupModelsDevModel(index, { providerId: 'orca_router', providerModelId: 'z-ai/glm-5.3-flash-free-v2' }).model, null);
  assert.equal(lookupModelsDevModel(index, { providerId: 'openrouter', providerModelId: 'GPT-5.6 Sol' }).model, null);
});

test('exact provider catalog evidence wins; per-capability route evidence remains authoritative', () => {
  const index = indexModelsDevCatalog({
    zai: { models: { 'glm-5.3-flash': { id: 'glm-5.3-flash', tool_call: true, structured_output: false } } },
    'z-ai': { models: { 'glm-5.3-flash': { id: 'glm-5.3-flash', tool_call: false } } },
  });
  const route = { id: 'vercel-route', providerId: 'vercel_ai_gateway', providerModelId: 'zai/glm-5.3-flash' };
  const lookup = lookupModelsDevModel(index, route);
  assert.equal(lookup.model?.providerId, 'zai');
  assert.equal(lookup.aliasUsed, false);
  const resolved = resolveRouteCapabilities({ route, modelsDev: mapModelsDevCapabilities(lookup.model), providerMetadata: { tools: false } });
  assert.equal(resolved.resolved.tools.state, 'unsupported');
  assert.equal(resolved.resolved.tools.source, 'provider_metadata');
  assert.equal(resolved.resolved.structuredOutput.state, 'unsupported');
  assert.equal(resolved.resolved.structuredOutput.source, 'models_dev');
  assert.equal(resolved.resolved.visionInput.state, 'unknown');
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
