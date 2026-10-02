import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { encryptToken } from '@/lib/ai/provider-connections';
import { parseCredentials } from './oauth';
import { wooCredentials, wooRequest, wooStoreDomain } from './woocommerce';

const nonceHash = (nonce: string) => createHash('sha256').update(nonce).digest('hex');
const callback = z.object({ key_id: z.number().int().positive(), user_id: z.string().length(43),
  consumer_key: wooCredentials.shape.key, consumer_secret: wooCredentials.shape.secret, key_permissions: z.literal('read') }).strict();
function database() { const db = getSupabaseAdminClient(); if (!db) throw new Error('provider_unavailable'); return db; }

export async function completedWooAuthorization(userId: string, nonce: string, domain: string): Promise<boolean> {
  const { data, error } = await database().from('connected_app_authorizations').select('status')
    .eq('user_id', userId).eq('nonce_hash', nonceHash(nonce)).eq('app_id', 'woocommerce')
    .eq('store_domain', domain).eq('status', 'completed').maybeSingle();
  return !error && data?.status === 'completed';
}

export async function startWooAuthorization(userId: string, nonce: string, domain: string) {
  if (process.env.CONNECTED_APPS_WRITES_ENABLED !== 'true') throw new Error('permission_missing');
  // Verify public DNS before sending the browser anywhere; credentials are not acquired yet.
  await wooRequest(wooStoreDomain(domain), '/wp-json');
  const { error } = await database().from('connected_app_authorizations').insert({ user_id: userId, app_id: 'woocommerce',
    nonce_hash: nonceHash(nonce), store_domain: domain });
  if (error) throw new Error('provider_unavailable');
}

export async function receiveWooAuthorization(body: unknown, signal?: AbortSignal, load = wooRequest) {
  const input = callback.parse(body);
  const { data, error } = await database().from('connected_app_authorizations').select('store_domain,expires_at,status')
    .eq('nonce_hash', nonceHash(input.user_id)).eq('app_id', 'woocommerce').eq('status', 'pending').maybeSingle();
  if (error || !data || Date.parse(data.expires_at) <= Date.now()) throw new Error('permission_missing');
  const domain = wooStoreDomain(data.store_domain);
  // The callback is unsigned. Possessing the nonce alone is NOT sufficient: verify the
  // delivered key against the original pinned store, never a callback-supplied endpoint.
  await load(domain, '/wp-json/wc/v3/products?per_page=1&_fields=id', { key: input.consumer_key, secret: input.consumer_secret }, signal);
  const identity = z.object({ name: z.string().min(1).max(500), url: z.string().url() }).parse(await load(domain, '/wp-json', undefined, signal));
  if (new URL(identity.url).hostname !== domain) throw new Error('permission_missing');
  const grant = parseCredentials({ accessToken: input.consumer_key, refreshToken: input.consumer_secret,
    expiresAt: '9999-01-01T00:00:00.000Z', grantId: randomUUID(), scopes: ['woocommerce.read'],
    account: { id: domain, name: `${identity.name.slice(0, 80)} (${domain})`.slice(0, 160) }, store: { domain } });
  signal?.throwIfAborted();
  const completed = await database().rpc('complete_woocommerce_authorization', { p_nonce_hash: nonceHash(input.user_id),
    p_encrypted_credentials: encryptToken(JSON.stringify(grant)) });
  if (completed.error || completed.data !== true) throw new Error('permission_missing');
}
