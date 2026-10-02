import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { encryptToken, decryptToken } from '@/lib/ai/provider-connections';
import { configuredConnectedApps } from './registry.server';
import { readUserConnection } from './store.server';
import { connectedActionCandidates, connectionError, explicitConnectedWriteRequest, safeConnectedError, type ConnectedActionMatch, type ConnectedResource } from './core';

const payloadSchema = z.object({ request: z.string().max(800), arguments: z.record(z.unknown()),
  summary: z.string().min(1).max(400), result: z.object({ sourceId: z.string().max(256), name: z.string().max(160),
    mimeType: z.string(), text: z.string().max(30_000) }).optional(), error: z.string().max(64).optional() }).strict();
type ReviewRow = { id: string; app_id: string; action_id: string; connection_id: string; grant_fingerprint: string;
  encrypted_payload: string; operation_key: string; status: string; expires_at: string; created_at: string };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
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
    || !connectedActionCandidates(input.request, [adapter]).some(match => match.action.id === action.id)) throw new Error('permission_missing');
  const args = action.parameters.parse(input.arguments);
  if (JSON.stringify(args).length > 30_000) throw new Error('permission_missing');
  const grant = await readUserConnection(input.userId, adapter.id);
  const blocked = connectionError(grant.connection, action);
  if (blocked || !grant.credential || !grant.connection) throw new Error(blocked ?? 'authorization_expired');
  const payload = payloadSchema.parse({ request: input.request.slice(0, 800), arguments: args, summary: action.reviewSummary(args) });
  const grantFingerprint = fingerprint(grant.connection.id, grant.credential);
  const key = digest(canonical({ grant: grantFingerprint, app: adapter.id, action: action.id, args }));
  // Compatibility with proposals created before content-keyed deduplication.
  const pending = await database().from('connected_app_action_reviews').select('id,encrypted_payload,operation_key')
    .eq('user_id', input.userId).eq('connection_id', grant.connection.id).eq('app_id', adapter.id).eq('action_id', action.id)
    .eq('grant_fingerprint', grantFingerprint).eq('status', 'pending').gt('expires_at', new Date().toISOString()).limit(50);
  if (pending.error) throw new Error('provider_unavailable');
  const legacy = pending.data?.find(row => row.operation_key !== key
    && canonical(payloadSchema.parse(JSON.parse(decryptToken(row.encrypted_payload) ?? '{}')).arguments) === canonical(args));
  if (legacy) return { sourceId: legacy.id, name: 'Action awaiting review', mimeType: 'text/plain',
    text: `Nothing has been changed or sent. Approve the exact proposed action in the chat review card: ${payload.summary}` };
  // Retire only expired pending proposals. Terminal proposals retain their IDs,
  // encrypted snapshots and history; their uniqueness slot is retired on resolution.
  const expired = await database().from('connected_app_action_reviews').update({ status: 'cancelled',
    operation_key: digest(`${key}:expired:${input.operationId}`), updated_at: new Date().toISOString() })
    .eq('user_id', input.userId).eq('operation_key', key).eq('status', 'pending').lte('expires_at', new Date().toISOString());
  if (expired.error) throw new Error('provider_unavailable');
  const { data, error } = await database().from('connected_app_action_reviews').upsert({ user_id: input.userId,
    connection_id: grant.connection.id, app_id: adapter.id, action_id: action.id, operation_key: key,
    grant_fingerprint: grantFingerprint, encrypted_payload: encryptToken(JSON.stringify(payload)) },
  { onConflict: 'user_id,operation_key', ignoreDuplicates: true }).select('id').maybeSingle();
  if (error) throw new Error('provider_unavailable');
  // A duplicate proposal is never an external execution. No customer content in logs/model provenance.
  const existing = data?.id ? data : (await database().from('connected_app_action_reviews').select('id')
    .eq('user_id', input.userId).eq('operation_key', key).maybeSingle()).data;
  if (!existing?.id) throw new Error('provider_unavailable');
  return { sourceId: existing.id, name: 'Action awaiting review', mimeType: 'text/plain',
    text: `Nothing has been changed or sent. Approve the exact proposed action in the chat review card: ${payload.summary}` };
}

export async function listConnectedReviews(userId: string, reviewId?: string) {
  let query = database().from('connected_app_action_reviews').select('id,app_id,action_id,status,expires_at,created_at,encrypted_payload')
    .eq('user_id', userId);
  if (reviewId) query = query.eq('id', reviewId);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(20);
  if (error) throw new Error('provider_unavailable');
  return (data ?? []).map(row => {
    const payload = payloadSchema.parse(JSON.parse(decryptToken(row.encrypted_payload) ?? '{}'));
    const resourceId = payload.result?.sourceId;
    const resultUrl = row.status !== 'completed' ? null : row.app_id === 'gmail' ? 'https://mail.google.com/mail/u/0/#drafts'
      : row.app_id === 'google_workspace' && resourceId && /^[A-Za-z0-9_-]{10,200}$/u.test(resourceId)
        ? `https://docs.google.com/${String(payload.arguments.operation).includes('spreadsheet') ? 'spreadsheets' : 'document'}/d/${resourceId}/edit` : null;
    return { id: row.id, appId: row.app_id, actionId: row.action_id, status: row.status, expiresAt: row.expires_at,
      summary: payload.summary, arguments: payload.arguments, result: payload.result ?? null, resultUrl, error: payload.error ?? null };
  });
}

export async function resolveConnectedReview(userId: string, reviewId: string, approve: boolean, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (process.env.CONNECTED_APPS_WRITES_ENABLED !== 'true') throw new Error('permission_missing');
  if (!approve) {
    const { error } = await database().from('connected_app_action_reviews').update({ status: 'cancelled',
      operation_key: digest(`cancelled:${reviewId}`), updated_at: new Date().toISOString() })
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
      || !explicitConnectedWriteRequest(payload.request)
      || !connectedActionCandidates(payload.request, [adapter]).some(match => match.action.id === action.id)) throw new Error('permission_missing');
    const args = action.parameters.parse(payload.arguments);
    signal?.throwIfAborted();
    // Cancellation/timeout after dispatch is ambiguous: never automatically retry a write.
    status = 'unknown';
    const result = await adapter.execute({ actionId: action.id, request: payload.request, userId, credential: grant.credential,
      arguments: args, signal });
    payload = payloadSchema.parse({ ...payload, result }); status = 'completed';
  } catch (cause) {
    const reason = safeConnectedError(cause);
    if (payload) payload = { ...payload, error: reason };
    console.warn('CONNECTED_REVIEW_RESULT', { reviewId, appId: row.app_id, actionId: row.action_id, status, reason });
    // Once dispatched, even an invalid/missing response may follow a successful
    // external mutation. Keep unknown; never suggest safe automatic resubmission.
  }
  const saved = await database().from('connected_app_action_reviews').update({ status,
    // An ambiguous upstream write retains the uniqueness slot: a retry must not
    // produce a second approvable mutation while the external result is unknown.
    ...(status !== 'unknown' ? { operation_key: digest(`resolved:${reviewId}`) } : {}), updated_at: new Date().toISOString(),
    ...(payload ? { encrypted_payload: encryptToken(JSON.stringify(payload)) } : {}) }).eq('id', reviewId).eq('user_id', userId).eq('status', 'executing');
  if (saved.error) throw new Error('provider_unavailable');
  return { status, result: status === 'completed' ? payload?.result : undefined };
}
