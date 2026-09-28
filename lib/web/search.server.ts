import 'server-only';

export type WebSearchHit = { title: string; url: string; description: string };
export interface WebSearchProvider {
  readonly id: string;
  search(query: string, limit: number): Promise<WebSearchHit[]>;
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
        signal: AbortSignal.timeout(8_000), cache: 'no-store' });
    } catch { throw new Error('WEB_SEARCH_UNAVAILABLE'); }
    if (response.status === 429) throw new Error('WEB_SEARCH_RATE_LIMITED');
    if (!response.ok) throw new Error('WEB_SEARCH_UNAVAILABLE');
    const size = Number(response.headers.get('content-length'));
    if (size > 150_000) throw new Error('WEB_SEARCH_UNAVAILABLE');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('WEB_SEARCH_UNAVAILABLE');
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 150_000) { await reader.cancel(); throw new Error('WEB_SEARCH_UNAVAILABLE'); }
      chunks.push(value);
    }
    let parsed: unknown;
    try {
      const merged = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
      parsed = JSON.parse(new TextDecoder().decode(merged));
    } catch { throw new Error('WEB_SEARCH_UNAVAILABLE'); }
    const results = parsed && typeof parsed === 'object' && 'web' in parsed
      && parsed.web && typeof parsed.web === 'object' && 'results' in parsed.web
      && Array.isArray(parsed.web.results) ? parsed.web.results : [];
    return results.slice(0, 5).flatMap((item: unknown) => {
      if (!item || typeof item !== 'object' || !('url' in item) || typeof item.url !== 'string') return [];
      let address: URL;
      try { address = new URL(item.url); } catch { return []; }
      if (address.protocol !== 'https:' || address.username || address.password || item.url.length > 2048) return [];
      address.search = ''; address.hash = '';
      const title = 'title' in item && typeof item.title === 'string' ? item.title.slice(0, 180) : address.hostname;
      const description = 'description' in item && typeof item.description === 'string'
        ? item.description.replace(/<[^>]*>/g, '').slice(0, 500) : '';
      return [{ title, description, url: address.toString() }];
    });
  }
}

export function configuredWebSearchProvider(): WebSearchProvider | null {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  return key ? new BraveWebSearch(key) : null;
}

export async function searchWeb(query: string, provider = configuredWebSearchProvider()) {
  if (!provider) throw new Error('WEB_SEARCH_UNCONFIGURED');
  if (!query.trim() || query.length > 300 || query.trim().split(/\s+/).length > 50)
    throw new Error('WEB_SEARCH_INVALID_QUERY');
  const hits = await provider.search(query.trim(), 5);
  if (!hits.length) throw new Error('WEB_SEARCH_EMPTY');
  const text = hits.map((hit, index) => `${index + 1}. ${hit.title}\n${hit.url}\n${hit.description}`).join('\n\n');
  return { sourceId: `search:${query.slice(0, 200)}`, name: 'Web search results',
    mimeType: 'text/markdown' as const, text };
}
