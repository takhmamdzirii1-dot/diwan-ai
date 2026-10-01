import 'server-only';
import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { isBlockedIp, validateProviderEndpoint } from '@/lib/ai/providers/endpoint-security';
import { newsArticleCandidate } from './news-evidence';
import { decodeHTML } from 'entities';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import type { Readable } from 'node:stream';

export type WebReadError = 'URL_UNSAFE' | 'URL_UNAVAILABLE' | 'URL_CONTENT_UNSUPPORTED' | 'URL_TOO_LARGE';
type ResolvedTarget = { url: URL; address: string; family: 4 | 6 };
type PageResponse = { status: number; location?: string; contentType: string; body: string; truncated?: boolean };
type Resolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;
const defaultResolver: Resolver = (hostname) => lookup(hostname, { all: true, verbatim: true });

/** Bound both compressed transport and expanded bytes; never feed binary gzip
 * into HTML extraction or allow an unbounded decompression allocation.
 */
export function readBoundedPageBody(source: Readable, encoding = 'identity', limit = 2_000_000): Promise<{ body: string; truncated: boolean }> {
  const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'deflate' ? createInflate()
    : encoding === 'br' ? createBrotliDecompress() : null;
  if (!decoder && encoding !== 'identity' && encoding !== '') {
    source.resume(); return Promise.reject(new Error('URL_CONTENT_UNSUPPORTED'));
  }
  const output = decoder ?? source;
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let size = 0; let wireSize = 0; let settled = false;
    const complete = (truncated: boolean) => {
      if (settled) return; settled = true;
      resolve({ body: Buffer.concat(chunks).toString('utf8'), truncated });
      if (truncated) { source.destroy(); decoder?.destroy(); }
    };
    const fail = () => {
      if (!settled) { settled = true; reject(new Error('URL_UNAVAILABLE')); }
      source.destroy(); decoder?.destroy();
    };
    if (decoder) source.on('data', (chunk: Buffer) => {
      wireSize += chunk.length;
      if (wireSize > limit) complete(true);
    });
    output.on('data', (chunk: Buffer) => {
      if (settled) return;
      const remaining = limit - size;
      chunks.push(chunk.subarray(0, remaining)); size += Math.min(chunk.length, remaining);
      if (size >= limit) complete(true);
    });
    source.on('error', fail); if (decoder) decoder.on('error', fail);
    output.on('end', () => complete(false));
    if (decoder) source.pipe(decoder);
  });
}

/** Node requests an address array when `all` is true; both shapes stay pinned to the validated IP. */
export function pinnedAddressLookup(address: string, family: 4 | 6): LookupFunction {
  return (_hostname, options, callback) => options.all
    ? callback(null, [{ address, family }]) : callback(null, address, family);
}

export async function resolvePublicWebUrl(raw: string, resolver: Resolver = defaultResolver): Promise<ResolvedTarget> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('URL_UNSAFE'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || raw.length > 2048
    || isIP(url.hostname.replace(/^\[|\]$/g, '')) !== 0
    || [...url.searchParams.keys()].some((key) => /token|secret|auth|signature|api[_-]?key|password/i.test(key))) {
    throw new Error('URL_UNSAFE');
  }
  try { validateProviderEndpoint(url.origin); } catch { throw new Error('URL_UNSAFE'); }
  url.hash = '';
  let addresses: Array<{ address: string; family: number }>;
  try { addresses = await resolver(url.hostname); }
  catch { throw new Error('URL_UNAVAILABLE'); }
  if (!Array.isArray(addresses) || !addresses.length || addresses.some((item) => isBlockedIp(item.address)))
    throw new Error('URL_UNSAFE');
  return { url, address: addresses[0].address, family: addresses[0].family as 4 | 6 };
}

function requestPinnedPage(target: ResolvedTarget, signal?: AbortSignal): Promise<PageResponse> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(target.url, {
      method: 'GET', timeout: 8_000, agent: false,
      headers: { Accept: 'text/html, text/plain, application/xhtml+xml', 'Accept-Encoding': 'identity',
        'User-Agent': 'VANTRA-URL-Reader/1.0' },
      lookup: pinnedAddressLookup(target.address, target.family),
      signal,
    }, (response) => {
      const status = response.statusCode ?? 0;
      const location = typeof response.headers.location === 'string' ? response.headers.location : undefined;
      const contentType = String(response.headers['content-type'] ?? '').toLowerCase();
      if (status >= 300 && status < 400) {
        response.resume(); resolve({ status, location, contentType, body: '' }); return;
      }
      if (status !== 200) { response.resume(); reject(new Error('URL_UNAVAILABLE')); return; }
      if (!/^(text\/html|text\/plain|application\/xhtml\+xml)(?:;|$)/.test(contentType)) {
        response.resume(); reject(new Error('URL_CONTENT_UNSUPPORTED')); return;
      }
      void readBoundedPageBody(response, String(response.headers['content-encoding'] ?? 'identity').toLowerCase())
        .then((body) => resolve({ status, contentType, ...body }), reject);
    });
    req.on('timeout', () => req.destroy(new Error('URL_UNAVAILABLE')));
    req.on('error', reject);
    req.end();
  });
}

