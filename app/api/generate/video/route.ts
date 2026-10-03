import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createClient } from '@/src/lib/supabase/server';
import {
  PRUNA_SOURCE_IMAGE_MAX_BYTES,
  prunaProviderCostMinor,
  validatePrunaVideoRequest,
  VideoRequestError,
} from '@/lib/ai/pruna-video-request';
import {
  MediaProviderError,
  submitPrunaVideoRoute,
} from '@/lib/ai/providers/media';
import { resolveProviderRoutes } from '@/lib/ai/providers/routes';
import { resolveRuntimeModelAccess } from '@/lib/models/plan-entitlements.server';
import { modelPlanErrorPayload } from '@/lib/models/plan-entitlements';
import type { VideoModelCapabilities } from '@/lib/models/capabilities';
import {
  beginGenerationExecution,
  beginGenerationProviderAttempt,
  finalizeGeneration,
  hashGenerationPayload,
  markGenerationStreaming,
  recordGenerationProviderOperation,
  recordProviderResult,
  reserveGenerationCredits,
  resolveOperationKey,
} from '@/lib/credits/generation-finance';
import { providerFailureCategory } from '@/lib/credits/generation-policy';
import { prepareMediaRecovery, checkpointMedia, recoverOwnedMedia, reconcileOwnedMedia, finishPreparedMedia, confirmedMediaRelease, replayMediaOperation } from '@/lib/ai/media-recovery.server';
import { requireMediaGenerationAccess } from '@/lib/access/trial-access';
import { freeVideoDurationAllowed } from '@/lib/access/trial-state';
import { recordFunnelEvent } from '@/lib/analytics/funnel-events';
import { finalizeModelTrialAccess, reserveModelTrialAccess } from '@/lib/models/model-trial.server';
import { runtimeAccessReasonForError } from '@/lib/models/model-access';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const MAX_JSON_BYTES = 32_000;
const MAX_MULTIPART_BYTES = PRUNA_SOURCE_IMAGE_MAX_BYTES * 2 + 64 * 1024;

function safeResponseCode(code: string) {
  if (code === 'PROVIDER_BUSY' || code === 'CONCURRENCY_LIMITED') return 'GENERATION_BUSY';
  if (/INSUFFICIENT_CREDITS/.test(code)) return 'INSUFFICIENT_CREDITS';
  if (/FREE_ACCESS_RESTRICTED|FREE_VIDEO_TRIAL_EXHAUSTED|FREE_MEDIA_EXPIRED|PAID_PLAN_REACTIVATION_REQUIRED|LITE_VIDEO_ALLOWANCE_EXHAUSTED|PAID_MEDIA_ACCESS_REQUIRED|MODEL_TRIAL_EXHAUSTED|MODEL_TRIAL_UNCONFIGURED/.test(code)) {
    return code;
  }
  if (/MODEL_CUSTOMER_PRICE_UNCONFIGURED/.test(code)) return code;
  if (/MODEL_|INVALID_|UNSUPPORTED_/.test(code)) return code;
  if (/NO_CONFIGURED_PROVIDER_ROUTE|PROVIDER_NOT_CONFIGURED/.test(code)) {
    return 'VIDEO_GENERATION_UNAVAILABLE';
  }
  return 'VIDEO_GENERATION_FAILED';
}

function responseStatus(code: string) {
  if (/INSUFFICIENT_CREDITS|FREE_ACCESS_RESTRICTED|FREE_VIDEO_TRIAL_EXHAUSTED|FREE_MEDIA_EXPIRED|PAID_PLAN_REACTIVATION_REQUIRED|LITE_VIDEO_ALLOWANCE_EXHAUSTED|PAID_MEDIA_ACCESS_REQUIRED|MODEL_TRIAL_EXHAUSTED/.test(code)) return 402;
  if (/AUTHENTICATION_REQUIRED/.test(code)) return 401;
  if (/INVALID_|UNSUPPORTED_/.test(code)) return 400;
  if (/MODEL_CUSTOMER_PRICE_UNCONFIGURED|MODEL_NOT_AVAILABLE|REQUEST_ALREADY_PROCESSED/.test(code)) return 409;
  return 503;
}

