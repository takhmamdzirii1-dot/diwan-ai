export const MEDIA_MAX_AGE_MS = 30 * 60_000;
export const MEDIA_POLL_MIN_MS = 5_000;

export type RecoveryExecution = {
  id: string; user_id: string; modality: 'image' | 'video'; model_id: string;
  provider_id: string; provider_model_id: string; operation_key: string; payload_hash: string;
  reservation_id: string | null; state: string; created_at: string;
  credits_charged: number | null; error_code: string | null;
  execution_metadata: Record<string, unknown>;
  media_context: { prompt: string; customerCharge: number; duration?: number; providerCostMinor?: number | null; trialPlan?: string } | null;
};
export type RecoveryProviderResult = { state: 'completed' | 'queued'; rawStatus?: string; mediaUrl?: string; mimeType?: string };
export type MediaStatus = {
  executionId: string; modality: 'image' | 'video'; state: 'queued' | 'processing' | 'completed' | 'failed';
  result?: { src: string; mimeType: string; libraryAssetId: string };
  creditsCharged: number; creditsReleased: boolean; timeout: boolean; error?: string; retryAfterMs: number;
};

export function mediaStatus(row: RecoveryExecution): MediaStatus {
  const terminal = !['reserved', 'streaming'].includes(row.state);
  return {
    executionId: row.id, modality: row.modality,
    state: row.state === 'completed' ? 'completed' : terminal ? 'failed'
      : row.execution_metadata.provider_operation_id ? 'processing' : 'queued',
    creditsCharged: Number(row.credits_charged ?? 0),
    // A terminal error alone does NOT prove the DB released the hold.
    creditsReleased: terminal && row.state !== 'completed' && row.execution_metadata.release_confirmed === true,
    timeout: row.execution_metadata.outcome === 'abandoned',
    ...(terminal && row.state !== 'completed' ? { error: row.execution_metadata.outcome === 'abandoned' ? 'GENERATION_TIMEOUT' : 'GENERATION_FAILED' } : {}),
    retryAfterMs: Math.max(MEDIA_POLL_MIN_MS, Number(row.execution_metadata.retry_after_ms ?? MEDIA_POLL_MIN_MS)),
  };
}

export type RecoveryDependencies = {
  claim: () => Promise<boolean>;
  existingResult: () => Promise<{ src: string; mimeType: string; libraryAssetId: string } | null>;
  readProvider: (id: string) => Promise<RecoveryProviderResult>;
  persist: (result: RecoveryProviderResult) => Promise<unknown>;
  checkpoint: (metadata: Record<string, unknown>, delaySeconds: number) => Promise<void>;
  finalize: (terminal: 'completed' | 'failed' | 'provider_cancelled', outcome: string, providerStatus: string, error?: string) => Promise<void>;
  now: () => number;
};

/** One lazy status attempt, no polling loop. Leases serialize persistence/finalization. */
export async function reconcileMediaExecution(row: RecoveryExecution, deps: RecoveryDependencies) {
  if (!['reserved', 'streaming'].includes(row.state) || !await deps.claim()) return;
  const expired = deps.now() - Date.parse(row.created_at) >= MEDIA_MAX_AGE_MS;
  const operationId = row.execution_metadata.provider_operation_id;
  const knownSuccess = ['succeeded', 'completed'].includes(String(row.execution_metadata.provider_status));
  let providerStatus = String(row.execution_metadata.provider_status ?? 'unknown');
  let finalizing = false;
  const finalize: RecoveryDependencies['finalize'] = async (...args) => {
    finalizing = true;
    await deps.finalize(...args);
  };
  try {
    // A save may have completed before a killed/failed settlement request.
    if (await deps.existingResult()) {
      if (row.execution_metadata.durable_media_saved === true) {
        await finalize('completed', 'completed', 'succeeded');
        return;
      }
    }
    if (row.modality === 'image' || typeof operationId !== 'string') {
      const noIdExpired = deps.now() - Date.parse(row.created_at) >= 15 * 60_000;
      if (expired || noIdExpired) await finalize('failed', knownSuccess ? 'our_loss' : 'abandoned', providerStatus, 'PROVIDER_OPERATION_EXPIRED');
      else await deps.checkpoint({ recovery_stage: 'awaiting_operation' }, 30);
      return;
    }
    // Never choose an endpoint/model supplied by the caller, nor read an unknown protocol.
    if (row.provider_id !== 'pruna_ai' || row.provider_model_id !== 'p-video-2-pro') {
      if (expired) await finalize('failed', 'abandoned', 'unknown', 'PROVIDER_STATUS_ADAPTER_UNAVAILABLE');
      else await deps.checkpoint({ recovery_stage: 'adapter_unavailable' }, 60);
      return;
    }
    const result = await deps.readProvider(operationId);
    providerStatus = result.rawStatus ?? result.state;
    if (result.state === 'completed') {
      // A completed provider prediction is never charged before durable storage.
      try { await deps.persist(result); }
      catch {
        if (expired) await finalize('failed', 'our_loss', 'succeeded', 'MEDIA_DELIVERY_FAILED');
        else await deps.checkpoint({ provider_status: 'succeeded', recovery_stage: 'save_retry', last_recovery_error: 'MEDIA_SAVE_FAILED' }, 30);
        return;
      }
      await finalize('completed', 'completed', 'succeeded');
    } else if (expired) {
      await finalize('failed', 'abandoned', providerStatus, 'PROVIDER_MAX_AGE_EXCEEDED');
    } else {
      await deps.checkpoint({ provider_status: providerStatus, recovery_stage: 'running' }, 5);
    }
  } catch (cause) {
    // A finance transport error is not a provider failure. Never compensate a
    // potentially committed settlement with release; retry the same RPC later.
    if (finalizing) throw cause;
    const error = cause as { code?: string; retryAfterMs?: number };
    if (error.code === 'PROVIDER_EXECUTION_FAILED' || error.code === 'PROVIDER_CANCELLED') {
      await deps.finalize(error.code === 'PROVIDER_CANCELLED' ? 'provider_cancelled' : 'failed', 'failed',
        error.code === 'PROVIDER_CANCELLED' ? 'canceled' : 'failed', error.code);
    } else if (expired) {
      await deps.finalize('failed', knownSuccess || providerStatus === 'succeeded' ? 'our_loss' : 'abandoned',
        providerStatus, 'MEDIA_RECOVERY_EXPIRED');
    } else {
      // Status network/auth/429 errors are NOT terminal provider outcomes.
      const delay = Math.max(5, Math.min(1800, Math.ceil((error.retryAfterMs ?? 15_000) / 1000)));
      await deps.checkpoint({ provider_status: providerStatus, recovery_stage: 'status_retry',
        last_recovery_error: error.code === 'PROVIDER_RATE_LIMITED' ? error.code : 'MEDIA_STATUS_UNAVAILABLE', retry_after_ms: delay * 1000 }, delay);
    }
  }
}