function readableText(body: string, contentType: string) {
  if (contentType.startsWith('text/plain')) return body;
  // A bounded HTML prefix may end inside an active element. Strip that unfinished
  // element too, and never expose framework scripts as page evidence.
  const withoutActive = body.replace(/<(script|style|noscript|svg|iframe|form|head|template|nav|aside|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(?:script|style|noscript|svg|iframe|form|head|template|nav|aside|footer)\b[^>]*>[\s\S]*$/gi, ' ');
  const main = withoutActive.match(/<main\b[^>]*>([\s\S]*?)(?:<\/main\s*>|$)/i)?.[1] ?? withoutActive;
  return decodeHTML(main.replace(/<\/(?:p|div|article|section|h[1-6]|li|tr)>/gi, '\n\n')
    .replace(/<br\s*\/?\s*>/gi, '\n').replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, ' ')
    )
    .replace(/[\t ]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}

/** Every redirect is resolved and validated again; the socket uses the validated DNS result. */
export async function readPublicWebPage(raw: string, options?: {
  resolver?: Resolver; load?: (target: ResolvedTarget) => Promise<PageResponse>; signal?: AbortSignal;
}): Promise<{ sourceId: string; name: string; mimeType: 'text/markdown'; text: string;
  contentComplete?: boolean; fetchedAt?: string;
  navigationLinks?: Array<{ url: string; title: string }>;
  articleLinks?: Array<{ url: string; title: string }>;
  pagePublishedAt?: string | null; pageUpdatedAt?: string | null }> {
  let current = raw;
  for (let redirects = 0; redirects <= 2; redirects++) {
    options?.signal?.throwIfAborted();
    const target = await resolvePublicWebUrl(current, options?.resolver);
    options?.signal?.throwIfAborted();
    const page = await (options?.load ? options.load(target) : requestPinnedPage(target, options?.signal));
    if (page.status >= 300 && page.status < 400) {
      if (!page.location || redirects === 2) throw new Error('URL_UNAVAILABLE');
      current = new URL(page.location, target.url).toString();
      continue;
    }
    if (page.status !== 200) throw new Error('URL_UNAVAILABLE');
    if (!/^(text\/html|text\/plain|application\/xhtml\+xml)(?:;|$)/.test(page.contentType))
      throw new Error('URL_CONTENT_UNSUPPORTED');
    const readable = readableText(page.body, page.contentType);
    const text = readable.slice(0, 30_000);
    if (!text) throw new Error('URL_CONTENT_UNSUPPORTED');
    const publicUrl = `${target.url.origin}${target.url.pathname}`;
    return { sourceId: target.url.toString(), name: target.url.hostname, mimeType: 'text/markdown',
      text: `Source: ${publicUrl}\n\n${text}`, contentComplete: !page.truncated && readable.length <= 30_000
        && !/~[A-Za-z_][A-Za-z0-9_]{2,60}~|\{\{\s*[A-Za-z_][A-Za-z0-9_.]{2,60}\s*\}\}/u.test(readable),
      fetchedAt: new Date().toISOString(),
      navigationLinks: pageLinks(page.body, target.url),
      articleLinks: pageLinks(page.body, target.url, true),
      pagePublishedAt: pageDate(page.body, 'published'), pageUpdatedAt: pageDate(page.body, 'modified') };
  }
  throw new Error('URL_UNAVAILABLE');
}

/** Bounded same-origin navigation only; fetched links are candidates, not evidence. */
function pageLinks(html: string, base: URL, articles = false) {
  const passive = html.replace(/<(script|style|noscript|iframe|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  const links = new Map<string, { url: string; title: string }>();
  for (const match of passive.matchAll(/<a\b(?:[^>"']|"[^"]*"|'[^']*')*>([\s\S]*?)<\/a\s*>/gi)) {
    try {
      const href = match[0].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!href) continue;
      const url = new URL(href.replace(/&amp;/gi, '&'), base);
      if (url.origin !== base.origin || url.username || url.password || url.search || url.hash) continue;
      const title = readableText(match[1], 'text/html').replace(/\s+/g, ' ').slice(0, 180);
      if (!title || url.pathname === base.pathname || articles
        && !newsArticleCandidate({ url: url.toString(), title, description: '' })) continue;
      links.set(url.toString(), { url: url.toString(), title });
      if (links.size >= 24) break;
    } catch { /* Never derive a URL from text or accept an unsafe link. */ }
  }
  return [...links.values()];
}

/** Metadata dates describe the PAGE, never automatically the announcement. */
function pageDate(html: string, kind: 'published' | 'modified') {
  const property = kind === 'published' ? 'article:published_time' : 'article:modified_time';
  const jsonKey = kind === 'published' ? 'datePublished' : 'dateModified';
  const values = [...html.matchAll(/<meta\b[^>]*>/gi)].flatMap(([tag]) => {
    const attributes = new Map([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)]
      .map((match) => [match[1].toLowerCase(), match[2]]));
    return (attributes.get('property') ?? attributes.get('name')) === property
      ? [attributes.get('content') ?? ''] : [];
  });
  values.push(...[...html.matchAll(new RegExp(`"${jsonKey}"\\s*:\\s*"([^"]+)"`, 'g'))].map((match) => match[1]));
  const dates = new Set(values.filter((value) => /^20\d{2}-\d{2}-\d{2}(?:T|$)/.test(value)
    && Number.isFinite(Date.parse(value))).map((value) => new Date(value).toISOString().slice(0, 10)));
  return dates.size === 1 ? [...dates][0] : null;
}
