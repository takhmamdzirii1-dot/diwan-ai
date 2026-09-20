import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { validateMaiImageRequest, ImageRequestError } from '@/lib/ai/mai-image-request';
import { generateWithMicrosoftFoundryRoute, MediaProviderError } from '@/lib/ai/providers/media';
import { resolveProviderRoutes } from '@/lib/ai/providers/routes';
import { requireEntitledRuntimeModel } from '@/lib/models/plan-entitlements.server';
import { modelPlanErrorPayload } from '@/lib/models/plan-entitlements';
import type { ImageModelCapabilities } from '@/lib/models/capabilities';
import {
  beginGenerationExecution,
  finalizeGeneration,
  hashGenerationPayload,
  markGenerationStreaming,
  recordProviderResult,
  reserveGenerationCredits,
  resolveOperationKey,
} from '@/lib/credits/generation-finance';
import { resolveTerminalCustomerCharge } from '@/lib/credits/generation-policy';
import { persistGeneratedMedia } from '@/lib/ai/library-media';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function safeResponseCode(code: string) {
  if (/INSUFFICIENT_CREDITS/.test(code)) return 'INSUFFICIENT_CREDITS';
  if (/FREE_IMAGE_TRIAL_EXHAUSTED|PAID_MEDIA_ACCESS_REQUIRED/.test(code)) return code;
  if (/MODEL_CUSTOMER_PRICE_UNCONFIGURED/.test(code)) return 'MODEL_CUSTOMER_PRICE_UNCONFIGURED';
  if (/MODEL_|INVALID_|UNSUPPORTED_/.test(code)) return code;
  if (/NO_CONFIGURED_PROVIDER_ROUTE|PROVIDER_NOT_CONFIGURED/.test(code)) return 'IMAGE_GENERATION_UNAVAILABLE';
  return 'IMAGE_GENERATION_FAILED';
}
function responseStatus(code: string) {
  if (/INSUFFICIENT_CREDITS|FREE_IMAGE_TRIAL_EXHAUSTED|PAID_MEDIA_ACCESS_REQUIRED/.test(code)) return 402;
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
  if (Number(request.headers.get('content-length') ?? 0) > 32_000) {
    return NextResponse.json({ error: 'REQUEST_TOO_LARGE' }, { status: 413 });
  }

  const body = await request.json().catch(() => null);
  if (!body || JSON.stringify(body).length > 32_000) {
    return NextResponse.json({ error: 'INVALID_IMAGE_REQUEST' }, { status: 400 });
  }

  let runtimeModel;
  try {
    const requestedModel = typeof body.modelId === 'string' ? body.modelId.trim() : '';
    runtimeModel = await requireEntitledRuntimeModel(user.id, requestedModel, 'image');
  } catch (cause) {
    const accessError = modelPlanErrorPayload(cause);
    if (accessError) return NextResponse.json(accessError, { status: 403 });
    const code = cause instanceof Error ? cause.message : 'MODEL_RUNTIME_CONFIG_UNAVAILABLE';
    return NextResponse.json({ error: safeResponseCode(code) }, { status: responseStatus(code) });
  }

  let input;
  try {
    input = validateMaiImageRequest(body, runtimeModel.capabilities as ImageModelCapabilities);
  } catch (cause) {
    const code = cause instanceof ImageRequestError ? cause.code : 'INVALID_IMAGE_REQUEST';
    return NextResponse.json({ error: code }, { status: 400 });
  }

  let route;
  try {
    const routes = await resolveProviderRoutes(runtimeModel);
    route = routes.find((candidate) => candidate.providerId === 'microsoft_foundry');
    if (!route) throw new Error('NO_CONFIGURED_PROVIDER_ROUTE');
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : 'NO_CONFIGURED_PROVIDER_ROUTE';
    return NextResponse.json({ error: safeResponseCode(code) }, { status: responseStatus(code) });
  }

  let operationKey: string;
  try {
    operationKey = resolveOperationKey(input.operationId ?? request.headers.get('x-idempotency-key'));
  } catch {
    return NextResponse.json({ error: 'INVALID_IDEMPOTENCY_KEY' }, { status: 400 });
  }
  const payloadHash = hashGenerationPayload({
    modelKey: runtimeModel.key,
    prompt: input.prompt,
    aspectRatio: input.aspectRatio,
    width: input.width,
    height: input.height,
    outputCount: input.outputCount,
  });

  let execution;
  try {
    execution = await beginGenerationExecution({
      userId: user.id,
      operationKey,
      payloadHash,
      model: runtimeModel,
      route,
    });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : 'EXECUTION_GUARD_FAILED';
    return NextResponse.json({ error: safeResponseCode(code) }, { status: responseStatus(code) });
  }
  if (execution.idempotent) {
    return NextResponse.json({ error: 'REQUEST_ALREADY_PROCESSED' }, { status: 409 });
  }

  let reservation: Awaited<ReturnType<typeof reserveGenerationCredits>> = null;
  try {
    reservation = await reserveGenerationCredits({
      userId: user.id,
      operationKey,
      payloadHash,
      model: runtimeModel,
      route,
    });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : 'CREDIT_RESERVATION_FAILED';
    try {
      await finalizeGeneration({
        executionId: execution.executionId,
        userId: user.id,
        reservationId: null,
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
      console.error('[image-generation] reservation failure record failed', {
        executionId: execution.executionId,
        code: recordError instanceof Error ? recordError.message : 'EXECUTION_FAILURE_RECORD_FAILED',
      });
    }
    return NextResponse.json({ error: safeResponseCode(code) }, { status: responseStatus(code) });
  }

  const startedAt = Date.now();
  let providerStarted = false;
  try {
    await markGenerationStreaming(
      execution.executionId,
      user.id,
      reservation?.reservationId ?? null
    );
    providerStarted = true;
    const result = await generateWithMicrosoftFoundryRoute(route, {
      prompt: input.prompt,
      width: input.width,
      height: input.height,
    });
    if (result.state !== 'completed' || (!result.mediaBase64 && !result.mediaUrl)) {
      throw new MediaProviderError('PROVIDER_INVALID_RESPONSE', true);
    }

    const libraryAsset = await persistGeneratedMedia({
      executionId: execution.executionId,
      userId: user.id,
      modality: 'image',
      modelId: runtimeModel.modelId,
      prompt: input.prompt,
      mimeType: result.mimeType ?? 'image/png',
      mediaBase64: result.mediaBase64,
      mediaUrl: result.mediaUrl,
      width: input.width,
      height: input.height,
    });

    const latencyMs = Date.now() - startedAt;
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
      finishReason: 'image_generated',
      actualUsage: {
        provider: route.providerId,
        providerModel: route.providerModelId,
        width: input.width,
        height: input.height,
        aspectRatio: input.aspectRatio,
        outputCount: 1,
        latencyMs,
        delivery: result.delivery,
      },
      providerOperationId: result.providerOperationId,
      attemptCount: 1,
    };
    let financialResult;
    try {
      financialResult = await finalizeGeneration(finalizeArgs);
    } catch {
      // The terminal RPC is idempotent. One same-payload retry resolves an
      // ambiguous transport failure without charging twice.
      financialResult = await finalizeGeneration(finalizeArgs);
    }
    if (financialResult.state !== 'completed') throw new Error('EXECUTION_FINALIZATION_FAILED');
    await recordProviderResult(route.providerId, true);

    return NextResponse.json({
      image: { src: libraryAsset.src, mimeType: libraryAsset.mimeType },
      libraryAssetId: libraryAsset.id,
      creditsCharged: Number(financialResult.credits_charged ?? customerCharge),
    });
  } catch (cause) {
    const internalCode = cause instanceof MediaProviderError
      ? cause.code
      : cause instanceof Error ? cause.message : 'IMAGE_GENERATION_FAILED';
    const failureOwner = cause instanceof MediaProviderError ? 'provider' as const : 'vantra' as const;
    try {
      await finalizeGeneration({
        executionId: execution.executionId,
        userId: user.id,
        reservationId: reservation?.reservationId ?? null,
        operationKey,
        payloadHash,
        terminalStatus: 'failed',
        customerCharge: 0,
        errorCode: internalCode,
        failureOwner,
        failureCategory: providerStarted ? 'provider_execution' : 'vantra_execution',
        actualUsage: { latencyMs: Date.now() - startedAt },
        attemptCount: providerStarted ? 1 : 0,
      });
    } catch (finalizationError) {
      console.error('[image-generation] failure finalization failed', {
        executionId: execution.executionId,
        code: finalizationError instanceof Error ? finalizationError.message : 'EXECUTION_FINALIZATION_FAILED',
      });
    }
    if (failureOwner === 'provider') {
      await recordProviderResult(route.providerId, false, internalCode);
    }
    return NextResponse.json(
      { error: safeResponseCode(internalCode) },
      { status: responseStatus(internalCode) }
    );
  }
}
