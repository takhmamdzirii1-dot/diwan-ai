import { after, NextResponse } from 'next/server';
import { createClient } from '../../../../src/lib/supabase/server';
import { streamText } from 'ai';

import { DEFAULT_CHAT_MODEL } from '../../../../src/config/studio-registry';
import { requireEntitledRuntimeModel } from '@/lib/models/plan-entitlements.server';
import { modelPlanErrorPayload } from '@/lib/models/plan-entitlements';
import { createChatLanguageModel, classifyProviderFailure } from '@/lib/ai/providers/chat';
import { resolveProviderRoutes } from '@/lib/ai/providers/routes';
import {
  beginGenerationExecution,
  finalizeGeneration,
  hashGenerationPayload,
  markGenerationStreaming,
  recordProviderResult,
  reserveGenerationCredits,
  resolveOperationKey,
} from '@/lib/credits/generation-finance';
import {
  failureStateForInterruptedStream,
  resolveTerminalCustomerCharge,
  type GenerationFailureOwner,
  type GenerationTerminalState,
} from '@/lib/credits/generation-policy';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Authentication. Billing and execution ownership are user-bound.
    let user = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data } = await supabase.auth.getUser(token);
      user = data.user;
    } else {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }
    if (!user) {
      return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
    }

    // 2. Parse Request Body
    if (Number(request.headers.get('content-length') ?? 0) > 500_000) {
      return NextResponse.json({ error: 'REQUEST_TOO_LARGE' }, { status: 413 });
    }
    const body = await request.json().catch(() => ({}));
    if (JSON.stringify(body).length > 500_000) {
      return NextResponse.json({ error: 'REQUEST_TOO_LARGE' }, { status: 413 });
    }

    const { prompt, model = DEFAULT_CHAT_MODEL?.id, messages } = body;

    // Generation controls (clamped for safety)
    const clamp = (v: unknown, min: number, max: number, fallback: number) => {
      const n = typeof v === 'number' && Number.isFinite(v) ? v : Number(v);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(max, Math.max(min, n));
    };
    const temperature = clamp(body.temperature, 0, 2, 0.7);
    const maxTokens = Math.round(clamp(body.max_tokens, 64, 8192, 2048));
    const topP = clamp(body.top_p, 0.05, 1, 0.95);
    const customSystem =
      typeof body.system === 'string' && body.system.trim()
        ? body.system.trim().slice(0, 2000)
        : null;

    const DEFAULT_SYSTEM =
      'You are VANTRA, an elite AI assistant on the premier unified AI gateway for Algeria. Provide well-structured, insightful answers with clean markdown. You are fully fluent in English, French, and Algerian Darja.';

    // Dynamic temporal context — the LLM has no clock of its own
    const now = new Date();
    const DATETIME_CONTEXT = `You are VANTRA, a premium AI assistant. Today's date is ${now.toLocaleDateString()} and the current time is ${now.toLocaleTimeString()}. Always answer concisely.`;

    const SYSTEM_PROMPT = `${customSystem || DEFAULT_SYSTEM}\n\n${DATETIME_CONTEXT}`;

    let messagesPayload = messages;
    if (Array.isArray(messagesPayload) && (
      messagesPayload.length > 64
      || messagesPayload.some((message) => JSON.stringify(message?.content ?? '').length > 80_000)
    )) {
      return NextResponse.json({ error: 'INVALID_MESSAGES' }, { status: 400 });
    }
    if (!messagesPayload || !Array.isArray(messagesPayload) || messagesPayload.length === 0) {
       if (prompt) {
          messagesPayload = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt }
          ];
       } else {
         return NextResponse.json(
          { error: 'Messages or prompt is required' },
          { status: 400 }
         );
       }
    } else {
       // Ensure there's a system prompt if it's a new conversation
       if (messagesPayload[0].role !== 'system') {
          messagesPayload = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messagesPayload
          ];
       } else {
          messagesPayload = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messagesPayload.slice(1)
          ];
       }
    }

    const requestedModel = typeof model === 'string' ? model.trim() : '';
    if (!requestedModel) {
      return NextResponse.json({ error: 'A registered model is required' }, { status: 400 });
    }
    let runtimeModel;
    try {
      runtimeModel = await requireEntitledRuntimeModel(user.id, requestedModel, 'chat');
    } catch (cause) {
      const accessError = modelPlanErrorPayload(cause);
      if (accessError) return NextResponse.json(accessError, { status: 403 });
      const code = cause instanceof Error ? cause.message : 'MODEL_RUNTIME_CONFIG_UNAVAILABLE';
      const status = code === 'MODEL_NOT_REGISTERED' ? 400
        : /MODEL_RUNTIME_CONFIG_UNAVAILABLE|PLAN_ENTITLEMENT_UNAVAILABLE/.test(code) ? 503 : 409;
      return NextResponse.json({ error: code }, { status });
    }
    const chatCapabilities = runtimeModel.capabilities;
    if (!('streaming' in chatCapabilities) || !chatCapabilities.streaming) {
      return NextResponse.json({ error: 'MODEL_CAPABILITY_UNSUPPORTED' }, { status: 409 });
    }
    const unsupportedAttachment = messagesPayload.some((message) => {
      const attachments = message?.experimental_attachments;
      if (attachments == null) return false;
      if (!Array.isArray(attachments)) return true;
      return attachments.some((attachment) => {
        const contentType = attachment?.contentType;
        if (typeof contentType !== 'string') return true;
        return contentType.startsWith('image/')
          ? !chatCapabilities.visionInput
          : !chatCapabilities.fileInput;
      });
    });
    if (unsupportedAttachment) {
      return NextResponse.json({ error: 'MODEL_CAPABILITY_UNSUPPORTED' }, { status: 409 });
    }
    const cost = runtimeModel.customerCreditPrice;
    if (cost == null) {
      return NextResponse.json({ error: 'MODEL_CUSTOMER_PRICE_UNCONFIGURED' }, { status: 409 });
    }
    const routes = await resolveProviderRoutes(runtimeModel);
    let route = routes[0];
    let languageModel;
    for (const candidate of routes) {
      try {
        languageModel = createChatLanguageModel(candidate);
        route = candidate;
        break;
      } catch {
        // Adapter construction performs no provider request, so trying the next
        // same-model route is safe before credits are reserved.
      }
    }
    if (!languageModel) {
      return NextResponse.json({ error: 'NO_CONFIGURED_PROVIDER_ROUTE' }, { status: 503 });
    }

    const operationKey = resolveOperationKey(
      body.operationId ?? request.headers.get('x-idempotency-key')
    );
    const payloadHash = hashGenerationPayload({
      modelKey: runtimeModel.key,
      messages: messagesPayload,
      temperature,
      maxTokens,
      topP,
    });
    const execution = await beginGenerationExecution({
      userId: user.id,
      operationKey,
      payloadHash,
      model: runtimeModel,
      route,
    });
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
    } catch (reservationError) {
      const code = reservationError instanceof Error
        ? reservationError.message
        : 'CREDIT_RESERVATION_FAILED';
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
        console.error('[chat-generation] reservation failure record failed', {
          executionId: execution.executionId,
          code: recordError instanceof Error ? recordError.message : 'EXECUTION_FAILURE_RECORD_FAILED',
        });
      }
      const status = /INSUFFICIENT_CREDITS/.test(code) ? 402
        : /IDEMPOTENCY_CONFLICT|INVALID_/.test(code) ? 400 : 503;
      return NextResponse.json({ error: code }, { status });
    }

    let outputStarted = false;
    let providerStarted = false;
    let finalizationPromise: Promise<void> | null = null;
    const finalizeOnce = (details: {
      terminalStatus: GenerationTerminalState;
      finishReason?: string | null;
      errorCode?: string | null;
      failureOwner?: GenerationFailureOwner;
      failureCategory?: string | null;
      usage?: Record<string, unknown>;
      authoritativeConsumedCredits?: number | null;
    }) => {
      if (finalizationPromise) return finalizationPromise;
      const customerCharge = resolveTerminalCustomerCharge({
        state: details.terminalStatus,
        configuredCharge: cost,
        authoritativeConsumedCredits: details.authoritativeConsumedCredits,
      });
      finalizationPromise = (async () => {
        await finalizeGeneration({
          executionId: execution.executionId,
          userId: user.id,
          reservationId: reservation?.reservationId ?? null,
          operationKey,
          payloadHash,
          terminalStatus: details.terminalStatus,
          customerCharge,
          usageAuthoritative: details.authoritativeConsumedCredits != null,
          finishReason: details.finishReason,
          errorCode: details.errorCode,
          failureOwner: details.failureOwner,
          failureCategory: details.failureCategory,
          actualUsage: {
            provider: route.providerId,
            providerModel: route.providerModelId,
            ...(details.usage ?? {}),
          },
          attemptCount: providerStarted ? 1 : 0,
        });
        if (details.terminalStatus === 'completed') {
          await recordProviderResult(route.providerId, true);
        } else if (details.failureOwner === 'provider') {
          await recordProviderResult(
            route.providerId,
            false,
            details.errorCode ?? details.terminalStatus
          );
        }
      })();
      return finalizationPromise;
    };

    // Next keeps this callback alive after a streamed response closes or is
    // aborted. It is the refund-first safety net when the SDK never emits a
    // terminal onFinish callback.
    after(async () => {
      try {
        if (finalizationPromise) {
          await finalizationPromise;
          return;
        }
        const cancelled = request.signal.aborted;
        await finalizeOnce({
          terminalStatus: cancelled
            ? 'user_cancelled'
            : failureStateForInterruptedStream(outputStarted),
          errorCode: cancelled ? 'USER_CANCELLED' : 'STREAM_TERMINATED_WITHOUT_FINISH',
          failureOwner: cancelled ? 'customer' : 'provider',
          failureCategory: cancelled ? 'user_cancel' : 'stream_interrupted',
        });
      } catch (finalizationError) {
        console.error('[chat-generation] deferred finalization failed', {
          executionId: execution.executionId,
          code: finalizationError instanceof Error
            ? finalizationError.message
            : 'FINALIZATION_FAILED',
        });
      }
    });

    try {
      if (request.signal.aborted) {
        await finalizeOnce({
          terminalStatus: 'user_cancelled',
          errorCode: 'USER_CANCELLED_BEFORE_EXECUTION',
          failureOwner: 'customer',
          failureCategory: 'pre_execution_cancel',
        });
        return NextResponse.json({ error: 'REQUEST_CANCELLED' }, { status: 499 });
      }
      await markGenerationStreaming(
        execution.executionId,
        user.id,
        reservation?.reservationId ?? null
      );
      providerStarted = true;
      const result = await streamText({
        model: languageModel,
        messages: messagesPayload,
        temperature,
        maxTokens,
        topP,
        maxRetries: 0,
        abortSignal: request.signal,
        onChunk: ({ chunk }) => {
          if (chunk.type === 'text-delta' && chunk.textDelta.length > 0) outputStarted = true;
        },
        onFinish: async ({ finishReason, usage }) => {
          try {
            if (request.signal.aborted) {
              await finalizeOnce({
                terminalStatus: 'user_cancelled',
                finishReason,
                errorCode: 'USER_CANCELLED',
                failureOwner: 'customer',
                failureCategory: 'user_cancel',
                usage: {
                  promptTokens: usage.promptTokens,
                  completionTokens: usage.completionTokens,
                  totalTokens: usage.totalTokens,
                },
              });
              return;
            }
            const failed = finishReason === 'error' || !outputStarted;
            await finalizeOnce({
              terminalStatus: failed
                ? failureStateForInterruptedStream(outputStarted)
                : 'completed',
              finishReason,
              usage: {
                promptTokens: usage.promptTokens,
                completionTokens: usage.completionTokens,
                totalTokens: usage.totalTokens,
              },
              errorCode: failed ? 'PROVIDER_STREAM_FAILED' : null,
              failureOwner: failed ? 'provider' : null,
              failureCategory: failed ? 'stream_failure' : null,
            });
          } catch (finalizationError) {
            console.error('[chat-generation] finalization failed', {
              executionId: execution.executionId,
              code: finalizationError instanceof Error
                ? finalizationError.message
                : 'FINALIZATION_FAILED',
            });
          }
        },
      });
      return result.toDataStreamResponse({
        headers: {
          'x-vantra-operation-id': operationKey,
        },
      });
    } catch (providerError) {
      const failure = classifyProviderFailure(providerError);
      try {
        await finalizeOnce({
          terminalStatus: request.signal.aborted
            ? 'user_cancelled'
            : failureStateForInterruptedStream(outputStarted),
          errorCode: request.signal.aborted ? 'USER_CANCELLED' : failure.code,
          failureOwner: request.signal.aborted
            ? 'customer'
            : providerStarted ? 'provider' : 'vantra',
          failureCategory: providerStarted ? 'provider_execution' : 'pre_execution',
        });
      } catch (rollbackError) {
        console.error('[chat-generation] rollback failed', {
          executionId: execution.executionId,
          code: rollbackError instanceof Error ? rollbackError.message : 'ROLLBACK_FAILED',
        });
      }
      return NextResponse.json(
        { error: failure.code },
        {
          status: failure.retryable ? 503 : 502,
          headers: failure.retryAfterSeconds == null
            ? undefined
            : { 'Retry-After': String(failure.retryAfterSeconds) },
        }
      );
    }

  } catch (error: any) {
    const code = error?.message || 'INTERNAL_SERVER_ERROR';
    const status = /INSUFFICIENT_CREDITS/.test(code) ? 402
      : /RATE_LIMITED|CONCURRENCY_LIMITED/.test(code) ? 429
        : /INVALID_|IDEMPOTENCY_CONFLICT/.test(code) ? 400
          : /UNAVAILABLE|NO_CONFIGURED_PROVIDER_ROUTE/.test(code) ? 503 : 500;
    return NextResponse.json(
      { error: code },
      { status }
    );
  }
}
