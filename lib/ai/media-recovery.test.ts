import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { reconcileMediaExecution, mediaStatus, MEDIA_MAX_AGE_MS, type RecoveryExecution, type RecoveryDependencies } from './media-recovery';
import { nextMediaPollDelay, MediaExecutionError, mediaFailureText, waitForOwnedMedia } from '@/src/components/studio/media-recovery-client';

const now = Date.parse('2026-10-03T12:00:00Z');
test('owned recovery carries customer prompt/settings but no provider or financial context to the canvas', () => {
  const status = mediaStatus(execution({ execution_metadata: { aspectRatio: '9:16', sourceMode: 'image', resolution: '480p', mode: 'quality', secret: 'not-client-data' } }));
  assert.deepEqual(status.context, { prompt: 'fixture', modelId: 'public-model', duration: undefined, aspectRatio: '9:16', sourceMode: 'image', resolution: '480p', mode: 'quality' });
  assert.equal(JSON.stringify(status).includes('not-client-data'), false);
  assert.equal(JSON.stringify(status).includes('providerCost'), false);
});
function execution(overrides: Partial<RecoveryExecution> = {}): RecoveryExecution {
  return { id: 'execution', user_id: 'owner', modality: 'video', model_id: 'public-model', provider_id: 'pruna_ai',
    provider_model_id: 'p-video-2-pro', operation_key: 'operation', payload_hash: 'hash', reservation_id: 'reservation',
    state: 'streaming', created_at: new Date(now - 60_000).toISOString(), credits_charged: null, error_code: null,
    execution_metadata: { provider_operation_id: 'prediction', provider_status: 'processing' },
    media_context: { prompt: 'fixture', customerCharge: 30 }, ...overrides };
}
function harness(row: RecoveryExecution) {
  const calls: string[] = [];
  let claimed = false;
  const deps: RecoveryDependencies = {
    now: () => now,
    claim: async () => { if (claimed) return false; claimed = true; return true; },
    existingResult: async () => null,
    readProvider: async () => { calls.push('read'); return { state: 'completed', rawStatus: 'succeeded', mediaUrl: 'https://example.invalid/result' }; },
    persist: async () => { calls.push('save'); },
    checkpoint: async (metadata, delay) => { calls.push(`checkpoint:${metadata.recovery_stage}:${delay}`); },
    finalize: async (terminal, outcome) => { calls.push(`finalize:${terminal}:${outcome}`); row.state = terminal === 'completed' ? 'completed' : 'failed'; },
  };
  return { calls, deps };
}

