import { CHAT_NATIVE_CAPABILITIES, type ChatNativeCapability, type CapabilityState } from './capability-v2';

export type CapabilityAdapterSignal = {
  state: CapabilityState;
  source: 'provider_metadata' | 'models_dev' | 'vantra_catalog' | 'cached';
  confidence: 'verified' | 'declared' | 'unknown';
  reason: string;
};
export type ProviderCapabilitySignal = CapabilityAdapterSignal & { source: 'provider_metadata' };
export type ProviderCapabilityEvidence = Record<ChatNativeCapability, ProviderCapabilitySignal>;
export type ProviderCapabilityResult = { matched: boolean; evidence: ProviderCapabilityEvidence; reason: string };

const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const strings = (value: unknown): string[] | null => Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;
const unknown = (): ProviderCapabilityEvidence => Object.fromEntries(CHAT_NATIVE_CAPABILITIES.map((key) => [key,
  { state: 'unknown', source: 'provider_metadata', confidence: 'unknown', reason: 'not_declared' }])) as ProviderCapabilityEvidence;
const declared = (value: boolean, reason: string): ProviderCapabilitySignal => ({
  state: value ? 'supported' : 'unsupported', source: 'provider_metadata', confidence: 'declared', reason,
});
const setBoolean = (evidence: ProviderCapabilityEvidence, key: ChatNativeCapability, value: unknown, reason: string) => {
  if (typeof value === 'boolean') evidence[key] = declared(value, reason);
};
const setModalities = (evidence: ProviderCapabilityEvidence, value: unknown, reason: string) => {
  const input = strings(object(value)?.input_modalities) ?? strings(object(value)?.input);
  if (!input) return;
  evidence.visionInput = declared(input.includes('image'), reason);
  evidence.fileInput = declared(input.includes('file') || input.includes('pdf'), reason);
};

export function normalizeProviderCapabilityMetadata(providerId: string, backendId: string, payload: unknown): ProviderCapabilityResult {
  const evidence = unknown();
  const root = object(payload);
  const data = root?.data;
  const models = Array.isArray(data) ? data : Array.isArray(root?.models) ? root.models : null;
  const model = models
    ? models.map(object).find((item) => item?.id === backendId) ?? null
    : object(data) ?? root;
  // A router alias must not inherit a candidate model's metadata.
  if (!model || model.id !== backendId) return { matched: false, evidence, reason: 'provider_model_not_found' };

  if (providerId === 'openrouter') {
    setModalities(evidence, model.architecture, 'openrouter_input_modalities');
    const parameters = strings(model.supported_parameters);
    if (parameters) {
      evidence.tools = declared(parameters.includes('tools'), 'openrouter_supported_parameters');
      evidence.structuredOutput = declared(parameters.includes('structured_outputs') || parameters.includes('response_format_json_schema'), 'openrouter_supported_parameters');
      if (parameters.includes('parallel_tool_calls')) evidence.parallelTools = declared(true, 'openrouter_supported_parameters');
    }
  } else if (providerId === 'vercel_ai_gateway') {
    setModalities(evidence, model.modalities ?? model.architecture, 'gateway_input_modalities');
    const parameters = strings(model.supported_parameters);
    if (parameters) {
      evidence.tools = declared(parameters.includes('tools'), 'gateway_supported_parameters');
      evidence.structuredOutput = declared(parameters.includes('structured_outputs'), 'gateway_supported_parameters');
      if (parameters.includes('parallel_tool_calls')) evidence.parallelTools = declared(true, 'gateway_supported_parameters');
    }
    const capabilities = object(model.capabilities);
    setBoolean(evidence, 'visionInput', capabilities?.vision, 'gateway_capabilities');
    setBoolean(evidence, 'fileInput', capabilities?.file_input ?? capabilities?.pdf_input, 'gateway_capabilities');
    setBoolean(evidence, 'tools', capabilities?.tool_calling ?? capabilities?.tools, 'gateway_capabilities');
    setBoolean(evidence, 'structuredOutput', capabilities?.structured_output, 'gateway_capabilities');
    setBoolean(evidence, 'parallelTools', capabilities?.parallel_tool_calls, 'gateway_capabilities');
  } else if (providerId === 'orca_router') {
    // Orca documents architecture modalities. Do not treat its OpenAI-compatible
    // transport or supported_endpoint_types as model-level tool evidence.
    setModalities(evidence, model.architecture, 'orca_input_modalities');
    const capabilities = object(model.capabilities);
    setBoolean(evidence, 'tools', capabilities?.tool_calling, 'orca_capabilities');
    setBoolean(evidence, 'structuredOutput', capabilities?.structured_output, 'orca_capabilities');
    setBoolean(evidence, 'parallelTools', capabilities?.parallel_tool_calls, 'orca_capabilities');
    setBoolean(evidence, 'fileInput', capabilities?.native_file_input, 'orca_capabilities');
  } else return { matched: false, evidence, reason: 'provider_adapter_unavailable' };

  // The configured Chat adapters use streaming transport for these providers.
  evidence.streaming = declared(true, 'chat_stream_transport');
  return { matched: true, evidence, reason: 'matched_provider_metadata' };
}

export function providerCapabilityBooleans(result: ProviderCapabilityResult | null): Partial<Record<ChatNativeCapability, boolean>> {
  const mapped: Partial<Record<ChatNativeCapability, boolean>> = {};
  if (!result?.matched) return mapped;
  for (const key of CHAT_NATIVE_CAPABILITIES) {
    if (result.evidence[key].state !== 'unknown') mapped[key] = result.evidence[key].state === 'supported';
  }
  return mapped;
}
