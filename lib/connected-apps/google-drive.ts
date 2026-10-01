import 'server-only';
import { z } from 'zod';
import { parseCredentials } from './oauth';
import type { ConnectedAppAdapter, ConnectedCredentials } from './core';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
export const DRIVE_SCOPES = ['openid', 'email', DRIVE_SCOPE];

/** Only explicit Google file URLs, not arbitrary endpoints or file discovery. */
export function googleFileId(request: string): string | null {
  const urls = request.match(/https:\/\/[^\s<>"']+/gu) ?? [];
  const ids = new Set<string>();
  for (const candidate of urls) {
    try {
      const url = new URL(candidate.replace(/[).،,]+$/u, ''));
      if (!['drive.google.com', 'docs.google.com'].includes(url.hostname) || url.username || url.password || url.port) continue;
      const id = url.pathname.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]+)/u)?.[1]
        ?? (url.hostname === 'drive.google.com' && url.pathname === '/open' ? url.searchParams.get('id') : null);
      if (id && /^[A-Za-z0-9_-]{10,200}$/u.test(id)) ids.add(id);
    } catch { /* malformed input is not authorization */ }
  }
  return ids.size === 1 ? [...ids][0] : null;
}

async function boundedBody(response: Response, max = 120_000) {
  if (Number(response.headers.get('content-length')) > max) { await response.body?.cancel(); throw new Error('resource_not_found'); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('provider_unavailable');
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength; if (size > max) { await reader.cancel(); throw new Error('resource_not_found'); } chunks.push(value); }
    return Buffer.concat(chunks).toString('utf8');
  } finally { reader.releaseLock(); }
}

export function googleDriveAdapter(fetcher: typeof fetch = fetch): ConnectedAppAdapter {
  const clientId = () => process.env.GOOGLE_DRIVE_CLIENT_ID!;
  const clientSecret = () => process.env.GOOGLE_DRIVE_CLIENT_SECRET!;
  const upstream = async (url: string, options: RequestInit = {}, signal?: AbortSignal) => {
    const response = await fetcher(url, { ...options, redirect: 'error', cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000) });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(response.status === 401 ? 'authorization_expired' : response.status === 403 ? 'permission_missing'
        : response.status === 404 ? 'resource_not_found' : response.status === 429 ? 'provider_rate_limited' : 'provider_unavailable');
    }
    return response;
  };
  const token = async (parameters: Record<string, string>, previous?: ConnectedCredentials): Promise<ConnectedCredentials> => {
    const response = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(10_000), body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), ...parameters }) });
    if (!response.ok) { await response.body?.cancel(); throw new Error(response.status === 400 ? 'authorization_expired' : 'provider_unavailable'); }
    const grant = z.object({ access_token: z.string().min(1), refresh_token: z.string().optional(),
      expires_in: z.number().int().min(1).max(86400), scope: z.string().optional(), token_type: z.literal('Bearer') })
      .parse(JSON.parse(await boundedBody(response, 40_000)));
    const scopes = grant.scope ? grant.scope.split(' ').filter(Boolean) : previous?.scopes ?? [];
    if (!scopes.includes(DRIVE_SCOPE)) throw new Error('permission_missing');
    const account = previous?.account ?? await (async () => {
      const response = await upstream('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${grant.access_token}` } });
      const identity = z.object({ sub: z.string().min(1), email: z.string().email(), email_verified: z.literal(true) })
        .parse(JSON.parse(await boundedBody(response, 10_000)));
      return { id: identity.sub, name: identity.email, email: identity.email };
    })();
    return parseCredentials({ accessToken: grant.access_token, refreshToken: grant.refresh_token ?? previous?.refreshToken,
      scopes, account, expiresAt: new Date(Date.now() + grant.expires_in * 1000).toISOString() });
  };
  return { id: 'google_drive', name: 'Google Drive', authorization: 'oauth',
    actions: [{ id: 'read_google_drive_file', description: 'Read the one Google Drive file explicitly requested in this turn.',
      classification: 'read', risk: 'low', requiredScopes: [DRIVE_SCOPE], requiresConnection: true, requiresConfirmation: false,
      matches: request => googleFileId(request) !== null }],
    oauth: {
      authorize: ({ redirectUri, state, challenge }) => { const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        url.search = new URLSearchParams({ client_id: clientId(), redirect_uri: redirectUri, response_type: 'code',
          scope: DRIVE_SCOPES.join(' '), state, code_challenge: challenge, code_challenge_method: 'S256',
          access_type: 'offline', prompt: 'consent select_account' }).toString(); return url.toString(); },
      exchange: ({ redirectUri, code, verifier }) => token({ grant_type: 'authorization_code', redirect_uri: redirectUri, code, code_verifier: verifier }),
      refresh: previous => { if (!previous.refreshToken) throw new Error('authorization_expired');
        return token({ grant_type: 'refresh_token', refresh_token: previous.refreshToken }, previous); },
      revoke: async credentials => { await upstream('https://oauth2.googleapis.com/revoke', { method: 'POST',
        body: new URLSearchParams({ token: credentials.refreshToken ?? credentials.accessToken }) }); },
    },
    execute: async ({ actionId, request, credential, signal }) => {
      if (actionId !== 'read_google_drive_file') throw new Error('permission_missing');
      const id = googleFileId(request); if (!id) throw new Error('resource_not_found');
      const credentials = parseCredentials(JSON.parse(credential ?? '{}'));
      const headers = { Authorization: `Bearer ${credentials.accessToken}` };
      const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`;
      const response = await upstream(`${base}?fields=id,name,mimeType,size,capabilities(canDownload)&supportsAllDrives=true`, { headers }, signal);
      const file = z.object({ id: z.literal(id), name: z.string().min(1).max(160), mimeType: z.string(), size: z.string().optional(),
        capabilities: z.object({ canDownload: z.boolean().optional() }).optional() }).parse(JSON.parse(await boundedBody(response, 10_000)));
      if (file.capabilities?.canDownload === false) throw new Error('permission_missing');
      const exported = file.mimeType === 'application/vnd.google-apps.document' ? 'text/plain'
        : file.mimeType === 'application/vnd.google-apps.spreadsheet' ? 'text/csv'
          : file.mimeType === 'application/vnd.google-apps.presentation' ? 'text/plain' : null;
      if (!exported && !['text/plain', 'text/markdown', 'text/csv'].includes(file.mimeType)) throw new Error('resource_not_found');
      if (file.size && Number(file.size) > 120_000) throw new Error('resource_not_found');
      const content = await upstream(exported ? `${base}/export?mimeType=${encodeURIComponent(exported)}` : `${base}?alt=media`, { headers }, signal);
      const text = await boundedBody(content);
      if (text.includes(credentials.accessToken) || (credentials.refreshToken && text.includes(credentials.refreshToken))) throw new Error('permission_missing');
      return { sourceId: id, name: file.name, mimeType: exported ?? file.mimeType, text };
    } };
}