test('success persists before financial finalization; concurrent/replayed observers finalize once', async () => {
  const row = execution(); const { calls, deps } = harness(row);
  await Promise.all([reconcileMediaExecution(row, deps), reconcileMediaExecution(row, deps)]);
  await reconcileMediaExecution(row, deps);
  assert.deepEqual(calls, ['read', 'save', 'finalize:completed:completed']);
});
test('confirmed provider failure/cancellation releases, without saving or success settlement', async () => {
  for (const code of ['PROVIDER_EXECUTION_FAILED', 'PROVIDER_CANCELLED']) {
    const row = execution(); const { calls, deps } = harness(row);
    deps.readProvider = async () => { throw { code }; };
    await reconcileMediaExecution(row, deps);
    assert.deepEqual(calls, [`finalize:${code === 'PROVIDER_CANCELLED' ? 'provider_cancelled' : 'failed'}:failed`]);
  }
});
test('running predictions retain the reservation until max age, then become abandoned', async () => {
  for (const expired of [false, true]) {
    const row = execution({ created_at: new Date(now - (expired ? MEDIA_MAX_AGE_MS : 10 * 60_000)).toISOString() });
    const { calls, deps } = harness(row);
    deps.readProvider = async () => ({ state: 'queued', rawStatus: 'processing' });
    await reconcileMediaExecution(row, deps);
    assert.deepEqual(calls, [expired ? 'finalize:failed:abandoned' : 'checkpoint:running:5']);
  }
});
test('expired predictions with usable outputs still settle after saving', async () => {
  const row = execution({ created_at: new Date(now - MEDIA_MAX_AGE_MS).toISOString() });
  const { calls, deps } = harness(row);
  await reconcileMediaExecution(row, deps);
  assert.deepEqual(calls, ['read', 'save', 'finalize:completed:completed']);
});
test('failed save recovers on a later read; exhausted recovery logs our loss and releases', async () => {
  for (const expired of [false, true]) {
    const row = execution({ created_at: new Date(now - (expired ? MEDIA_MAX_AGE_MS : 60_000)).toISOString() });
    const { calls, deps } = harness(row);
    deps.persist = async () => { calls.push('save_failed'); throw new Error('storage failed'); };
    await reconcileMediaExecution(row, deps);
    assert.deepEqual(calls, ['read', 'save_failed', expired ? 'finalize:failed:our_loss' : 'checkpoint:save_retry:30']);
  }
});
test('finance transport errors never turn a saved success into compensating release', async () => {
  const row = execution({ created_at: new Date(now - MEDIA_MAX_AGE_MS).toISOString() });
  const { calls, deps } = harness(row);
  deps.finalize = async () => { calls.push('settlement_transport_error'); throw new Error('ambiguous DB transport'); };
  await assert.rejects(reconcileMediaExecution(row, deps), /ambiguous DB transport/);
  assert.deepEqual(calls, ['read', 'save', 'settlement_transport_error']);
});
test('a durable server save marker recovers without another provider read', async () => {
  const row = execution({ execution_metadata: { durable_media_saved: true, provider_status: 'succeeded' } });
  const { calls, deps } = harness(row);
  deps.existingResult = async () => ({ src: '/api/library/media/execution', mimeType: 'video/mp4', libraryAssetId: 'execution' });
  await reconcileMediaExecution(row, deps);
  assert.deepEqual(calls, ['finalize:completed:completed']);
});
test('an untrusted Library row alone does not prove a provider success', async () => {
  const row = execution(); const { calls, deps } = harness(row);
  deps.existingResult = async () => ({ src: '/api/library/media/execution', mimeType: 'video/mp4', libraryAssetId: 'execution' });
  deps.readProvider = async () => { throw { code: 'PROVIDER_EXECUTION_FAILED' }; };
  await reconcileMediaExecution(row, deps);
  assert.deepEqual(calls, ['finalize:failed:failed']);
});
test('no prediction ID waits for expiry; no provider status call is invented', async () => {
  for (const expired of [false, true]) {
    const row = execution({ execution_metadata: {}, created_at: new Date(now - (expired ? 16 * 60_000 : 60_000)).toISOString() });
    const { calls, deps } = harness(row);
    await reconcileMediaExecution(row, deps);
    assert.deepEqual(calls, [expired ? 'finalize:failed:abandoned' : 'checkpoint:awaiting_operation:30']);
  }
});
test('429/status network errors are nonterminal and respect bounded Retry-After', async () => {
  const row = execution(); const { calls, deps } = harness(row);
  deps.readProvider = async () => { throw { code: 'PROVIDER_RATE_LIMITED', retryAfterMs: 60_000 }; };
  await reconcileMediaExecution(row, deps);
  assert.deepEqual(calls, ['checkpoint:status_retry:60']);
  assert.equal(row.state, 'streaming');
});
test('images never invoke a provider status adapter; expired holds are released', async () => {
  const row = execution({ modality: 'image', execution_metadata: {}, created_at: new Date(now - MEDIA_MAX_AGE_MS).toISOString() });
  const { calls, deps } = harness(row);
  await reconcileMediaExecution(row, deps);
  assert.deepEqual(calls, ['finalize:failed:abandoned']);
});
test('client backoff never polls more often than 5s and respects provider delay', () => {
  assert.equal(nextMediaPollDelay(0), 5000);
  assert.equal(nextMediaPollDelay(20), 30000);
  assert.equal(nextMediaPollDelay(1, 60000), 60000);
});

test('stopping an observer does not issue a provider cancel or status request', async context => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('not expected'); };
  const controller = new AbortController(); controller.abort();
  await assert.rejects(waitForOwnedMedia('execution', controller.signal), { name: 'AbortError' });
  assert.equal(calls, 0);
});

test('unknown provider status protocols never receive prediction IDs', async () => {
  const row = execution({ provider_id: 'unknown' });
  const { calls, deps } = harness(row);
  await reconcileMediaExecution(row, deps);
  assert.deepEqual(calls, ['checkpoint:adapter_unavailable:60']);
});
test('failure copy only promises released credits with DB confirmation, including timeout', () => {
  const status = mediaStatus(execution({ state: 'failed', execution_metadata: { outcome: 'abandoned' } }));
  assert.equal(status.creditsReleased, false);
  assert.equal(mediaFailureText(new MediaExecutionError(status), 'en', 'Generation failed.'), 'Generation timed out.');
  status.creditsReleased = true;
  assert.equal(mediaFailureText(new MediaExecutionError(status), 'en', 'Generation failed.'), 'Generation timed out. Credits released.');
});
test('additive SQL binds owner/lease, serializes active jobs, gates durable result and atomically finalizes model trial', () => {
  const sql = readFileSync('supabase/migrations/20261003020000_media_lazy_recovery.sql', 'utf8');
  assert.doesNotMatch(sql, /drop\s|rename\s/i);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /created_at > now\(\)-interval '30 minutes'/);
  assert.match(sql, /id=p_execution_id and user_id=p_user_id for update/);
  assert.match(sql, /media_lease_token is distinct from p_token/);
  assert.match(sql, /durable_media_saved/);
  assert.match(sql, /DURABLE_MEDIA_RESULT_REQUIRED/);
  assert.match(sql, /public.finalize_ai_execution_terminal/);
  assert.match(sql, /public.finalize_model_trial_access/);
  assert.match(sql, /auth.role\(\)\) is distinct from 'service_role'/);
  assert.match(sql, /p_terminal is null/);
  assert.match(sql, /p_metadata is null/);
  assert.match(sql, /align_accepted_media_expiry/);
  assert.match(sql, /expires_at=greatest\(expires_at,new.created_at\+interval '30 minutes'\)/);
  assert.match(sql, /credit_reservation_id=new.reservation_id and state='reserved'/);
  assert.match(sql, /revoke all on function public.finalize_media_execution.*from public,anon,authenticated/);
});
