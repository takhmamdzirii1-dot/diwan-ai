import 'server-only';
import { searchBudget, SupabaseSearchHealthStore, type SearchFailure, type SearchHealthStore } from './search-health.server';

export type WebSearchHit = { title: string; url: string; description: string;
  publishedAt?: string | null; source?: string; provider?: string; verifiedPage?: boolean;
  evidenceLevel?: 'primary_page' | 'primary_search' | 'primary_bundle' | 'corroborated';
  evidenceBundle?: 'primary_exact' | 'primary_supported_bundle' | 'corroborated_exact';
  evidenceId?: string };
export interface WebSearchProvider {
  readonly id: string;
  search(query: string, limit: number): Promise<WebSearchHit[]>;
}
const unsafeQuery = /(?:sb_secret_[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{16,}|\bBearer\s+[A-Za-z0-9._-]{16,}|\b(?:API_KEY|CLIENT_SECRET|REFRESH_TOKEN)\s*[:=]\s*\S+)/i;

export class SearchProviderError extends Error {
  constructor(readonly category: SearchFailure) { super(`WEB_SEARCH_${category.toUpperCase()}`); }
}

function classifyStatus(status: number): SearchFailure {
  if (status === 429) return 'rate_limited';
  if ([402, 432, 433].includes(status)) return 'quota_exhausted';
  return 'unavailable';
}

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new SearchProviderError(classifyStatus(response.status));
  const size = Number(response.headers.get('content-length'));
  if (size > 150_000) throw new SearchProviderError('invalid_response');
  const reader = response.body?.getReader();
  if (!reader) throw new SearchProviderError('invalid_response');
  const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 150_000) { await reader.cancel(); throw new SearchProviderError('invalid_response'); }
    chunks.push(value);
  }
  try {
    const merged = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(merged));
  } catch { throw new SearchProviderError('invalid_response'); }
}

function normalizeHits(results: unknown, descriptionKey: 'description' | 'content'): WebSearchHit[] {
  if (!Array.isArray(results)) throw new SearchProviderError('invalid_response');
  return results.slice(0, 5).flatMap((item: unknown) => {
    if (!item || typeof item !== 'object' || !('url' in item) || typeof item.url !== 'string') return [];
    let address: URL;
    try { address = new URL(item.url); } catch { return []; }
    if (address.protocol !== 'https:' || address.username || address.password || item.url.length > 2048) return [];
    address.search = ''; address.hash = '';
    const title = 'title' in item && typeof item.title === 'string' ? item.title.replace(/<[^>]*>/g, '').slice(0, 180) : address.hostname;
    const description = descriptionKey in item && typeof item[descriptionKey] === 'string'
      ? item[descriptionKey].replace(/<[^>]*>/g, '').slice(0, 500) : '';
    const dated = ['published_date', 'published_at', 'date', 'page_age'].flatMap((field) =>
      field in item && typeof item[field] === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(item[field])
        ? [item[field]] : []);
    const publishedAt = dated.length && Number.isFinite(Date.parse(dated[0]))
      ? new Date(dated[0]).toISOString().slice(0, 10) : null;
    return [{ title, description, url: address.toString(), publishedAt, source: address.hostname }];
  });
}

/** One replaceable provider adapter; the token never enters Chat context or a client response. */
export class BraveWebSearch implements WebSearchProvider {
  readonly id = 'brave';
  constructor(private readonly key: string, private readonly transport: typeof fetch = fetch) {}

  async search(query: string, limit: number): Promise<WebSearchHit[]> {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(Math.min(Math.max(limit, 1), 5)));
    let response: Response;
    try {
      response = await this.transport(url, { method: 'GET', redirect: 'manual',
        headers: { Accept: 'application/json', 'X-Subscription-Token': this.key },
        signal: AbortSignal.timeout(3_000), cache: 'no-store' });
    } catch (cause) { throw new SearchProviderError(cause instanceof DOMException && cause.name === 'TimeoutError' ? 'timeout' : 'unavailable'); }
    const parsed = await boundedJson(response);
    const results = parsed && typeof parsed === 'object' && 'web' in parsed
      && parsed.web && typeof parsed.web === 'object' && 'results' in parsed.web
      ? parsed.web.results : undefined;
    return normalizeHits(results, 'description');
  }
}

export class TavilyWebSearch implements WebSearchProvider {
  readonly id = 'tavily';
  constructor(private readonly key: string, private readonly transport: typeof fetch = fetch) {}
  async search(query: string, limit: number): Promise<WebSearchHit[]> {
    let response: Response;
    try {
      response = await this.transport('https://api.tavily.com/search', { method: 'POST', redirect: 'manual',
        headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, search_depth: 'basic', max_results: Math.min(Math.max(limit, 1), 5),
          include_answer: false, include_raw_content: false, include_images: false }),
        signal: AbortSignal.timeout(3_000), cache: 'no-store' });
    } catch (cause) { throw new SearchProviderError(cause instanceof DOMException && cause.name === 'TimeoutError' ? 'timeout' : 'unavailable'); }
    const parsed = await boundedJson(response);
    const results = parsed && typeof parsed === 'object' && 'results' in parsed ? parsed.results : undefined;
    return normalizeHits(results, 'content');
  }
}

export function configuredWebSearchProvider(): WebSearchProvider | null {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  return key ? new BraveWebSearch(key) : null;
}

export function configuredWebSearchProviders(): WebSearchProvider[] {
  const providers: WebSearchProvider[] = [];
  if (process.env.BRAVE_SEARCH_API_KEY) providers.push(new BraveWebSearch(process.env.BRAVE_SEARCH_API_KEY));
  if (process.env.TAVILY_API_KEY) providers.push(new TavilyWebSearch(process.env.TAVILY_API_KEY));
  return providers;
}

