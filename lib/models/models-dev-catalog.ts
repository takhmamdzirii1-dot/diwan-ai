import type { ChatNativeCapability, RouteIdentity } from './capability-v2';

const CATALOG_URL = 'https://models.dev/api.json';
const CACHE_MS = 24 * 60 * 60 * 1000;
type ModelEntry = { providerId: string; modelId: string; value: Record<string, unknown> };
type Catalog = Map<string, ModelEntry[]>;
export type ModelsDevLookup = { model: ModelEntry | null; canonicalLookupId: string; aliasUsed: boolean };
export type CatalogStatus = 'fresh' | 'stale' | 'unavailable';
export type CatalogResult = { status: CatalogStatus; catalog: Catalog | null; checkedAt: string | null };

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const identity = (value: string) => value.trim().toLowerCase();

export function indexModelsDevCatalog(payload: unknown): Catalog {
  const index: Catalog = new Map();
  const root = record(payload);
  if (!root) return index;
  const providers = record(root.providers) ?? root;
  const add = (providerId: string, modelId: string, raw: unknown) => {
    const value = record(raw);
    if (!value || !modelId) return;
    const entry = { providerId: identity(providerId), modelId: identity(modelId), value };
    for (const key of new Set([entry.modelId, `${entry.providerId}/${entry.modelId}`])) {
      index.set(key, [...(index.get(key) ?? []), entry]);
    }
  };
  // /api.json groups models beneath each provider. Also tolerate a flat
  // provider-agnostic catalog without changing the sync path.
  for (const [providerId, rawProvider] of Object.entries(providers)) {
    const provider = record(rawProvider);
    const models = record(provider?.models);
    if (models) {
      for (const [modelId, value] of Object.entries(models)) add(providerId, String(record(value)?.id ?? modelId), value);
    } else if (provider && ('modalities' in provider || 'tool_call' in provider || 'structured_output' in provider)) {
      add(String(provider.provider ?? providerId.split('/')[0] ?? ''), String(provider.id ?? providerId), provider);
    }
  }
  return index;
}

// Only namespaces present in VANTRA's configured backend route IDs belong here.
// An alias changes the provider namespace, never the model/version identifier.
const providerAliases: Record<string, string> = { zai: 'z-ai', alibaba: 'qwen' };

export function lookupModelsDevModel(catalog: Catalog, route: Pick<RouteIdentity, 'providerId' | 'providerModelId'>): ModelsDevLookup {
  const backendId = identity(route.providerModelId);
  if (backendId.startsWith('~') || (identity(route.providerId) === 'orca_router' && backendId.startsWith('orcarouter/')))
    return { model: null, canonicalLookupId: backendId, aliasUsed: false };
  const routeProvider = identity(route.providerId);
  const separator = backendId.indexOf('/');
  const underlyingProvider = separator > 0 ? backendId.slice(0, separator) : null;
  const modelId = separator > 0 ? backendId.slice(separator + 1) : backendId;
  const exactCandidates = catalog.get(backendId) ?? [];
  const exact = exactCandidates.find((item) => item.providerId === routeProvider && item.modelId === backendId)
    ?? (underlyingProvider ? exactCandidates.find((item) => item.providerId === underlyingProvider && item.modelId === modelId) : null)
    ?? (!underlyingProvider ? exactCandidates.find((item) => item.providerId === routeProvider && item.modelId === backendId) : null);
  if (exact) return { model: exact, canonicalLookupId: backendId, aliasUsed: false };
  const aliasedProvider = underlyingProvider ? providerAliases[underlyingProvider] : undefined;
  if (aliasedProvider) {
    const aliasedId = `${aliasedProvider}/${modelId}`;
    const aliased = (catalog.get(aliasedId) ?? []).find((item) => item.providerId === aliasedProvider && item.modelId === modelId);
    if (aliased) return { model: aliased, canonicalLookupId: aliasedId, aliasUsed: true };
  }
  return { model: null, canonicalLookupId: aliasedProvider ? `${aliasedProvider}/${modelId}` : backendId, aliasUsed: false };
}

export function findModelsDevModel(catalog: Catalog, route: Pick<RouteIdentity, 'providerId' | 'providerModelId'>): ModelEntry | null {
  return lookupModelsDevModel(catalog, route).model;
}

export function mapModelsDevCapabilities(model: ModelEntry | null): Partial<Record<ChatNativeCapability, boolean>> {
  if (!model) return {};
  const value = model.value;
  const modalities = record(value.modalities);
  const input = Array.isArray(modalities?.input) ? modalities.input : [];
  const result: Partial<Record<ChatNativeCapability, boolean>> = {};
  if (input.includes('image')) result.visionInput = true;
  if (input.includes('pdf')) result.fileInput = true;
  if (typeof value.tool_call === 'boolean') result.tools = value.tool_call;
  if (typeof value.structured_output === 'boolean') result.structuredOutput = value.structured_output;
  // attachment=true is not proof that arbitrary files/PDFs work. Models.dev
  // does not provide route streaming or parallel-tool evidence.
  return result;
}

export function vantraFallbackCapabilities(route: Pick<RouteIdentity, 'providerId' | 'providerModelId'>): Partial<Record<ChatNativeCapability, boolean>> {
  return identity(route.providerId) === 'agnes' && identity(route.providerModelId) === 'agnes-3.0-flash'
    ? { streaming: true, visionInput: true, tools: true } : {};
}

export function createModelsDevCatalogAdapter(fetcher: typeof fetch = fetch, now: () => number = Date.now) {
  let cached: Catalog | null = null;
  let fetchedAt = 0;
  let inFlight: Promise<CatalogResult> | null = null;
  const load = async (): Promise<CatalogResult> => {
    if (cached && now() - fetchedAt < CACHE_MS) return { status: 'fresh', catalog: cached, checkedAt: new Date(fetchedAt).toISOString() };
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const response = await fetcher(CATALOG_URL, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(8_000) } as RequestInit);
        if (!response.ok) throw new Error('CATALOG_HTTP_ERROR');
        const catalog = indexModelsDevCatalog(await response.json());
        if (!catalog.size) throw new Error('CATALOG_EMPTY');
        cached = catalog;
        fetchedAt = now();
        return { status: 'fresh', catalog, checkedAt: new Date(fetchedAt).toISOString() };
      } catch {
        return { status: cached ? 'stale' : 'unavailable', catalog: cached, checkedAt: cached ? new Date(fetchedAt).toISOString() : null };
      } finally { inFlight = null; }
    })();
    return inFlight;
  };
  return { load };
}

export const modelsDevCatalog = createModelsDevCatalogAdapter();
