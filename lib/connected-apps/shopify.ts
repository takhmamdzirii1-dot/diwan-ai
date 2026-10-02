import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { connectedBody, connectedHttp } from './http.server';
import { parseCredentials } from './oauth';
import type { ConnectedAppAdapter, ConnectedCredentials } from './core';

export function shopifyDomain(input: string): string {
  const shop = input.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,62}\.myshopify\.com$/u.test(shop)) throw new Error('permission_missing');
  return shop;
}
export function verifyShopifyCallback(search: string, shop: string, secret: string, now = Date.now()): boolean {
  const params = new URLSearchParams(search);
  if (new Set([...params.keys()]).size !== [...params.keys()].length || params.get('shop') !== shop) return false;
  const timestamp = Number(params.get('timestamp')) * 1000;
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 600_000) return false;
  const hmac = params.get('hmac') ?? '';
  if (!/^[a-f0-9]{64}$/u.test(hmac)) return false;
  params.delete('hmac');
  const message = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('&');
  const expected = createHmac('sha256', secret).update(message).digest();
  return timingSafeEqual(expected, Buffer.from(hmac, 'hex'));
}
const scopes = ['read_products', 'read_orders', 'read_inventory'];
const inputSchema = z.object({ operation: z.enum(['products', 'orders', 'inventory']),
  after: z.string().min(1).max(1024).optional() }).strict();

export function shopifyAdapter(fetcher: typeof fetch = fetch): ConnectedAppAdapter {
  const clientId = () => process.env.SHOPIFY_CLIENT_ID!;
  const clientSecret = () => process.env.SHOPIFY_CLIENT_SECRET!;
  const graphql = async (shop: string, accessToken: string, query: string, variables: Record<string, unknown> = {}, signal?: AbortSignal) => {
    const response = await connectedHttp(`https://${shopifyDomain(shop)}`, fetcher)('/admin/api/2026-10/graphql.json', {
      method: 'POST', headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) }, signal);
    const value = z.object({ data: z.record(z.unknown()).optional(), errors: z.array(z.unknown()).optional() })
      .parse(JSON.parse(await connectedBody(response)));
    if (value.errors?.length || !value.data) throw new Error('permission_missing'); return value.data;
  };
  const token = async (shop: string, parameters: Record<string, string>, previous?: ConnectedCredentials) => {
    const response = await connectedHttp(`https://${shopifyDomain(shop)}`, fetcher)('/admin/oauth/access_token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId(), client_secret: clientSecret(), ...parameters }) });
    const value = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1), expires_in: z.number().int().positive().max(86400), scope: z.string() })
      .parse(JSON.parse(await connectedBody(response, 40_000)));
    const granted = value.scope.split(',').map(scope => scope.trim());
    if (scopes.some(scope => !granted.includes(scope))) throw new Error('permission_missing');
    const account = previous?.account ?? await (async () => {
      const data = await graphql(shop, value.access_token, '{ shop { id name myshopifyDomain } }');
      const identity = z.object({ id: z.string().min(1).max(256), name: z.string().min(1).max(160), myshopifyDomain: z.literal(shop) }).parse(data.shop);
      return { id: identity.id, name: `${identity.name} (${shop})`.slice(0, 160) };
    })();
    return parseCredentials({ accessToken: value.access_token, refreshToken: value.refresh_token, account, scopes: granted,
      expiresAt: new Date(Date.now() + value.expires_in * 1000).toISOString(), store: { domain: shop } });
  };
  return { id: 'shopify', name: 'Shopify', authorization: 'oauth', requiresStore: true,
    oauth: {
      authorize: ({ redirectUri, state, context }) => {
        const shop = shopifyDomain(context?.shop ?? '');
        const url = new URL(`https://${shop}/admin/oauth/authorize`);
        url.search = new URLSearchParams({ client_id: clientId(), scope: scopes.join(','), redirect_uri: redirectUri, state, expiring: '1' }).toString();
        return url.toString();
      },
      exchange: ({ code, context, callbackParams }) => {
        const shop = shopifyDomain(context?.shop ?? '');
        if (!verifyShopifyCallback(callbackParams ?? '', shop, clientSecret())) throw new Error('permission_missing');
        return token(shop, { code, expiring: '1' });
      },
      refresh: previous => { if (!previous.store || !previous.refreshToken) throw new Error('authorization_expired');
        return token(previous.store.domain, { grant_type: 'refresh_token', refresh_token: previous.refreshToken }, previous); },
      // Do not silently uninstall a merchant app and delete its configuration on Disconnect.
      // Local access is removed; UI instructs the merchant to revoke in Shopify Admin.
    },
    actions: [{ id: 'read_shopify', description: 'Read the explicitly requested connected Shopify store: products, recent orders or inventory. Ten records per page; no customer names, addresses, email, payment data or invented sales totals.',
      classification: 'read', risk: 'low', requiredScopes: scopes, requiresConnection: true, requiresConfirmation: false,
      parameters: inputSchema, matches: request => /\bshopify\b/iu.test(request) }],
    execute: async ({ actionId, credential, arguments: args, signal }) => {
      if (actionId !== 'read_shopify') throw new Error('permission_missing');
      const input = inputSchema.parse(args); const grant = parseCredentials(JSON.parse(credential ?? '{}'));
      const shop = shopifyDomain(grant.store?.domain ?? '');
      const selection = input.operation === 'orders' ? 'orders(first:10,after:$after,sortKey:CREATED_AT,reverse:true) { nodes { name createdAt displayFinancialStatus currentTotalPriceSet { shopMoney { amount currencyCode } } } pageInfo { hasNextPage endCursor } }'
        : input.operation === 'inventory' ? 'productVariants(first:10,after:$after) { nodes { id displayName sku inventoryQuantity } pageInfo { hasNextPage endCursor } }'
          : 'products(first:10,after:$after) { nodes { id title status totalInventory } pageInfo { hasNextPage endCursor } }';
      const data = await graphql(shop, grant.accessToken, `query ConnectedRead($after:String) { ${selection} }`, { after: input.after ?? null }, signal);
      return { sourceId: shop, name: 'Shopify store data', mimeType: 'text/plain', text: JSON.stringify({ ...data, partial: true }) };
    },
  };
}
