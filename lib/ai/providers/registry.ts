import 'server-only';

import { validateProviderEndpoint } from './endpoint-security';

export type ProviderModality = 'chat' | 'image' | 'video';
export type ProviderAdapterKind =
  | 'openai-compatible-chat'
  | 'vercel-gateway'
  | 'runware-media'
  | 'microsoft-foundry-image'
  | 'pruna-video'
  | 'not-connected';

export type ServerProviderDefinition = {
  id: string;
  name: string;
  modalities: readonly ProviderModality[];
  adapter: ProviderAdapterKind;
  apiKeyEnv: readonly string[];
  baseUrlEnv?: string;
  fixedBaseUrl?: string;
  deploymentEnv?: string;
  configurable?: boolean;
};

export type ProviderRuntimeDescriptor = {
  provider_id: string;
  display_name?: string | null;
  adapter_type?: string | null;
  base_endpoint?: string | null;
  archived?: boolean | null;
};

const definitions = [
  { id: 'openrouter', name: 'OpenRouter', modalities: ['chat'], adapter: 'openai-compatible-chat', apiKeyEnv: ['OPENROUTER_API_KEY'], fixedBaseUrl: 'https://openrouter.ai/api/v1' },
  { id: 'vercel_ai_gateway', name: 'Vercel AI Gateway', modalities: ['chat', 'image'], adapter: 'vercel-gateway', apiKeyEnv: ['AI_GATEWAY_API_KEY', 'VERCEL_AI_GATEWAY_API_KEY'], fixedBaseUrl: 'https://ai-gateway.vercel.sh/v1' },
  { id: 'runware', name: 'Runware', modalities: ['image', 'video'], adapter: 'runware-media', apiKeyEnv: ['RUNWARE_API_KEY'], fixedBaseUrl: 'https://api.runware.ai/v1' },
  { id: 'agnes', name: 'Agnes Direct', modalities: ['chat'], adapter: 'openai-compatible-chat', apiKeyEnv: ['AGNES_API_KEY'], fixedBaseUrl: 'https://apihub.agnes-ai.com/v1' },
  { id: 'orca_router', name: 'Orca Router', modalities: ['chat'], adapter: 'openai-compatible-chat', apiKeyEnv: ['ORCAROUTER_API_KEY', 'ORCA_ROUTER_API_KEY'], fixedBaseUrl: 'https://api.orcarouter.ai/v1' },
  { id: 'pruna_ai', name: 'Pruna AI', modalities: ['video'], adapter: 'pruna-video', apiKeyEnv: ['PRUNA_API_KEY', 'PRUNA_AI_API_KEY'], baseUrlEnv: 'PRUNA_BASE_URL', fixedBaseUrl: 'https://api.pruna.ai/v1' },
  { id: 'microsoft_foundry', name: 'Microsoft Foundry', modalities: ['image'], adapter: 'microsoft-foundry-image', apiKeyEnv: ['AZURE_API_KEY', 'MICROSOFT_FOUNDRY_API_KEY'], baseUrlEnv: 'AZURE_ENDPOINT', deploymentEnv: 'MAI_IMAGE_DEPLOYMENT_NAME' },
  { id: 'pollinations', name: 'Pollinations', modalities: ['image'], adapter: 'not-connected', apiKeyEnv: [] },
  { id: 'puter', name: 'Puter', modalities: ['image'], adapter: 'not-connected', apiKeyEnv: [] },
] as const satisfies readonly ServerProviderDefinition[];

export const SERVER_PROVIDER_REGISTRY: readonly ServerProviderDefinition[] = definitions;

export function getServerProvider(providerId: string) {
  return SERVER_PROVIDER_REGISTRY.find((provider) => provider.id === providerId) ?? null;
}

export const ADMIN_CONFIGURABLE_ADAPTERS = ['openai-compatible-chat'] as const;

export function resolveServerProvider(providerId: string, runtime?: ProviderRuntimeDescriptor | null) {
  const registered = getServerProvider(providerId);
  if (registered) {
    const endpointOverride = registered.adapter === 'openai-compatible-chat'
      ? runtime?.base_endpoint?.trim() || undefined : undefined;
    return {
      ...registered,
      name: runtime?.display_name?.trim() || registered.name,
      fixedBaseUrl: endpointOverride ?? registered.fixedBaseUrl,
      configurable: registered.adapter === 'openai-compatible-chat',
    } satisfies ServerProviderDefinition;
  }
  if (!runtime || runtime.archived || runtime.provider_id !== providerId
    || runtime.adapter_type !== 'openai-compatible-chat'
    || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(providerId)) return null;
  return {
    id: providerId,
    name: runtime.display_name?.trim() || providerId,
    modalities: ['chat'],
    adapter: 'openai-compatible-chat',
    apiKeyEnv: [`VANTRA_PROVIDER_${providerId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`],
    fixedBaseUrl: runtime.base_endpoint?.trim(),
    configurable: true,
  } satisfies ServerProviderDefinition;
}

function firstEnvironmentValue(names: readonly string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

export function getProviderConnection(providerId: string, runtime?: ProviderRuntimeDescriptor | null) {
  const provider = resolveServerProvider(providerId, runtime);
  if (!provider) return null;
  const apiKey = firstEnvironmentValue(provider.apiKeyEnv);
  const configuredBaseUrl = provider.baseUrlEnv
    ? process.env[provider.baseUrlEnv]?.trim() || null
    : null;
  const rawBaseUrl = configuredBaseUrl ?? provider.fixedBaseUrl ?? null;
  let baseUrl: string | null = null;
  try { baseUrl = rawBaseUrl ? validateProviderEndpoint(rawBaseUrl) : null; } catch { baseUrl = null; }
  const deploymentName = provider.deploymentEnv
    ? process.env[provider.deploymentEnv]?.trim() || null
    : null;
  const configured = provider.adapter === 'openai-compatible-chat'
    || provider.adapter === 'vercel-gateway'
    ? Boolean(apiKey && baseUrl)
    : provider.adapter === 'runware-media'
      ? Boolean(apiKey && baseUrl)
      : provider.adapter === 'microsoft-foundry-image'
      ? Boolean(apiKey && baseUrl && deploymentName)
      : provider.adapter === 'pruna-video'
      ? Boolean(apiKey && baseUrl)
      : false;
  return { provider, apiKey, baseUrl, deploymentName, configured };
}

export function providerConfigurationSummary(providerId: string, runtime?: ProviderRuntimeDescriptor | null) {
  const connection = getProviderConnection(providerId, runtime);
  return {
    registered: Boolean(connection),
    configured: Boolean(connection?.configured),
    adapter: connection?.provider.adapter ?? 'not-connected',
  };
}
