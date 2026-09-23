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
  waitForPrunaPrediction,
} from '@/lib/ai/providers/media';
import { resolveProviderRoutes } from '@/lib/ai/providers/routes';
import { resolveRuntimeModelAccess } from '@/lib/models/plan-entitlements.server';
import { modelPlanErrorPayload } from '@/lib/models/plan-entitlements';
import type { VideoModelCapabilities } from '@/lib/models/capabilities';
import {
  beginGenerationExecution,
  finalizeGeneration,
  hashGenerationPayload,
  markGenerationStreaming,
  recordGenerationProviderOperation,
  recordProviderResult,
  reserveGenerationCredits,
  resolveOperationKey,
} from '@/lib/credits/generation-finance';
import { resolveTerminalCustomerCharge } from '@/lib/credits/generation-policy';
import { persistGeneratedMedia } from '@/lib/ai/library-media';
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
  if (/INSUFFICIENT_CREDITS/.test(code)) return 'INSUFFICIENT_CREDITS';
  if (/FREE_VIDEO_TRIAL_EXHAUSTED|FREE_MEDIA_EXPIRED|PAID_PLAN_REACTIVATION_REQUIRED|LITE_VIDEO_ALLOWANCE_EXHAUSTED|PAID_MEDIA_ACCESS_REQUIRED|MODEL_TRIAL_EXHAUSTED|MODEL_TRIAL_UNCONFIGURED/.test(code)) {
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
  if (/INSUFFICIENT_CREDITS|FREE_VIDEO_TRIAL_EXHAUSTED|FREE_MEDIA_EXPIRED|PAID_PLAN_REACTIVATION_REQUIRED|LITE_VIDEO_ALLOWANCE_EXHAUSTED|PAID_MEDIA_ACCESS_REQUIRED|MODEL_TRIAL_EXHAUSTED/.test(code)) return 402;
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
    if (code === 'FREE_MEDIA_EXPIRED' || code === 'PAID_PLAN_REACTIVATION_REQUIRED') {
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
    return NextResponse.json({ error: 'FREE_VIDEO_DURATION_LIMIT', reason: 'plan_required' }, { status: 403 });
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
    execution = await beginGenerationExecution({
      userId: user.id, operationKey, payloadHash, model: runtimeModel, route,
    });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : 'EXECUTION_GUARD_FAILED';
    return NextResponse.json({ error: safeResponseCode(code), reason: runtimeAccessReasonForError(code) }, { status: responseStatus(code) });
  }
  if (execution.idempotent) {
    return NextResponse.json({ error: 'REQUEST_ALREADY_PROCESSED' }, { status: 409 });
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
  let providerStarted = false;
  let providerOperationId: string | null = null;
  try {
    await markGenerationStreaming(execution.executionId, user.id, reservation?.reservationId ?? null);
    providerStarted = true;
    const submitted = await submitPrunaVideoRoute(route, input);
    providerOperationId = submitted.providerOperationId;
    await recordGenerationProviderOperation({
      executionId: execution.executionId,
      userId: user.id,
      providerOperationId,
      rawStatus: submitted.rawStatus,
    });
    const result = submitted.state === 'completed'
      ? submitted
      : await waitForPrunaPrediction(providerOperationId, {
        maxAttempts: 12,
        initialDelayMs: 1_000,
        signal: request.signal,
      });
    if (result.state !== 'completed' || !result.mediaUrl) {
      throw new MediaProviderError('PROVIDER_RESULT_NOT_READY', true);
    }

    const libraryAsset = await persistGeneratedMedia({
      executionId: execution.executionId,
      userId: user.id,
      modality: 'video',
      modelId: runtimeModel.modelId,
      prompt: input.prompt,
      mimeType: result.mimeType ?? 'video/mp4',
      mediaUrl: result.mediaUrl,
      duration: input.duration,
    });

    const latencyMs = Date.now() - startedAt;
    const providerCostMinor = prunaProviderCostMinor(input);
    const customerCharge = resolveTerminalCustomerCharge({
      state: 'completed',
      configuredCharge: reservation?.customerCharge ?? runtimeModel.customerCreditPrice!,
    });
    const finalizeArgs = {
      executionId: execution.executionId,
      userId: user.id,
      reservationId: reservation?.reservationId ?? null,
      operationKey,
      payloadHash,
      terminalStatus: 'completed' as const,
      customerCharge,
      finishReason: 'video_generated',
      actualUsage: {
        provider: route.providerId,
        providerModel: route.providerModelId,
        sourceMode: input.sourceMode,
        duration: input.duration,
        resolution: input.resolution,
        ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
        mode: input.mode,
        latencyMs,
        delivery: result.delivery,
        providerPricing: 'pruna-p-video-2-pro-published-2026-09-19',
      },
      providerCostMinor,
      providerCostCurrency: providerCostMinor == null ? null : 'USD',
      providerOperationId,
      attemptCount: 1,
    };
    let financialResult;
    try {
      financialResult = await finalizeGeneration(finalizeArgs);
    } catch {
      financialResult = await finalizeGeneration(finalizeArgs);
    }
    if (financialResult.state !== 'completed') throw new Error('EXECUTION_FINALIZATION_FAILED');
    await finalizeModelTrialAccess({ userId: user.id, operationKey, outcome: 'completed' });
    if (resolvedAccess.access.state === 'trial') {
      await recordFunnelEvent({ userId: user.id, event: 'model_trial_used', key: operationKey, metadata: { model: runtimeModel.modelId, modality: 'video', plan: resolvedAccess.currentPlan } });
    }
    await recordProviderResult(route.providerId, true);
    return NextResponse.json({
      video: { src: libraryAsset.src, mimeType: libraryAsset.mimeType },
      libraryAssetId: libraryAsset.id,
      creditsCharged: Number(financialResult.credits_charged ?? customerCharge),
    });
  } catch (cause) {
    const internalCode = cause instanceof MediaProviderError
      ? cause.code
      : cause instanceof Error ? cause.message : 'VIDEO_GENERATION_FAILED';
    const providerCancelled = internalCode === 'PROVIDER_CANCELLED';
    const failureOwner = cause instanceof MediaProviderError ? 'provider' as const : 'vantra' as const;
    try {
      await finalizeGeneration({
        executionId: execution.executionId,
        userId: user.id,
        reservationId: reservation?.reservationId ?? null,
        operationKey,
        payloadHash,
        terminalStatus: providerCancelled ? 'provider_cancelled' : 'failed',
        customerCharge: 0,
        errorCode: internalCode,
        failureOwner,
        failureCategory: providerStarted ? 'provider_execution' : 'vantra_execution',
        actualUsage: { latencyMs: Date.now() - startedAt },
        providerOperationId,
        attemptCount: providerStarted ? 1 : 0,
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
    await finalizeModelTrialAccess({ userId: user.id, operationKey, outcome: 'released' });
    return NextResponse.json(
      { error: safeResponseCode(internalCode) },
      { status: responseStatus(internalCode) }
    );
  }
}
