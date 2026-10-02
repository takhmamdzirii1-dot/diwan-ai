import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { encryptToken, decryptToken } from '@/lib/ai/provider-connections';
import { configuredConnectedApps } from './registry.server';
import { readUserConnection } from './store.server';
import { connectionError, explicitConnectedWriteRequest, type ConnectedActionMatch, type ConnectedResource } from './core';

const payloadSchema = z.object({ request: z.string().max(800), arguments: z.record(z.unknown()),
  summary: z.string().min(1).max(400), result: z.object({ sourceId: z.string().max(256), name: z.string().max(160),
    mimeType: z.string(), text: z.string().max(30_000) }).optional() }).strict();
type ReviewRow = { id: string; app_id: string; action_id: string; connection_id: string; grant_fingerprint: string;
  encrypted_payload: string; status: string; expires_at: string; created_at: string };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const fingerprint = (connectionId: string, credential: string) => {
  // Refresh rotation does not invalidate a review, but reconnecting as another account does.
  const value = z.object({ account: z.object({ id: z.string() }), scopes: z.array(z.string()), grantId: z.string().uuid() }).parse(JSON.parse(credential));
  return digest(JSON.stringify({ connectionId, accountId: value.account.id, grantId: value.grantId, scopes: [...value.scopes].sort() }));
};
function database() { const db = getSupabaseAdminClient(); if (!db) throw new Error('provider_unavailable'); return db; }

export async function prepareConnectedReview(input: { userId: string; operationId: string; match: ConnectedActionMatch;
  request: string; arguments: Record<string, unknown> }): Promise<ConnectedResource> {
  const { adapter, action } = input.match;
  if (process.env.CONNECTED_APPS_WRITES_ENABLED !== 'true') throw new Error('permission_missing');
  if (action.classification !== 'write' || !action.parameters || !action.reviewSummary || !explicitConnectedWriteRequest(input.request)
    || !action.matches(input.request)) throw new Error('permission_missing');
  const args = action.parameters.parse(input.arguments);
  if (JSON.stringify(args).length > 30_000) throw new Error('permission_missing');
  const grant = await readUserConnection(input.userId, adapter.id);
  const blocked = connectionError(grant.connection, action);
  if (blocked || !grant.credential || !grant.connection) throw new Error(blocked ?? 'authorization_expired');
  const payload = payloadSchema.parse({ request: input.request.slice(0, 800), arguments: args, summary: action.reviewSummary(args) });
  const key = digest(JSON.stringify({ operation: input.operationId, app: adapter.id, action: action.id, args }));
  const { data, error } = await database().from('connected_app_action_reviews').upsert({ user_id: input.userId,
    connection_id: grant.connection.id, app_id: adapter.id, action_id: action.id, operation_key: key,
    grant_fingerprint: fingerprint(grant.connection.id, grant.credential), encrypted_payload: encryptToken(JSON.stringify(payload)) },
  { onConflict: 'user_id,operation_key', ignoreDuplicates: true }).select('id').maybeSingle();
  if (error) throw new Error('provider_unavailable');
  // A duplicate proposal is never an external execution. No customer content in logs/model provenance.
  return { sourceId: data?.id ?? key, name: 'Action awaiting review', mimeType: 'text/plain',
    text: `Nothing has been changed or sent. Review and confirm the exact proposed action in Settings → Connected apps: ${payload.summary}` };
}

export async function listConnectedReviews(userId: string) {
  const { data, error } = await database().from('connected_app_action_reviews').select('id,app_id,action_id,status,expires_at,created_at,encrypted_payload')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
  if (error) throw new Error('provider_unavailable');
  return (data ?? []).map(row => {
    const payload = payloadSchema.parse(JSON.parse(decryptToken(row.encrypted_payload) ?? '{}'));
    return { id: row.id, appId: row.app_id, actionId: row.action_id, status: row.status, expiresAt: row.expires_at,
      summary: payload.summary, arguments: payload.arguments, result: payload.result ?? null };
  });
}

export async function resolveConnectedReview(userId: string, reviewId: string, approve: boolean, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (process.env.CONNECTED_APPS_WRITES_ENABLED !== 'true') throw new Error('permission_missing');
  if (!approve) {
    const { error } = await database().from('connected_app_action_reviews').update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('id', reviewId).eq('status', 'pending');
    if (error) throw new Error('provider_unavailable'); return { status: 'cancelled' };
  }
  const { data, error } = await database().rpc('claim_connected_app_action_review', { p_user_id: userId, p_id: reviewId });
  if (error) throw new Error('provider_unavailable');
  const row = (data as ReviewRow[] | null)?.[0];
  if (!row) return { status: 'not_executed' }; // Replayed, expired, disconnected or owned by someone else.
  let status = 'failed'; let payload: z.infer<typeof payloadSchema> | undefined;
  try {
    payload = payloadSchema.parse(JSON.parse(decryptToken(row.encrypted_payload) ?? '{}'));
    const adapter = configuredConnectedApps().find(app => app.id === row.app_id);
    const action = adapter?.actions.find(item => item.id === row.action_id && item.classification === 'write');
    const grant = await readUserConnection(userId, row.app_id);
    if (!adapter || !action?.parameters || !grant.credential || !grant.connection || grant.connection.id !== row.connection_id
      || connectionError(grant.connection, action) || fingerprint(grant.connection.id, grant.credential) !== row.grant_fingerprint
      || !explicitConnectedWriteRequest(payload.request) || !action.matches(payload.request)) throw new Error('permission_missing');
    const args = action.parameters.parse(payload.arguments);
    signal?.throwIfAborted();
    // Cancellation/timeout after dispatch is ambiguous: never automatically retry a write.
    status = 'unknown';
    const result = await adapter.execute({ actionId: action.id, request: payload.request, userId, credential: grant.credential,
      arguments: args, signal });
    payload = payloadSchema.parse({ ...payload, result }); status = 'completed';
  } catch {
    // Once dispatched, even an invalid/missing response may follow a successful
    // external mutation. Keep unknown; never suggest safe automatic resubmission.
  }
  const saved = await database().from('connected_app_action_reviews').update({ status, updated_at: new Date().toISOString(),
    ...(payload ? { encrypted_payload: encryptToken(JSON.stringify(payload)) } : {}) }).eq('id', reviewId).eq('user_id', userId).eq('status', 'executing');
  if (saved.error) throw new Error('provider_unavailable');
  return { status, result: status === 'completed' ? payload?.result : undefined };
}
