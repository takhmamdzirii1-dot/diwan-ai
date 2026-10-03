import 'server-only';
import { randomUUID } from 'node:crypto';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { getPrunaPredictionStatus } from './providers/media';
import { persistGeneratedMedia } from './library-media';
import { recordProviderResult } from '@/lib/credits/generation-finance';
import { recordFunnelEvent } from '@/lib/analytics/funnel-events';
import { mediaStatus, reconcileMediaExecution, type RecoveryExecution } from './media-recovery';

function client() {
  const value = getSupabaseAdminClient();
  if (!value) throw new Error('MEDIA_RECOVERY_UNAVAILABLE');
  return value;
}

export async function prepareMediaRecovery(executionId: string, userId: string, context: NonNullable<RecoveryExecution['media_context']>) {
  const token = randomUUID();
  const claim = await client().rpc('claim_media_execution', { p_execution_id: executionId, p_user_id: userId, p_token: token });
  if (claim.error || !claim.data) throw new Error('MEDIA_RECOVERY_UNAVAILABLE');
  const saved = await client().from('ai_executions').update({ media_context: context })
    .eq('id', executionId).eq('user_id', userId).eq('media_lease_token', token).select('id').single();
  if (saved.error) throw new Error('MEDIA_RECOVERY_CONTEXT_FAILED');
  return token;
}

export async function checkpointMedia(executionId: string, userId: string, token: string, metadata: Record<string, unknown>, delaySeconds = 5) {
  const value = await client().rpc('checkpoint_media_execution', {
    p_execution_id: executionId, p_user_id: userId, p_token: token,
    p_metadata: { ...metadata, last_status_observed_at: new Date().toISOString() }, p_delay_seconds: delaySeconds,
  });
  if (value.error || !value.data) throw new Error('MEDIA_CHECKPOINT_FAILED');
}

async function ownedExecution(executionId: string, userId: string) {
  const value = await client().from('ai_executions').select('*').eq('id', executionId).eq('user_id', userId)
    .in('modality', ['image', 'video']).maybeSingle();
  if (value.error) throw new Error('MEDIA_STATUS_UNAVAILABLE');
  if (value.data && value.data.user_id !== userId) throw new Error('EXECUTION_NOT_FOUND');
  return value.data as RecoveryExecution | null;
}

export async function replayMediaOperation(userId: string, operationKey: string, payloadHash: string, modelKey: string, routeId: string) {
  const value = await client().from('ai_executions').select('id,payload_hash,model_key,route_id')
    .eq('user_id', userId).eq('operation_key', operationKey).eq('modality', 'video').maybeSingle();
  if (value.error) throw new Error('MEDIA_STATUS_UNAVAILABLE');
  if (!value.data) return null;
  if (value.data.payload_hash !== payloadHash || value.data.model_key !== modelKey || value.data.route_id !== routeId) throw new Error('INVALID_IDEMPOTENCY_REPLAY');
  return recoverOwnedMedia(value.data.id, userId);
}

export async function observeMedia(executionId: string, userId: string, token: string, metadata: Record<string, unknown>) {
  const row = await ownedExecution(executionId, userId);
  if (!row) throw new Error('EXECUTION_NOT_FOUND');
  const value = await client().from('ai_executions').update({ execution_metadata: { ...row.execution_metadata, ...metadata } })
    .eq('id', executionId).eq('user_id', userId).eq('media_lease_token', token)
    .in('state', ['reserved', 'streaming']).select('id').single();
  if (value.error) throw new Error('MEDIA_OBSERVATION_PENDING');
}

export async function finishPreparedMedia(executionId: string, userId: string, token: string,
  terminal: 'completed' | 'failed' | 'provider_cancelled', outcome: string, providerStatus: string, error?: string) {
  const value = await client().rpc('finalize_media_execution', { p_execution_id: executionId, p_user_id: userId,
    p_token: token, p_terminal: terminal, p_outcome: outcome, p_provider_status: providerStatus,
    p_error: error ?? null, p_provider_cost_minor: null });
  if (value.error) throw new Error('MEDIA_FINALIZATION_PENDING');
  return value.data as Record<string, unknown>;
}

export async function confirmedMediaRelease(executionId: string, userId: string) {
  const row = await ownedExecution(executionId, userId);
  if (!row || ['reserved', 'streaming', 'completed'].includes(row.state) || !row.reservation_id) return false;
  const hold = await client().from('credit_reservations').select('state').eq('id', row.reservation_id).eq('user_id', userId).maybeSingle();
  return !hold.error && hold.data?.state === 'released';
}

async function ownedResult(row: RecoveryExecution) {
  const value = await client().from('generations').select('id,status,storage_path,metadata')
    .eq('id', row.id).eq('user_id', row.user_id).eq('type', row.modality).maybeSingle();
  if (value.error) throw new Error('MEDIA_RESULT_UNAVAILABLE');
  if (!value.data || value.data.status !== 'completed' || !value.data.storage_path) return null;
  return { libraryAssetId: value.data.id, src: `/api/library/media/${value.data.id}`,
    mimeType: value.data.metadata?.mimeType ?? (row.modality === 'video' ? 'video/mp4' : 'image/png') };
}