export type SearchExecution = { providerAttempted: string[]; providerUsed: string | null;
  fallbackUsed: boolean; failureCategory: SearchFailure | null; latencyMs: number;
  resultCount: number; truncated: boolean };

// Temporary per-instance protection before the additive telemetry migration is installed.
// A configured hard budget never uses this fallback because it cannot enforce a global limit.
const localCooldown = new Map<string, number>();
const localHealth: SearchHealthStore = {
  async claim(id) { return (localCooldown.get(id) ?? 0) > Date.now() ? 'cooldown' : 'ok'; },
  async record(id, result) {
    if (result.success) localCooldown.delete(id);
    else if (result.cooldownSeconds) localCooldown.set(id, Date.now() + result.cooldownSeconds * 1000);
  },
};

/** Adapter-independent slot for a future verified native-search route. None is assumed today. */
export interface VerifiedNativeSearch {
  verified: true;
  search(query: string, limit: number): Promise<WebSearchHit[]>;
}

export async function orchestrateWebSearch(query: string, options: {
  providers?: WebSearchProvider[]; health?: SearchHealthStore; native?: VerifiedNativeSearch | null;
  budget?: (providerId: string) => number | null; onExecution?: (metadata: SearchExecution) => void;
} = {}): Promise<WebSearchHit[]> {
  if (!query.trim() || query.length > 300 || query.trim().split(/\s+/).length > 50 || unsafeQuery.test(query))
    throw new Error('WEB_SEARCH_INVALID_QUERY');
  const providers = options.native ? [{ id: 'native', search: options.native.search }, ...(options.providers ?? configuredWebSearchProviders())]
    : options.providers ?? configuredWebSearchProviders();
  if (!providers.length) throw new Error('WEB_SEARCH_UNCONFIGURED');
  let health = options.health ?? new SupabaseSearchHealthStore();
  const record = async (id: string, result: Parameters<SearchHealthStore['record']>[1]) => {
    try { await health.record(id, result); }
    catch { if (!options.health) await localHealth.record(id, result); }
  };
  const attempted: string[] = []; let lastFailure: SearchFailure | null = null;
  let fallbackUsed = false;
  const started = Date.now();
  const emit = (metadata: SearchExecution) => {
    options.onExecution?.(metadata);
    // No query, source text, result URL, user ID, or credential in operational logs.
    console.info('WEB_SEARCH_EXECUTION', metadata);
  };
  for (const [index, provider] of providers.slice(0, 2).entries()) {
    if (index > 0) fallbackUsed = true;
    const budget = (options.budget ?? searchBudget)(provider.id);
    let claim: 'ok' | 'cooldown' | 'budget';
    try { claim = await health.claim(provider.id, budget); }
    catch {
      if (options.health || budget !== null) { lastFailure = 'unavailable'; continue; }
      health = localHealth;
      claim = await health.claim(provider.id, null);
    }
    if (claim !== 'ok') { lastFailure = claim === 'budget' ? 'quota_exhausted' : 'rate_limited'; continue; }
    attempted.push(provider.id);
    const providerStarted = Date.now();
    try {
      const hits = await provider.search(query.trim(), 5);
      if (!hits.length) throw new SearchProviderError('invalid_response');
      const truncated = hits.length >= 5;
      await record(provider.id, { success: true, latencyMs: Date.now() - providerStarted,
        resultCount: hits.length, truncated, cooldownSeconds: 0 });
      emit({ providerAttempted: attempted, providerUsed: provider.id,
        fallbackUsed, failureCategory: lastFailure,
        latencyMs: Date.now() - started, resultCount: hits.length, truncated });
      return hits.map((hit) => ({ ...hit, provider: provider.id }));
    } catch (cause) {
      const category = cause instanceof SearchProviderError ? cause.category : 'unavailable';
      lastFailure = category;
      await record(provider.id, { success: false, category, latencyMs: Date.now() - providerStarted,
        resultCount: 0, truncated: false, cooldownSeconds: category === 'quota_exhausted' ? 3600
          : category === 'rate_limited' ? 120 : category === 'unavailable' || category === 'timeout' ? 60 : 30 });
    }
  }
  emit({ providerAttempted: attempted, providerUsed: null, fallbackUsed,
    failureCategory: lastFailure, latencyMs: Date.now() - started, resultCount: 0, truncated: false });
  throw new Error('WEB_SEARCH_UNAVAILABLE');
}

export async function searchWeb(query: string, provider?: WebSearchProvider | null,
  options: { providers?: WebSearchProvider[] } = {}) {
  if (provider === null) throw new Error('WEB_SEARCH_UNCONFIGURED');
  if (!query.trim() || query.length > 300 || query.trim().split(/\s+/).length > 50 || unsafeQuery.test(query))
    throw new Error('WEB_SEARCH_INVALID_QUERY');
  let execution: SearchExecution | undefined;
  const hits = provider ? await provider.search(query.trim(), 5) : await orchestrateWebSearch(query, {
    providers: options.providers, onExecution: (result) => { execution = result; },
  });
  if (!hits.length) throw new Error('WEB_SEARCH_EMPTY');
  const text = hits.map((hit, index) => `${index + 1}. ${hit.title}\n${hit.url}\nPublished: ${hit.publishedAt ?? 'unknown'}\nSource: ${hit.source ?? new URL(hit.url).hostname}\n${hit.description}`).join('\n\n');
  return { sourceId: `search:${query.slice(0, 200)}`, name: 'Web search results',
    mimeType: 'text/markdown' as const, text, hits, ...(execution ? { execution } : {}) };
}