async function authenticatedUser(request: Request) {
  const supabase = await createClient();
  const authHeader = request.headers.get('authorization');
  const result = authHeader?.startsWith('Bearer ')
    ? await supabase.auth.getUser(authHeader.slice(7))
    : await supabase.auth.getUser();
  return result.data.user;
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  try {
    await requireMediaGenerationAccess(user);
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : 'STUDIO_ACCESS_UNAVAILABLE';
    if (code === 'FREE_ACCESS_RESTRICTED' || code === 'PAID_PLAN_REACTIVATION_REQUIRED') {
      return NextResponse.json({ error: code, reason: runtimeAccessReasonForError(code) }, { status: 403 });
    }
    return NextResponse.json({ error: 'STUDIO_ACCESS_UNAVAILABLE' }, { status: 503 });
  }
  const multipart = request.headers.get('content-type')?.toLowerCase().includes('multipart/form-data') ?? false;
  const requestLimit = multipart ? MAX_MULTIPART_BYTES : MAX_JSON_BYTES;
  if (Number(request.headers.get('content-length') ?? 0) > requestLimit) {
    return NextResponse.json({ error: 'REQUEST_TOO_LARGE' }, { status: 413 });
  }
  let body: Record<string, unknown> | null = null;
  let sourceImage: FormDataEntryValue | null = null;
  let endImage: FormDataEntryValue | null = null;
  if (multipart) {
    const form = await request.formData().catch(() => null);
    if (form) {
      body = {};
      for (const key of ['prompt', 'modelId', 'sourceMode', 'duration', 'resolution', 'mode', 'operationId']) {
        const value = form.get(key);
        if (typeof value === 'string') body[key] = value;
      }
      sourceImage = form.get('sourceImage');
      endImage = form.get('endImage');
    }
  } else {
    body = await request.json().catch(() => null) as Record<string, unknown> | null;
  }
  if (!body || (!multipart && JSON.stringify(body).length > MAX_JSON_BYTES)) {
    return NextResponse.json({ error: 'INVALID_VIDEO_REQUEST' }, { status: 400 });
  }

  let runtimeModel;
  let resolvedAccess;
  try {
    const requestedModel = typeof body.modelId === 'string' ? body.modelId.trim() : '';
    resolvedAccess = await resolveRuntimeModelAccess(user.id, requestedModel, 'video');
    runtimeModel = resolvedAccess.model;
  } catch (cause) {
    const accessError = modelPlanErrorPayload(cause);
    if (accessError) return NextResponse.json(accessError, { status: 403 });
    const code = cause instanceof Error ? cause.message : 'MODEL_RUNTIME_CONFIG_UNAVAILABLE';
    return NextResponse.json({ error: safeResponseCode(code), reason: runtimeAccessReasonForError(code) }, { status: responseStatus(code) });
  }

  let input;
  try {
    input = validatePrunaVideoRequest(
      body,
      runtimeModel.capabilities as VideoModelCapabilities,
      sourceImage,
      endImage
    );
  } catch (cause) {
    const code = cause instanceof VideoRequestError ? cause.code : 'INVALID_VIDEO_REQUEST';
    return NextResponse.json({ error: code }, { status: 400 });
  }
  if (!freeVideoDurationAllowed(resolvedAccess.currentPlan, input.duration)) {
    return NextResponse.json({ error: resolvedAccess.currentPlan === 'lite' ? 'LITE_VIDEO_DURATION_LIMIT' : 'FREE_VIDEO_DURATION_LIMIT', reason: 'plan_required' }, { status: 403 });
  }

  let route;
  try {
    const routes = await resolveProviderRoutes(runtimeModel);
    route = routes.find((candidate) => candidate.providerId === 'pruna_ai'
      && candidate.providerModelId === 'p-video-2-pro');
    if (!route) throw new Error('NO_CONFIGURED_PROVIDER_ROUTE');
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : 'NO_CONFIGURED_PROVIDER_ROUTE';
    return NextResponse.json({ error: safeResponseCode(code), reason: runtimeAccessReasonForError(code) }, { status: responseStatus(code) });
  }

  let operationKey: string;
  try {
    operationKey = resolveOperationKey(input.operationId ?? request.headers.get('x-idempotency-key'));
  } catch {
    return NextResponse.json({ error: 'INVALID_IDEMPOTENCY_KEY' }, { status: 400 });
  }
  const sourceImageHash = input.sourceImage
    ? createHash('sha256').update(new Uint8Array(await input.sourceImage.arrayBuffer())).digest('hex')
    : null;
  const endImageHash = input.endImage
    ? createHash('sha256').update(new Uint8Array(await input.endImage.arrayBuffer())).digest('hex')
    : null;
  const payloadHash = hashGenerationPayload({
    modelKey: runtimeModel.key,
    prompt: input.prompt,
    sourceMode: input.sourceMode,
    sourceImageHash,
    ...(endImageHash ? { endImageHash } : {}),
    duration: input.duration,
    ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
    resolution: input.resolution,
    mode: input.mode,
  });

  let execution;
  try {
    const replay = await replayMediaOperation(user.id, operationKey, payloadHash, runtimeModel.key, route.id);
    if (replay) return NextResponse.json(replay);
    const reconciled = await reconcileOwnedMedia(user.id, 'video');
    // Do not concatenate slow recovery with a fresh I2V upload/submit.
    if (reconciled.length) throw new Error('CONCURRENCY_LIMITED');
    execution = await beginGenerationExecution({
      userId: user.id, operationKey, payloadHash, model: runtimeModel, route,
    });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : 'EXECUTION_GUARD_FAILED';
    return NextResponse.json({ error: safeResponseCode(code), reason: runtimeAccessReasonForError(code) }, { status: responseStatus(code) });
  }
  if (execution.idempotent) {
    const status = await recoverOwnedMedia(execution.executionId, user.id);
    return NextResponse.json(status ?? { error: 'REQUEST_ALREADY_PROCESSED' }, { status: status ? 200 : 409 });
  }

  let reservation: Awaited<ReturnType<typeof reserveGenerationCredits>> = null;
  try {
    reservation = await reserveGenerationCredits({
      userId: user.id, operationKey, payloadHash, model: runtimeModel, route,
    });
    await reserveModelTrialAccess({
      userId: user.id, modelKey: runtimeModel.key, modelId: runtimeModel.modelId,
      modality: 'video', planCode: resolvedAccess.currentPlan,
      accessState: resolvedAccess.access.state, operationKey,
      reservationId: reservation?.reservationId ?? null,
    });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : 'CREDIT_RESERVATION_FAILED';
    if (code === 'FREE_VIDEO_TRIAL_EXHAUSTED') {
      await recordFunnelEvent({ userId: user.id, event: 'free_media_exhausted', key: 'video', metadata: { modality: 'video' } });
    }
    if (code === 'MODEL_TRIAL_EXHAUSTED') {
      await recordFunnelEvent({ userId: user.id, event: 'model_trial_exhausted', key: `${runtimeModel.modelId}:${resolvedAccess.currentPlan}`, metadata: { model: runtimeModel.modelId, modality: 'video', plan: resolvedAccess.currentPlan } });
    }
    try {
      await finalizeGeneration({
        executionId: execution.executionId,
        userId: user.id,
        reservationId: reservation?.reservationId ?? null,
        operationKey,
        payloadHash,
        terminalStatus: 'failed',
        customerCharge: 0,
        errorCode: code,
        failureOwner: /INSUFFICIENT_CREDITS|INVALID_/.test(code) ? 'customer' : 'vantra',
        failureCategory: 'pre_execution',
        attemptCount: 0,
      });
    } catch (recordError) {
      console.error('[video-generation] reservation failure record failed', {
        executionId: execution.executionId,
        code: recordError instanceof Error ? recordError.message : 'EXECUTION_FAILURE_RECORD_FAILED',
      });
    }
    return NextResponse.json({ error: safeResponseCode(code), reason: runtimeAccessReasonForError(code) }, { status: responseStatus(code) });
  }

  const startedAt = Date.now();
  let recoveryToken: string | null = null;
  let providerStarted = false;
  let providerOperationId: string | null = null;
  let providerStatus: string | null = null;
  let providerAttemptCount = 0;
  try {
    recoveryToken = await prepareMediaRecovery(execution.executionId, user.id, {
      prompt: input.prompt, duration: input.duration, customerCharge: reservation?.customerCharge ?? 0,
      providerCostMinor: prunaProviderCostMinor(input),
      ...(resolvedAccess.access.state === 'trial' ? { trialPlan: resolvedAccess.currentPlan } : {}),
    });
    await markGenerationStreaming(execution.executionId, user.id, reservation?.reservationId ?? null);
    const attempt = await beginGenerationProviderAttempt({
      executionId: execution.executionId, userId: user.id,
      reservationId: reservation?.reservationId ?? null, route, attemptKey: operationKey,
    });
    providerAttemptCount = attempt?.attemptNumber ?? 0;
    providerStarted = true;
    const submitted = await submitPrunaVideoRoute(route, input);
    providerOperationId = submitted.providerOperationId;
    providerStatus = submitted.rawStatus ?? 'accepted';
    await recordGenerationProviderOperation({
      executionId: execution.executionId,
      userId: user.id,
      providerOperationId,
      rawStatus: submitted.rawStatus,
      attemptId: attempt?.attemptId,
    });
    await checkpointMedia(execution.executionId, user.id, recoveryToken!, {
      provider_operation_id: providerOperationId, provider_status: providerStatus,
      submitted_at: new Date().toISOString(), attempt_count: providerAttemptCount || 1,
      provider: route.providerId, providerModel: route.providerModelId,
      duration: input.duration, resolution: input.resolution, mode: input.mode, sourceMode: input.sourceMode,
      ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
    });
    return NextResponse.json({ executionId: execution.executionId, state: 'processing', retryAfterMs: 5000 }, { status: 202 });
  } catch (cause) {
    const internalCode = cause instanceof MediaProviderError
      ? cause.code
      : cause instanceof Error ? cause.message : 'VIDEO_GENERATION_FAILED';
    // Accepted provider work continues. A recording/transport error must not
    // release its hold as if the prediction itself failed.
    if (providerOperationId && recoveryToken) {
      await checkpointMedia(execution.executionId, user.id, recoveryToken, {
        provider_operation_id: providerOperationId, provider_status: providerStatus ?? 'accepted',
        submitted_at: new Date().toISOString(), attempt_count: providerAttemptCount || 1,
      }).catch(() => console.error('[video-generation] accepted operation recording pending', { executionId: execution.executionId }));
      return NextResponse.json({ executionId: execution.executionId, state: 'processing', retryAfterMs: 5000 }, { status: 202 });
    }
    const providerCancelled = internalCode === 'PROVIDER_CANCELLED';
    const failureOwner = cause instanceof MediaProviderError ? 'provider' as const : 'vantra' as const;
    try {
      if (recoveryToken) await finishPreparedMedia(execution.executionId, user.id, recoveryToken, providerCancelled ? 'provider_cancelled' : 'failed', 'failed', providerCancelled ? 'canceled' : 'failed', internalCode);
      else await finalizeGeneration({
        executionId: execution.executionId,
        userId: user.id,
        reservationId: reservation?.reservationId ?? null,
        operationKey,
        payloadHash,
        terminalStatus: providerCancelled ? 'provider_cancelled' : 'failed',
        customerCharge: 0,
        errorCode: internalCode,
        failureOwner,
        failureCategory: providerStarted ? providerFailureCategory(internalCode, true) : 'vantra_execution',
        actualUsage: { latencyMs: Date.now() - startedAt,
          provider_status: providerStatus,
          reconciliation_flags: providerOperationId && internalCode === 'PROVIDER_RESULT_NOT_READY'
            ? ['accepted_no_result'] : [],
        },
        providerOperationId,
        attemptCount: providerStarted ? providerAttemptCount || 1 : 0,
      });
    } catch (finalizationError) {
      console.error('[video-generation] failure finalization failed', {
        executionId: execution.executionId,
        code: finalizationError instanceof Error ? finalizationError.message : 'EXECUTION_FINALIZATION_FAILED',
      });
    }
    if (failureOwner === 'provider') {
      await recordProviderResult(route.providerId, false, internalCode);
    }
    if (!recoveryToken && await confirmedMediaRelease(execution.executionId, user.id).catch(() => false)) {
      await finalizeModelTrialAccess({ userId: user.id, operationKey, outcome: 'released' });
    }
    return NextResponse.json(
      { error: safeResponseCode(internalCode), executionId: execution.executionId, creditsReleased: await confirmedMediaRelease(execution.executionId, user.id).catch(() => false) },
      { status: responseStatus(internalCode) }
    );
  }
}
