import 'server-only';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { decryptToken } from '@/lib/ai/provider-connections';
import type { ConnectedAppConnection } from './core';

type StoredRow = { id: string; app_id: string; scopes: string[]; status: 'connected' | 'disconnected';
  expires_at: string | null; encrypted_credentials: string | null };

function admin() {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('CONNECTED_APPS_UNAVAILABLE');
  return client;
}

function publicConnection(row: StoredRow): ConnectedAppConnection {
  return { id: row.id, appId: row.app_id, scopes: row.scopes,
    status: row.status, expiresAt: row.expires_at };
}

export async function listUserConnections(userId: string): Promise<ConnectedAppConnection[]> {
  const { data, error } = await admin().from('connected_app_connections')
    .select('id,app_id,scopes,status,expires_at').eq('user_id', userId);
  if (error) throw new Error('CONNECTED_APPS_UNAVAILABLE');
  return (data ?? []).map((row) => publicConnection({ ...row, encrypted_credentials: null } as StoredRow));
}

export async function readUserConnection(userId: string, appId: string): Promise<{
  connection: ConnectedAppConnection | null; credential: string | null;
}> {
  const { data, error } = await admin().from('connected_app_connections')
    .select('id,app_id,scopes,status,expires_at,encrypted_credentials')
    .eq('user_id', userId).eq('app_id', appId).maybeSingle();
  if (error) throw new Error('CONNECTED_APPS_UNAVAILABLE');
  const row = data as StoredRow | null;
  return { connection: row ? publicConnection(row) : null,
    credential: row?.encrypted_credentials ? decryptToken(row.encrypted_credentials) : null };
}

export async function saveUserConnection(userId: string, appId: string, scopes: string[]): Promise<ConnectedAppConnection> {
  const { data, error } = await admin().from('connected_app_connections')
    .upsert({ user_id: userId, app_id: appId, status: 'connected', scopes,
      encrypted_credentials: null, expires_at: null, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,app_id' })
    .select('id,app_id,scopes,status,expires_at').single();
  if (error || !data) throw new Error('CONNECTED_APPS_UNAVAILABLE');
  return publicConnection({ ...data, encrypted_credentials: null } as StoredRow);
}

export async function disconnectUserConnection(userId: string, appId: string): Promise<void> {
  const { error } = await admin().from('connected_app_connections')
    .update({ status: 'disconnected', scopes: [], encrypted_credentials: null,
      expires_at: null, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('app_id', appId);
  if (error) throw new Error('CONNECTED_APPS_UNAVAILABLE');
}
