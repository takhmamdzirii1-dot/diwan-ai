import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { decryptToken, encryptToken } from '@/lib/ai/provider-connections';
import type { ConnectedCredentials } from './core';

export const credentialsSchema = z.object({ accessToken: z.string().min(1).max(16000),
  refreshToken: z.string().min(1).max(16000).optional(), expiresAt: z.string().datetime(), grantId: z.string().uuid().optional(),
  scopes: z.array(z.string().max(200)).max(20), account: z.object({ id: z.string().min(1).max(256),
    name: z.string().min(1).max(160), email: z.string().email().max(254).optional() }).strict(),
  store: z.object({ domain: z.string().min(1).max(253) }).strict().optional() }).strict();
const stateSchema = z.object({ userId: z.string().uuid(), appId: z.string().min(1).max(80),
  nonce: z.string().length(43), verifier: z.string().length(43), expires: z.number().int(),
  context: z.object({ shop: z.string().max(253) }).strict().optional() }).strict();
export const OAUTH_COOKIE = 'vantra_connected_oauth';
export const OAUTH_PATH = '/api/connected-apps/oauth';
export function parseCredentials(input: unknown): ConnectedCredentials {
  return credentialsSchema.parse(input) as ConnectedCredentials;
}

export function startOAuthState(userId: string, appId: string, now = Date.now(), context?: { shop: string }) {
  const nonce = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const state = stateSchema.parse({ userId, appId, nonce, verifier, expires: now + 600_000, context });
  return { nonce, challenge: createHash('sha256').update(verifier).digest('base64url'), cookie: encryptToken(JSON.stringify(state)) };
}

export function validateOAuthState(cookie: string | undefined, nonce: string | null, userId: string, now = Date.now()) {
  try {
    const pieces = cookie?.split(':') ?? [];
    if (!cookie || cookie.length > 8000 || pieces.length !== 3
      || pieces.some(piece => Buffer.from(piece, 'base64').toString('base64') !== piece)) return null;
    const state = stateSchema.parse(JSON.parse(decryptToken(cookie ?? '') ?? '{}'));
    if (!nonce || nonce.length !== state.nonce.length || !timingSafeEqual(Buffer.from(nonce), Buffer.from(state.nonce))
      || state.userId !== userId || state.expires <= now || state.expires > now + 600_000) return null;
    return state;
  } catch { return null; }
}

/** Callback origins are deployment configuration, never user-controlled redirect parameters. */
export function connectedAppOrigin(requestUrl: string) {
  if (process.env.CONNECTED_APPS_ORIGIN) {
    const url = new URL(process.env.CONNECTED_APPS_ORIGIN);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash
      || !(local && ['http:', 'https:'].includes(url.protocol) || url.hostname === 'joinvantra.com' && url.protocol === 'https:' && !url.port)) throw new Error('FORBIDDEN');
    return url.origin;
  }
  if (process.env.NODE_ENV === 'production') return 'https://joinvantra.com';
  const url = new URL(requestUrl);
  if (!['localhost', '127.0.0.1', 'joinvantra.com'].includes(url.hostname)) throw new Error('FORBIDDEN');
  return url.origin;
}
