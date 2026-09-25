import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveRouteCapabilities } from './capability-v2';
import { lookupModelsDevModel, indexModelsDevCatalog, mapModelsDevCapabilities, vantraFallbackCapabilities } from './models-dev-catalog';
import { normalizeProviderCapabilityMetadata, providerCapabilityBooleans } from './provider-capability-evidence';

test('OpenRouter model metadata supplies exact route evidence without treating response_format as structured output', () => {
  const route = { id: 'or-route', providerId: 'openrouter', providerModelId: 'nvidia/nemotron-3-ultra-550b-a55b:free' };
  const metadata = normalizeProviderCapabilityMetadata(route.providerId, route.providerModelId, { data: {
    id: route.providerModelId, architecture: { input_modalities: ['text', 'image'] },
    supported_parameters: ['tools', 'response_format', 'parallel_tool_calls'],
  } });
  assert.equal(metadata.matched, true);
  assert.equal(metadata.evidence.visionInput.state, 'supported');
  assert.equal(metadata.evidence.fileInput.state, 'unsupported');
  assert.equal(metadata.evidence.tools.state, 'supported');
  assert.equal(metadata.evidence.parallelTools.state, 'supported');
  assert.equal(metadata.evidence.structuredOutput.state, 'unsupported');
  assert.equal(metadata.evidence.streaming.reason, 'chat_stream_transport');
});

test('Vercel Gateway metadata is matched by backend ID and merged per capability with Models.dev', () => {
  const route = { id: 'gateway-route', providerId: 'vercel_ai_gateway', providerModelId: 'zai/glm-5.3-flash', customer_display_name: 'Gemini 3.8 Flash' };
  const metadata = normalizeProviderCapabilityMetadata(route.providerId, route.providerModelId, { data: [
    { id: route.providerModelId, modalities: { input: ['text', 'image'] }, supported_parameters: ['tools'] },
  ] });
  const modelsDev = indexModelsDevCatalog({ 'z-ai': { models: { 'glm-5.3-flash': {
    id: 'glm-5.3-flash', structured_output: true, modalities: { input: ['text', 'image', 'pdf'] },
  } } } });
  const lookup = lookupModelsDevModel(modelsDev, route);
  assert.equal(lookup.aliasUsed, true);
  const resolved = resolveRouteCapabilities({ route, providerMetadata: providerCapabilityBooleans(metadata),
    modelsDev: mapModelsDevCapabilities(lookup.model) });
  assert.equal(resolved.resolved.visionInput.source, 'provider_metadata');
  assert.equal(resolved.resolved.fileInput.state, 'unsupported');
  assert.equal(resolved.resolved.fileInput.source, 'provider_metadata');
  assert.equal(resolved.resolved.structuredOutput.state, 'unsupported');
  assert.equal(resolved.resolved.structuredOutput.source, 'provider_metadata');
  assert.equal(resolved.resolved.tools.state, 'supported');
  assert.equal(lookupModelsDevModel(modelsDev, { providerId: route.providerId, providerModelId: route.customer_display_name }).model, null);
});

test('OrcaRouter parses its documented modalities for the actual backend and keeps undocumented tools unknown', () => {
  const route = { id: 'orca-route', providerId: 'orca_router', providerModelId: 'tencent/hy3-free', customer_display_name: 'Gemini 3.8 Flash' };
  const metadata = normalizeProviderCapabilityMetadata(route.providerId, route.providerModelId, {
    id: route.providerModelId, supported_endpoint_types: ['openai'],
    architecture: { input_modalities: ['text'], output_modalities: ['text'] },
  });
  assert.equal(metadata.evidence.visionInput.state, 'unsupported');
  assert.equal(metadata.evidence.fileInput.state, 'unsupported');
  assert.equal(metadata.evidence.tools.state, 'unknown');
  assert.equal(metadata.evidence.structuredOutput.state, 'unknown');
  const resolved = resolveRouteCapabilities({ route, providerMetadata: providerCapabilityBooleans(metadata),
    modelsDev: { tools: true, visionInput: true } });
  assert.equal(resolved.resolved.visionInput.state, 'unsupported');
  assert.equal(resolved.resolved.tools.state, 'supported');
  assert.equal(resolved.resolved.tools.source, 'models_dev');
  const declared = normalizeProviderCapabilityMetadata(route.providerId, route.providerModelId, {
    id: route.providerModelId, capabilities: { tool_calling: true, structured_output: true },
  });
  assert.equal(declared.evidence.tools.state, 'supported');
  assert.equal(declared.evidence.structuredOutput.state, 'supported');
  assert.equal(normalizeProviderCapabilityMetadata(route.providerId, route.customer_display_name, {
    id: route.providerModelId, architecture: { input_modalities: ['text'] },
  }).matched, false);
});

test('dynamic router IDs cannot inherit a candidate model and Agnes fallback remains intact', () => {
  const catalog = indexModelsDevCatalog({ orcarouter: { models: { auto: { id: 'auto', tool_call: true } } } });
  const dynamic = { providerId: 'orca_router', providerModelId: 'orcarouter/auto' };
  assert.equal(lookupModelsDevModel(catalog, dynamic).model, null);
  const unknown = normalizeProviderCapabilityMetadata(dynamic.providerId, dynamic.providerModelId, { data: [
    { id: 'openai/gpt-test', architecture: { input_modalities: ['image'] } },
  ] });
  assert.equal(unknown.matched, false);
  assert.equal(unknown.reason, 'provider_model_not_found');
  assert.deepEqual(providerCapabilityBooleans(unknown), {});
  const agnes = { id: 'agnes-route', providerId: 'agnes', providerModelId: 'agnes-3.0-flash' };
  const resolved = resolveRouteCapabilities({ route: agnes, catalog: vantraFallbackCapabilities(agnes) });
  assert.equal(resolved.resolved.streaming.state, 'supported');
  assert.equal(resolved.resolved.visionInput.state, 'supported');
  assert.equal(resolved.resolved.tools.state, 'supported');
  assert.equal(resolved.resolved.fileInput.state, 'unknown');
});

test('Sync metadata reader has only a GET path and never calls inference endpoints', () => {
  const source = readFileSync(new URL('./provider-capability-fetch.server.ts', import.meta.url), 'utf8');
  assert.match(source, /method: 'GET'/);
  assert.doesNotMatch(source, /chat\/completions|generateContent|images\/generations|method: 'POST'/);
});
