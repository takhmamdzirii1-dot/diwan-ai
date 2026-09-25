import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRouteCapabilities } from './capability-v2';
import { createOpenRouterCapabilityCatalog } from './openrouter-capability-catalog';
import { normalizeProviderCapabilityMetadata, providerCapabilityBooleans } from './provider-capability-evidence';

const modelId = 'nvidia/nemotron-3-ultra-550b-a55b:free';
const model = {
  id: modelId,
  architecture: { input_modalities: ['text'], output_modalities: ['text'] },
  supported_parameters: ['include_reasoning', 'max_tokens', 'reasoning', 'reasoning_effort', 'seed', 'temperature', 'tool_choice', 'tools', 'top_p'],
};

test('one unauthenticated OpenRouter catalog GET matches the exact :free ID across lookups', async () => {
  let calls = 0;
  const catalog = createOpenRouterCapabilityCatalog(async (url, init) => {
    calls++;
    assert.equal(url, 'https://openrouter.ai/api/v1/models');
    assert.equal(init?.method, 'GET');
    assert.equal((init as RequestInit & { next?: { revalidate: number } }).next?.revalidate, 86_400);
    assert.equal(init?.headers, undefined);
    return new Response(JSON.stringify({ data: [model, { id: 'another/model', supported_parameters: [] }] }), { status: 200 });
  });
  const [first, second] = await Promise.all([catalog.find(modelId), catalog.find('another/model')]);
  assert.equal(calls, 1);
  assert.equal(first?.id, modelId);
  assert.equal(second?.id, 'another/model');
  assert.equal(await catalog.find('nvidia/nemotron-3-ultra-550b-a55b'), null);
  assert.equal(calls, 1);
});

test('Nemotron exact catalog fields resolve Vision, Tools, Structured Output and streaming correctly', async () => {
  const catalog = createOpenRouterCapabilityCatalog(async () => new Response(JSON.stringify({ data: [model] }), { status: 200 }));
  const found = await catalog.find(modelId);
  const metadata = normalizeProviderCapabilityMetadata('openrouter', modelId, found);
  assert.equal(metadata.matched, true);
  const resolved = resolveRouteCapabilities({
    route: { id: 'openrouter-route', providerId: 'openrouter', providerModelId: modelId },
    providerMetadata: providerCapabilityBooleans(metadata),
  }).resolved;
  assert.equal(resolved.visionInput.state, 'unsupported');
  assert.equal(resolved.tools.state, 'supported');
  assert.equal(resolved.structuredOutput.state, 'unsupported');
  assert.equal(resolved.fileInput.state, 'unsupported');
  assert.equal(resolved.parallelTools.state, 'unknown');
  assert.equal(resolved.streaming.state, 'supported');
  assert.equal(resolved.tools.source, 'provider_metadata');
});