export async function recoverOwnedMedia(executionId: string, userId: string) {
  let row = await ownedExecution(executionId, userId);
  if (!row) return null;
  const token = randomUUID();
  await reconcileMediaExecution(row, {
    now: Date.now,
    claim: async () => {
      const value = await client().rpc('claim_media_execution', { p_execution_id: executionId, p_user_id: userId, p_token: token });
      if (value.error) throw new Error('MEDIA_RECOVERY_UNAVAILABLE');
      return value.data === true;
    },
    existingResult: () => ownedResult(row!),
    readProvider: getPrunaPredictionStatus,
    persist: async result => {
      if (!row!.media_context) throw new Error('MEDIA_CONTEXT_MISSING');
      const saved = await persistGeneratedMedia({ executionId, userId, modality: row!.modality, modelId: row!.model_id,
        prompt: row!.media_context.prompt, duration: row!.media_context.duration,
        mediaUrl: result.mediaUrl, mimeType: result.mimeType ?? 'video/mp4' });
      await observeMedia(executionId, userId, token, { provider_status: 'succeeded', durable_media_saved: true, result_saved_at: new Date().toISOString() });
      return saved;
    },
    checkpoint: (metadata, delay) => checkpointMedia(executionId, userId, token, metadata, delay),
    finalize: async (terminal, outcome, providerStatus, error) => {
      const value = await client().rpc('finalize_media_execution', {
        p_execution_id: executionId, p_user_id: userId, p_token: token, p_terminal: terminal,
        p_outcome: outcome, p_provider_status: providerStatus, p_error: error ?? null,
        p_provider_cost_minor: providerStatus === 'succeeded' ? row!.media_context?.providerCostMinor ?? null : null,
      });
      if (value.error) throw new Error('MEDIA_FINALIZATION_PENDING');
      // Telemetry is best-effort AFTER canonical settlement, never its authority.
      if (!value.data?.idempotent) {
        if (providerStatus === 'succeeded' || providerStatus === 'failed' || providerStatus === 'canceled') {
          await recordProviderResult(row!.provider_id, providerStatus === 'succeeded', error).catch(() => undefined);
        }
        if (terminal === 'completed' && row!.media_context?.trialPlan) {
          await recordFunnelEvent({ userId, event: 'model_trial_used', key: row!.operation_key,
            metadata: { model: row!.model_id, modality: row!.modality, plan: row!.media_context.trialPlan } }).catch(() => undefined);
        }
      }
    },
  });
  row = await ownedExecution(executionId, userId);
  if (!row) return null;
  const status = mediaStatus(row);
  if (status.state === 'completed') {
    const result = await ownedResult(row);
    if (!result) throw new Error('MEDIA_RESULT_UNAVAILABLE');
    status.result = result;
  } else if (status.state === 'failed' && row.reservation_id) {
    const hold = await client().from('credit_reservations').select('state').eq('id', row.reservation_id).eq('user_id', userId).maybeSingle();
    status.creditsReleased = !hold.error && hold.data?.state === 'released';
  }
  return status;
}

export async function reconcileOwnedMedia(userId: string, modality?: 'image' | 'video') {
  const rows = await client().from('ai_executions').select('id').eq('user_id', userId)
    .in('modality', modality ? [modality] : ['image', 'video']).in('state', ['reserved', 'streaming'])
    .order('created_at', { ascending: true }).limit(4);
  if (rows.error) throw new Error('MEDIA_RECOVERY_UNAVAILABLE');
  return Promise.all((rows.data ?? []).map(row => recoverOwnedMedia(row.id, userId)));
}

/** Reattach by the customer's existing operation key, including terminal results.
 * No dispatch, reservation, or client-submitted context is accepted here. */
export async function recoverOwnedMediaOperation(userId: string, operationKey: string) {
  const value = await client().from('ai_executions').select('id').eq('user_id', userId)
    .eq('operation_key', operationKey).in('modality', ['image', 'video']).maybeSingle();
  if (value.error) throw new Error('MEDIA_STATUS_UNAVAILABLE');
  return value.data ? recoverOwnedMedia(value.data.id, userId) : null;
}

/** Scheduler processes a bounded oldest batch; it never creates generations. */
export async function reconcileMediaBatch() {
  const rows = await client().from('ai_executions').select('id,user_id')
    .in('modality', ['image', 'video']).in('state', ['reserved', 'streaming'])
    .lt('created_at', new Date(Date.now() - 5 * 60_000).toISOString())
    .order('created_at', { ascending: true }).limit(4);
  if (rows.error) throw new Error('MEDIA_RECOVERY_UNAVAILABLE');
  const results = await Promise.allSettled((rows.data ?? []).map(row => recoverOwnedMedia(row.id, row.user_id)));
  return { checked: results.length, pending: results.filter(value => value.status === 'rejected').length };
}
