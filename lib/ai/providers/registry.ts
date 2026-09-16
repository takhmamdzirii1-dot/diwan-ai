import 'server-only';

export type ProviderModality = 'chat' | 'image' | 'video';
export type ProviderAdapterKind =
  | 'openai-compatible-chat'
  | 'vercel-gateway'
  | 'runware-media'
  | 'microsoft-foundry-image'
  | 'not-connected';

export type ServerProviderDefinition = {
  id: string;
  name: string;
  modalities: readonly ProviderModality[];
  adapter: ProviderAdapterKind;
  apiKeyEnv: readonly string[];
  baseUrlEnv?: string;
  fixedBaseUrl?: string;
};

const definitions = [
  { id: 'openrouter', name: 'OpenRouter', modalities: ['chat'], adapter: 'openai-compatible-chat', apiKeyEnv: ['OPENROUTER_API_KEY'], fixedBaseUrl: 'https://openrouter.ai/api/v1' },
  { id: 'vercel_ai_gateway', name: 'Vercel AI Gateway', modalities: ['chat', 'image'], adapter: 'vercel-gateway', apiKeyEnv: ['AI_GATEWAY_API_KEY', 'VERCEL_AI_GATEWAY_API_KEY'], fixedBaseUrl: 'https://ai-gateway.vercel.sh/v1' },
  { id: 'runware', name: 'Runware', modalities: ['image', 'video'], adapter: 'runware-media', apiKeyEnv: ['RUNWARE_API_KEY'], fixedBaseUrl: 'https://api.runware.ai/v1' },
  { id: 'agnes', name: 'Agnes Direct', modalities: ['chat'], adapter: 'openai-compatible-chat', apiKeyEnv: ['AGNES_API_KEY'], fixedBaseUrl: 'https://apihub.agnes-ai.com/v1' },
  { id: 'microsoft_foundry', name: 'Microsoft Foundry', modalities: ['image'], adapter: 'microsoft-foundry-image', apiKeyEnv: ['MICROSOFT_FOUNDRY_API_KEY', 'AZURE_API_KEY'], baseUrlEnv: 'MICROSOFT_FOUNDRY_ENDPOINT' },
  { id: 'pollinations', name: 'Pollinations', modalities: ['image'], adapter: 'not-connected', apiKeyEnv: [] },
  { id: 'puter', name: 'Puter', modalities: ['image'], adapter: 'not-connected', apiKeyEnv: [] },
] as const satisfies readonly ServerProviderDefinition[];

export const SERVER_PROVIDER_REGISTRY: readonly ServerProviderDefinition[] = definitions;

export function getServerProvider(providerId: string) {
  return SERVER_PROVIDER_REGISTRY.find((provider) => provider.id === providerId) ?? null;
}

function firstEnvironmentValue(names: readonly string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

export function getProviderConnection(providerId: string) {
  const provider = getServerProvider(providerId);
  if (!provider) return null;
  const apiKey = firstEnvironmentValue(provider.apiKeyEnv);
  const baseUrl = provider.fixedBaseUrl
    ?? (provider.baseUrlEnv ? process.env[provider.baseUrlEnv]?.trim() || null : null);
  const configured = provider.adapter === 'openai-compatible-chat'
    || provider.adapter === 'vercel-gateway'
    ? Boolean(apiKey && baseUrl)
    : provider.adapter === 'runware-media'
      ? Boolean(apiKey && baseUrl)
      : provider.adapter === 'microsoft-foundry-image'
      ? Boolean(apiKey && baseUrl)
      : false;
  return { provider, apiKey, baseUrl, configured };
}

export function providerConfigurationSummary(providerId: string) {
  const connection = getProviderConnection(providerId);
  return {
    registered: Boolean(connection),
    configured: Boolean(connection?.configured),
    adapter: connection?.provider.adapter ?? 'not-connected',
  };
}
