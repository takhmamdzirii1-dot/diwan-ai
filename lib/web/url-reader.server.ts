import 'server-only';
import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { isBlockedIp, validateProviderEndpoint } from '@/lib/ai/providers/endpoint-security';

export type WebReadError = 'URL_UNSAFE' | 'URL_UNAVAILABLE' | 'URL_CONTENT_UNSUPPORTED' | 'URL_TOO_LARGE';
type ResolvedTarget = { url: URL; address: string; family: 4 | 6 };
type PageResponse = { status: number; location?: string; contentType: string; body: string };
type Resolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;
const defaultResolver: Resolver = (hostname) => lookup(hostname, { all: true, verbatim: true });

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

function requestPinnedPage(target: ResolvedTarget): Promise<PageResponse> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(target.url, {
      method: 'GET', timeout: 8_000, agent: false,
      headers: { Accept: 'text/html, text/plain, application/xhtml+xml', 'Accept-Encoding': 'identity',
        'User-Agent': 'VANTRA-URL-Reader/1.0' },
      lookup: pinnedAddressLookup(target.address, target.family),
    }, (response) => {
      const status = response.statusCode ?? 0;
      const location = typeof response.headers.location === 'string' ? response.headers.location : undefined;
      const contentType = String(response.headers['content-type'] ?? '').toLowerCase();
      if (status >= 300 && status < 400) {
        response.resume(); resolve({ status, location, contentType, body: '' }); return;
      }
      if (status !== 200) { response.resume(); reject(new Error('URL_UNAVAILABLE')); return; }
      if (!/^(text\/html|text\/plain|application\/xhtml\+xml)(?:;|$)/.test(contentType)
        || response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
        response.resume(); reject(new Error('URL_CONTENT_UNSUPPORTED')); return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 128_000) { response.destroy(new Error('URL_TOO_LARGE')); return; }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ status, contentType, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('URL_UNAVAILABLE')));
    req.on('error', reject);
    req.end();
  });
}

function readableText(body: string, contentType: string) {
  if (contentType.startsWith('text/plain')) return body;
  const withoutActive = body.replace(/<(script|style|noscript|svg|iframe|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  return withoutActive.replace(/<\/(?:p|div|article|section|h[1-6]|li|tr)>/gi, '\n\n')
    .replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Math.min(Number(decimal), 0x10ffff)))
    .replace(/&#x([\da-f]+);/gi, (_, hex: string) => String.fromCodePoint(Math.min(parseInt(hex, 16), 0x10ffff)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, name: string) => ({ amp: '&', lt: '<', gt: '>',
      quot: '"', apos: "'", nbsp: ' ' })[name.toLowerCase() as 'amp'])
    .replace(/[\t ]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}

/** Every redirect is resolved and validated again; the socket uses the validated DNS result. */
export async function readPublicWebPage(raw: string, options?: {
  resolver?: Resolver; load?: (target: ResolvedTarget) => Promise<PageResponse>;
}): Promise<{ sourceId: string; name: string; mimeType: 'text/markdown'; text: string }> {
  let current = raw;
  for (let redirects = 0; redirects <= 2; redirects++) {
    const target = await resolvePublicWebUrl(current, options?.resolver);
    const page = await (options?.load ?? requestPinnedPage)(target);
    if (page.status >= 300 && page.status < 400) {
      if (!page.location || redirects === 2) throw new Error('URL_UNAVAILABLE');
      current = new URL(page.location, target.url).toString();
      continue;
    }
    if (page.status !== 200) throw new Error('URL_UNAVAILABLE');
    if (!/^(text\/html|text\/plain|application\/xhtml\+xml)(?:;|$)/.test(page.contentType))
      throw new Error('URL_CONTENT_UNSUPPORTED');
    const text = readableText(page.body, page.contentType).slice(0, 30_000);
    if (!text) throw new Error('URL_CONTENT_UNSUPPORTED');
    const publicUrl = `${target.url.origin}${target.url.pathname}`;
    return { sourceId: publicUrl.slice(0, 256), name: target.url.hostname, mimeType: 'text/markdown',
      text: `Source: ${publicUrl}\n\n${text}` };
  }
  throw new Error('URL_UNAVAILABLE');
}
