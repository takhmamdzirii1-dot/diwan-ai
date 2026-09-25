const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const CACHE_MS = 24 * 60 * 60 * 1000;

export function createOpenRouterCapabilityCatalog(fetcher: typeof fetch = fetch, now: () => number = Date.now) {
  let cached: Map<string, Record<string, unknown>> | null = null;
  let fetchedAt = 0;
  let inFlight: Promise<Map<string, Record<string, unknown>> | null> | null = null;

  const load = async () => {
    if (cached && now() - fetchedAt < CACHE_MS) return cached;
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const response = await fetcher(OPENROUTER_MODELS_URL, {
          method: 'GET', next: { revalidate: 86_400 }, signal: AbortSignal.timeout(8_000),
        } as RequestInit);
        if (!response.ok) return cached;
        const payload = await response.json();
        if (!Array.isArray(payload?.data)) return cached;
        const index = new Map<string, Record<string, unknown>>();
        for (const raw of payload.data) {
          if (raw && typeof raw === 'object' && !Array.isArray(raw) && typeof raw.id === 'string')
            index.set(raw.id, raw as Record<string, unknown>);
        }
        if (!index.size) return cached;
        cached = index;
        fetchedAt = now();
        return cached;
      } catch { return cached; }
      finally { inFlight = null; }
    })();
    return inFlight;
  };

  return { find: async (modelId: string) => (await load())?.get(modelId) ?? null };
}

export const openRouterCapabilityCatalog = createOpenRouterCapabilityCatalog();
