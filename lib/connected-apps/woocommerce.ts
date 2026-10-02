import 'server-only';
import { request as httpsRequest } from 'node:https';
import { z } from 'zod';
import { resolvePublicWebUrl, pinnedAddressLookup } from '@/lib/web/url-reader.server';
import { parseCredentials } from './oauth';
import type { ConnectedAppAdapter } from './core';

export function wooStoreDomain(input: string): string {
  const domain = input.trim().toLowerCase();
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u.test(domain)
    || domain.length > 253 || /(?:^|\.)(?:localhost|local|internal)$/u.test(domain)) throw new Error('permission_missing');
  return domain;
}

/** Reuse VANTRA's DNS/IP checks and pin the TLS socket; never follow a credentialed redirect. */
export async function wooRequest(domain: string, path: string, credential?: { key: string; secret: string }, signal?: AbortSignal): Promise<unknown> {
  const store = wooStoreDomain(domain);
  if (!(path === '/wp-json' || path.startsWith('/wp-json/wc/v3/'))) throw new Error('permission_missing');
  const target = await resolvePublicWebUrl(`https://${store}${path}`);
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const request = httpsRequest(target.url, { method: 'GET', agent: false, timeout: 10_000, signal,
      lookup: pinnedAddressLookup(target.address, target.family), headers: { Accept: 'application/json', 'Accept-Encoding': 'identity',
        ...(credential ? { Authorization: `Basic ${Buffer.from(`${credential.key}:${credential.secret}`).toString('base64')}` } : {}) } }, response => {
      if (response.statusCode !== 200 || !/^application\/json(?:;|$)/iu.test(String(response.headers['content-type']))) {
        response.resume(); reject(new Error(response.statusCode === 401 ? 'authorization_expired' : response.statusCode === 403 ? 'permission_missing'
          : response.statusCode === 429 ? 'provider_rate_limited' : 'provider_unavailable')); return;
      }
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', (chunk: Buffer) => { size += chunk.length;
        if (size > 120000) { response.destroy(); reject(new Error('resource_not_found')); } else chunks.push(chunk); });
      response.on('error', () => reject(new Error('provider_unavailable')));
      response.on('aborted', () => reject(new Error('provider_unavailable')));
      response.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('provider_unavailable')); } });
    });
    request.on('error', () => reject(new Error('provider_unavailable')));
    request.on('timeout', () => request.destroy(new Error('provider_unavailable'))); request.end();
  });
}

export const wooCredentials = z.object({ key: z.string().regex(/^ck_[a-f0-9]{40}$/u), secret: z.string().regex(/^cs_[a-f0-9]{40}$/u) }).strict();
const inputSchema = z.object({ operation: z.enum(['products', 'orders', 'inventory']), page: z.number().int().min(1).max(100).default(1),
  search: z.string().max(200).optional() }).strict();

export function wooCommerceAdapter(load: typeof wooRequest = wooRequest): ConnectedAppAdapter {
  return { id: 'woocommerce', name: 'WooCommerce', authorization: 'oauth', requiresStore: true,
    oauth: {
      authorize: ({ redirectUri, state, context }) => {
        const origin = new URL(redirectUri).origin;
        if (!origin.startsWith('https:')) throw new Error('permission_missing');
        const url = new URL(`https://${wooStoreDomain(context?.shop ?? '')}/wc-auth/v1/authorize`);
        url.search = new URLSearchParams({ app_name: 'VANTRA', scope: 'read', user_id: state, return_url: redirectUri,
          callback_url: `${origin}/api/connected-apps/woocommerce/callback` }).toString(); return url.toString();
      },
      // Credentials arrive at the correlated server-to-server callback, not an OAuth code.
      exchange: async () => { throw new Error('permission_missing'); },
    },
    actions: [{ id: 'read_woocommerce', description: 'Read products, inventory or recent order totals from the explicitly requested connected WooCommerce store. Ten records per page. No customer PII, payment credentials or fabricated all-store sales totals.',
      classification: 'read', risk: 'low', requiredScopes: ['woocommerce.read'], requiresConnection: true, requiresConfirmation: false,
      parameters: inputSchema, matches: request => /\bwoocommerce\b/iu.test(request) }],
    execute: async ({ actionId, credential, arguments: args, signal }) => {
      if (actionId !== 'read_woocommerce') throw new Error('permission_missing');
      const input = inputSchema.parse(args); const grant = parseCredentials(JSON.parse(credential ?? '{}'));
      const credentials = wooCredentials.parse({ key: grant.accessToken, secret: grant.refreshToken });
      const query = new URLSearchParams({ per_page: '10', page: String(input.page), ...(input.search ? { search: input.search } : {}) });
      const operation = input.operation === 'orders' ? 'orders' : 'products';
      const value = await load(grant.store?.domain ?? '', `/wp-json/wc/v3/${operation}?${query}`, { key: credentials.key, secret: credentials.secret }, signal);
      const items = input.operation === 'orders'
        ? z.array(z.object({ id: z.number().int(), number: z.string(), status: z.string(), date_created: z.string().nullable(),
          currency: z.string(), total: z.string() })).max(10).parse(value)
        : z.array(z.object({ id: z.number().int(), name: z.string().max(500), status: z.string(), price: z.string(),
          stock_status: z.string(), stock_quantity: z.number().nullable() })).max(10).parse(value);
      return { sourceId: grant.store!.domain, name: 'WooCommerce store data', mimeType: 'text/plain',
        text: JSON.stringify({ items, page: input.page, mayHaveMore: items.length === 10, partial: true }) };
    },
  };
}
