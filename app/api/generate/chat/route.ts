import { NextResponse } from 'next/server';
import { createClient } from '../../../../src/lib/supabase/server';
import { streamText } from 'ai';

import { DEFAULT_CHAT_MODEL } from '../../../../src/config/studio-registry';
import { requireEffectiveRuntimeModel } from '../../../../lib/models/runtime-config';
import { createChatLanguageModel, classifyProviderFailure } from '@/lib/ai/providers/chat';
import { resolveProviderRoutes } from '@/lib/ai/providers/routes';
import {
  beginGenerationExecution,
  hashGenerationPayload,
  markGenerationStreaming,
  recordProviderResult,
  releaseGeneration,
  reserveGenerationCredits,
  resolveOperationKey,
  settleGeneration,
} from '@/lib/credits/generation-finance';

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
      runtimeModel = await requireEffectiveRuntimeModel(requestedModel, 'chat');
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'MODEL_RUNTIME_CONFIG_UNAVAILABLE';
      const status = code === 'MODEL_NOT_REGISTERED' ? 400
        : code === 'MODEL_RUNTIME_CONFIG_UNAVAILABLE' ? 503 : 409;
      return NextResponse.json({ error: code }, { status });
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
        await releaseGeneration({
          executionId: execution.executionId,
          userId: user.id,
          reservationId: null,
          operationKey,
          payloadHash,
          reason: code,
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
    try {
      const result = await streamText({
        model: languageModel,
        messages: messagesPayload,
        temperature,
        maxTokens,
        topP,
        onFinish: async ({ finishReason, usage }) => {
          try {
            if (finishReason === 'error') {
              await releaseGeneration({
                executionId: execution.executionId,
                userId: user.id,
                reservationId: reservation?.reservationId ?? null,
                operationKey,
                payloadHash,
                reason: 'PROVIDER_STREAM_FAILED',
              });
              await recordProviderResult(route.providerId, false, 'PROVIDER_STREAM_FAILED');
              return;
            }
            await settleGeneration({
              executionId: execution.executionId,
              userId: user.id,
              reservationId: reservation?.reservationId ?? null,
              operationKey,
              payloadHash,
              amount: cost,
              finishReason,
              usage: {
                provider: route.providerId,
                providerModel: route.providerModelId,
                promptTokens: usage.promptTokens,
                completionTokens: usage.completionTokens,
                totalTokens: usage.totalTokens,
              },
            });
            await recordProviderResult(route.providerId, true);
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
      await markGenerationStreaming(
        execution.executionId,
        user.id,
        reservation?.reservationId ?? null
      );
      return result.toDataStreamResponse({
        headers: {
          'x-vantra-operation-id': operationKey,
          'x-vantra-provider': route.providerId,
        },
      });
    } catch (providerError) {
      const failure = classifyProviderFailure(providerError);
      try {
        await releaseGeneration({
          executionId: execution.executionId,
          userId: user.id,
          reservationId: reservation?.reservationId ?? null,
          operationKey,
          payloadHash,
          reason: failure.code,
        });
        await recordProviderResult(route.providerId, false, failure.code);
      } catch (rollbackError) {
        console.error('[chat-generation] rollback failed', {
          executionId: execution.executionId,
          code: rollbackError instanceof Error ? rollbackError.message : 'ROLLBACK_FAILED',
        });
      }
      return NextResponse.json({ error: failure.code }, { status: failure.retryable ? 503 : 502 });
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
