import 'server-only';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { decryptToken, encryptToken } from '@/lib/ai/provider-connections';
import type { ConnectedAppConnection, ConnectedCredentials } from './core';
import { parseCredentials } from './oauth';
import { configuredConnectedApps, knownConnectedApp } from './registry.server';

type StoredRow = { id: string; app_id: string; scopes: string[]; status: 'connected' | 'disconnected';
  expires_at: string | null; encrypted_credentials: string | null };

function admin() {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('CONNECTED_APPS_UNAVAILABLE');
  return client;
}

function publicConnection(row: StoredRow): ConnectedAppConnection {
  const credentials = storedCredentials(row);
  return { id: row.id, appId: row.app_id, scopes: row.scopes,
    status: row.status, expiresAt: knownConnectedApp(row.app_id)?.authorization === 'oauth' && row.status === 'connected' && !credentials ? new Date(0).toISOString() : row.expires_at,
    ...(row.status === 'connected' && credentials ? { account: { name: credentials.account.name, email: credentials.account.email } } : {}) };
}

function storedCredentials(row: StoredRow): ConnectedCredentials | null {
  try { return parseCredentials(JSON.parse(decryptToken(row.encrypted_credentials ?? '') ?? '{}')); } catch { return null; }
}

export async function listUserConnections(userId: string): Promise<ConnectedAppConnection[]> {
  const { data, error } = await admin().from('connected_app_connections')
    .select('id,app_id,scopes,status,expires_at,encrypted_credentials').eq('user_id', userId);
  if (error) throw new Error('CONNECTED_APPS_UNAVAILABLE');
  return Promise.all((data ?? []).map(async value => {
    const row = value as StoredRow;
    const credentials = storedCredentials(row);
    if (row.status === 'connected' && credentials && Date.parse(credentials.expiresAt) < Date.now() + 60_000
      && configuredConnectedApps().find(app => app.id === row.app_id)?.oauth?.refresh) {
      // Access-token expiry is not account disconnection when a valid refresh grant exists.
      return (await readUserConnection(userId, row.app_id)).connection ?? publicConnection(row);
    }
    return publicConnection(row);
  }));
}

const renewing = new Map<string, Promise<{ connection: ConnectedAppConnection | null; credential: string | null }>>();

export async function readUserConnection(userId: string, appId: string): Promise<{
  connection: ConnectedAppConnection | null; credential: string | null;
}> {
  const { data, error } = await admin().from('connected_app_connections')
    .select('id,app_id,scopes,status,expires_at,encrypted_credentials')
    .eq('user_id', userId).eq('app_id', appId).maybeSingle();
  if (error) throw new Error('CONNECTED_APPS_UNAVAILABLE');
  const row = data as StoredRow | null;
  const credentials = row ? storedCredentials(row) : null;
  const oauth = configuredConnectedApps().find(app => app.id === appId)?.oauth;
  if (row?.status === 'connected' && credentials && oauth?.refresh && Date.parse(credentials.expiresAt) < Date.now() + 60_000) {
    const key = `${userId}:${appId}`;
    const existing = renewing.get(key); if (existing) return existing;
    const original = row;
    const renewal = (async () => {
      try {
        const refreshed = parseCredentials({ ...await oauth.refresh!(credentials), grantId: credentials.grantId });
        const { data, error } = await admin().from('connected_app_connections')
          .update({ encrypted_credentials: encryptToken(JSON.stringify(refreshed)), expires_at: refreshed.expiresAt,
            scopes: refreshed.scopes, updated_at: new Date().toISOString() })
          .eq('user_id', userId).eq('app_id', appId).eq('status', 'connected')
          .eq('encrypted_credentials', original.encrypted_credentials!)
          .select('id,app_id,scopes,status,expires_at,encrypted_credentials').maybeSingle();
        if (error) throw new Error('CONNECTED_APPS_UNAVAILABLE');
        if (data) return { connection: publicConnection(data as StoredRow), credential: JSON.stringify(refreshed) };
        // A concurrent disconnect/reconnect wins. Never resurrect the old grant.
        const { data: latest, error: latestError } = await admin().from('connected_app_connections')
          .select('id,app_id,scopes,status,expires_at,encrypted_credentials').eq('user_id', userId).eq('app_id', appId).maybeSingle();
        if (latestError) throw new Error('CONNECTED_APPS_UNAVAILABLE');
        const current = latest as StoredRow | null;
        return { connection: current ? publicConnection(current) : null,
          credential: current?.status === 'connected' && current.encrypted_credentials ? decryptToken(current.encrypted_credentials) : null };
      } catch (cause) {
        if (cause instanceof Error && ['authorization_expired', 'permission_missing'].includes(cause.message))
          return { connection: { ...publicConnection(original), expiresAt: new Date(0).toISOString() }, credential: null };
        throw new Error(cause instanceof Error && cause.message === 'provider_rate_limited' ? 'provider_rate_limited' : 'provider_unavailable');
      }
    })();
    renewing.set(key, renewal);
    try { return await renewal; } finally { renewing.delete(key); }
  }
  return { connection: row ? publicConnection(row) : null,
    credential: row?.status === 'connected' && row.encrypted_credentials ? decryptToken(row.encrypted_credentials) : null };
}

export async function saveUserConnection(userId: string, appId: string, scopes: string[], credential?: ConnectedCredentials): Promise<ConnectedAppConnection> {
  const grant = credential ? parseCredentials({ ...credential, grantId: crypto.randomUUID() }) : null;
  const { data, error } = await admin().from('connected_app_connections')
    .upsert({ user_id: userId, app_id: appId, status: 'connected', scopes: grant?.scopes ?? scopes,
      encrypted_credentials: grant ? encryptToken(JSON.stringify(grant)) : null,
      expires_at: grant?.expiresAt ?? null, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,app_id' })
    .select('id,app_id,scopes,status,expires_at,encrypted_credentials').single();
  if (error || !data) throw new Error('CONNECTED_APPS_UNAVAILABLE');
  return publicConnection(data as StoredRow);
}

export async function disconnectUserConnection(userId: string, appId: string): Promise<{ revoked: boolean }> {
  if (appId === 'woocommerce') {
    const pending = await admin().from('connected_app_authorizations').update({ status: 'cancelled' })
      .eq('user_id', userId).eq('app_id', appId).eq('status', 'pending');
    if (pending.error) throw new Error('CONNECTED_APPS_UNAVAILABLE');
  }
  const { data, error: readError } = await admin().from('connected_app_connections').select('encrypted_credentials')
    .eq('user_id', userId).eq('app_id', appId).maybeSingle();
  if (readError) throw new Error('CONNECTED_APPS_UNAVAILABLE');
  const { error } = await admin().from('connected_app_connections')
    .update({ status: 'disconnected', scopes: [], encrypted_credentials: null,
      expires_at: null, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('app_id', appId);
  if (error) throw new Error('CONNECTED_APPS_UNAVAILABLE');
  const adapter = knownConnectedApp(appId);
  if (!data?.encrypted_credentials) return { revoked: true };
  try {
    const credentials = parseCredentials(JSON.parse(decryptToken(data.encrypted_credentials) ?? '{}'));
    if (!adapter?.oauth?.revoke) return { revoked: false };
    await adapter.oauth.revoke(credentials); return { revoked: true };
  } catch { return { revoked: false }; }
}
