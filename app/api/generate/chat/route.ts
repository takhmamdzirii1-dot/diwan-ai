import { after, NextResponse } from 'next/server';
import { createClient } from '../../../../src/lib/supabase/server';
import { streamText } from 'ai';

import { DEFAULT_CHAT_MODEL } from '../../../../src/config/studio-registry';
import { resolveRuntimeModelAccess } from '@/lib/models/plan-entitlements.server';
import { modelPlanErrorPayload } from '@/lib/models/plan-entitlements';
import { effectiveChatWeight, isValidChatWeight } from '@/lib/chat/chat-usage';
import { finalizeChatUsage, precheckChatUsage, reserveChatUsage } from '@/lib/chat/chat-usage.server';
import { createChatLanguageModel, classifyProviderFailure } from '@/lib/ai/providers/chat';
import { resolveProviderRoutes } from '@/lib/ai/providers/routes';
import { resolveRouteCapabilities } from '@/lib/models/capability-v2';
import { requireStudioGenerationAccess } from '@/lib/access/trial-access';
import { finalizeModelTrialAccess, reserveModelTrialAccess } from '@/lib/models/model-trial.server';
import { recordFunnelEvent } from '@/lib/analytics/funnel-events';
import { runtimeAccessReasonForError } from '@/lib/models/model-access';
import {
  beginGenerationExecution,
  finalizeGeneration,
  hashGenerationPayload,
  markGenerationStreaming,
  recordProviderResult,
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
    try {
      await requireStudioGenerationAccess(user);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'STUDIO_ACCESS_UNAVAILABLE';
      if (code === 'FREE_ACCESS_RESTRICTED' || code === 'PAID_PLAN_REACTIVATION_REQUIRED') {
        return NextResponse.json({ error: code, reason: runtimeAccessReasonForError(code) }, { status: 403 });
      }
      return NextResponse.json({ error: 'STUDIO_ACCESS_UNAVAILABLE' }, { status: 503 });
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
    let resolvedAccess;
    try {
      resolvedAccess = await resolveRuntimeModelAccess(user.id, requestedModel, 'chat');
      runtimeModel = resolvedAccess.model;
    } catch (cause) {
      const accessError = modelPlanErrorPayload(cause);
      if (accessError) return NextResponse.json(accessError, { status: 403 });
      const code = cause instanceof Error ? cause.message : 'MODEL_RUNTIME_CONFIG_UNAVAILABLE';
      const status = code === 'MODEL_NOT_REGISTERED' ? 400
        : /MODEL_RUNTIME_CONFIG_UNAVAILABLE|PLAN_ENTITLEMENT_UNAVAILABLE/.test(code) ? 503 : 409;
      return NextResponse.json({ error: code, reason: runtimeAccessReasonForError(code) }, { status });
    }
    const chatCapabilities = runtimeModel.capabilities;
    // Weighted Chat Usage Engine: chat never touches the VANTRA Credits
    // ledger. The model's customer weight meters rolling 5-hour / weekly
    // allowances instead. A missing weight fails closed (Admin-unconfigured).
    let planCode = resolvedAccess.currentPlan;
    let weight: number;
    try {
      weight = effectiveChatWeight(runtimeModel.customerCreditPrice, runtimeModel.chatBaseClass);
      if (!isValidChatWeight(weight)) throw new Error('CHAT_WEIGHT_UNCONFIGURED');
      const admission = await precheckChatUsage({ userId: user.id, planCode, weight });
      if (!admission.allowed) {
        if (admission.reason === 'limits_unconfigured') {
          return NextResponse.json({ error: 'CHAT_LIMITS_UNCONFIGURED' }, { status: 409 });
        }
        return NextResponse.json({
          error: 'CHAT_LIMIT_REACHED',
          level: admission.level,
          state: admission.state,
          nextAvailableAt: admission.snapshot.nextAvailableAt,
        }, { status: 429 });
      }
    } catch (usageError) {
      const code = usageError instanceof Error ? usageError.message : 'CHAT_USAGE_CHECK_FAILED';
      if (code === 'CHAT_WEIGHT_UNCONFIGURED' || code === 'CHAT_LIMITS_UNCONFIGURED') {
        return NextResponse.json({ error: code }, { status: 409 });
      }
      if (code === 'CHAT_LIMIT_REACHED') {
        return NextResponse.json({ error: code }, { status: 429 });
      }
      throw usageError;
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
        // same-model route is safe before execution begins.
      }
    }
    if (!languageModel) {
      return NextResponse.json({ error: 'NO_CONFIGURED_PROVIDER_ROUTE' }, { status: 503 });
    }
    const native = resolveRouteCapabilities({
      route: { id: route.id, providerId: route.providerId, providerModelId: route.providerModelId },
      stored: runtimeModel.routeCapabilitiesV2,
    }).resolved;
    if (native.streaming.state === 'unsupported'
      || (native.streaming.state === 'unknown' && (!('streaming' in chatCapabilities) || !chatCapabilities.streaming))) {
      return NextResponse.json({ error: 'MODEL_CAPABILITY_UNSUPPORTED', reason: 'Streaming is disabled for this model route.' }, { status: 409 });
    }
    const unsupportedAttachment = messagesPayload.some((message) => {
      const attachments = message?.experimental_attachments;
      if (attachments == null) return false;
      if (!Array.isArray(attachments)) return true;
      return attachments.some((attachment) => {
        const contentType = attachment?.contentType;
        if (typeof contentType !== 'string') return true;
        return contentType.startsWith('image/')
          ? (runtimeModel.routeCapabilitySchemaAvailable ? native.visionInput.state !== 'supported' : !('visionInput' in chatCapabilities && chatCapabilities.visionInput))
          : (runtimeModel.routeCapabilitySchemaAvailable ? native.fileInput.state !== 'supported' : !('fileInput' in chatCapabilities && chatCapabilities.fileInput));
      });
    });
    if (unsupportedAttachment) {
      return NextResponse.json({ error: 'MODEL_CAPABILITY_UNSUPPORTED', reason: 'This model route cannot accept that attachment. Choose a supported model or remove the file.' }, { status: 409 });
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
    // Atomic reservation BEFORE provider dispatch: capacity is held under
    // the per-user lock, so concurrent requests cannot all pass a precheck
    // and overshoot the windows. Same-key retries return the live
    // reservation without reserving twice.
    let chatReserved = false;
    try {
      const reservation = await reserveChatUsage({
        userId: user.id,
        operationKey,
        executionId: execution.executionId,
        modelKey: runtimeModel.key,
        modelId: runtimeModel.modelId,
        planCode,
        weight,
      });
      if (!reservation.allowed) {
        const code = reservation.reason === 'limits_unconfigured'
          ? 'CHAT_LIMITS_UNCONFIGURED'
          : 'CHAT_LIMIT_REACHED';
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
            failureOwner: code === 'CHAT_LIMIT_REACHED' ? 'customer' : 'vantra',
            failureCategory: 'usage_limit',
            attemptCount: 0,
          });
        } catch (recordError) {
          console.error('[chat-generation] limit refusal record failed', {
            executionId: execution.executionId,
            code: recordError instanceof Error ? recordError.message : 'EXECUTION_FAILURE_RECORD_FAILED',
          });
        }
        if (code === 'CHAT_LIMITS_UNCONFIGURED') {
          return NextResponse.json({ error: code }, { status: 409 });
        }
        return NextResponse.json({
          error: code,
          level: reservation.level,
          state: reservation.state,
          nextAvailableAt: reservation.snapshot.nextAvailableAt,
        }, { status: 429 });
      }
      chatReserved = true;
      await reserveModelTrialAccess({
        userId: user.id, modelKey: runtimeModel.key, modelId: runtimeModel.modelId,
        modality: 'chat', planCode: resolvedAccess.currentPlan,
        accessState: resolvedAccess.access.state, operationKey, reservationId: null,
      });
    } catch (reserveError) {
      const code = reserveError instanceof Error ? reserveError.message : 'CHAT_RESERVE_FAILED';
      if (chatReserved) await finalizeChatUsage(operationKey, 'released').catch(() => null);
      await finalizeGeneration({
        executionId: execution.executionId, userId: user.id, reservationId: null,
        operationKey, payloadHash, terminalStatus: 'failed', customerCharge: 0,
        errorCode: code, failureOwner: 'customer', failureCategory: 'model_access', attemptCount: 0,
      }).catch(() => null);
      if (code === 'MODEL_TRIAL_EXHAUSTED') {
        await recordFunnelEvent({ userId: user.id, event: 'model_trial_exhausted', key: `${runtimeModel.modelId}:${resolvedAccess.currentPlan}`, metadata: { model: runtimeModel.modelId, modality: 'chat', plan: resolvedAccess.currentPlan } });
      }
      return NextResponse.json({ error: code, reason: code === 'MODEL_TRIAL_EXHAUSTED' ? 'trial_exhausted' : 'trial_unconfigured' }, { status: /MODEL_TRIAL_/.test(code) ? 403 : 503 });
    }

    let outputStarted = false;
    let providerStarted = false;
    let completedStream = false;
    let usageSettled = false;
    // Settle exactly once per terminal path; the RPC itself is idempotent,
    // so the after() safety net can call this unconditionally.
    const settleChatUsage = async (outcome: 'completed' | 'released') => {
      if (usageSettled) return;
      try {
        await finalizeChatUsage(operationKey, outcome);
        await finalizeModelTrialAccess({ userId: user.id, operationKey, outcome });
        if (outcome === 'completed' && resolvedAccess.access.state === 'trial') {
          await recordFunnelEvent({ userId: user.id, event: 'model_trial_used', key: operationKey, metadata: { model: runtimeModel.modelId, modality: 'chat', plan: resolvedAccess.currentPlan } });
        }
        usageSettled = true;
      } catch (usageError) {
        console.error('[chat-generation] weighted usage settle failed', {
          executionId: execution.executionId,
          operationKey,
          outcome,
          code: usageError instanceof Error ? usageError.message : 'CHAT_USAGE_SETTLE_FAILED',
        });
      }
    };
    let finalizationPromise: Promise<void> | null = null;
    const finalizeOnce = (details: {
      terminalStatus: GenerationTerminalState;
      finishReason?: string | null;
      errorCode?: string | null;
      failureOwner?: GenerationFailureOwner;
      failureCategory?: string | null;
      usage?: Record<string, unknown>;
    }) => {
      if (finalizationPromise) return finalizationPromise;
      // Chat never consumes VANTRA Credits: the terminal customer charge is
      // always zero. Metering happens through weighted usage instead.
      const customerCharge = resolveTerminalCustomerCharge({
        state: details.terminalStatus,
        configuredCharge: 0,
      });
      finalizationPromise = (async () => {
        await finalizeGeneration({
          executionId: execution.executionId,
          userId: user.id,
          reservationId: null,
          operationKey,
          payloadHash,
          terminalStatus: details.terminalStatus,
          customerCharge,
          usageAuthoritative: false,
          finishReason: details.finishReason,
          errorCode: details.errorCode,
          failureOwner: details.failureOwner,
          failureCategory: details.failureCategory,
          actualUsage: {
            provider: route.providerId,
            providerModel: route.providerModelId,
            chatWeight: weight,
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
          await settleChatUsage(completedStream ? 'completed' : 'released');
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
        // Interrupted before any terminal callback: the reservation was
        // never earned, so release it.
        await settleChatUsage('released');
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
        await settleChatUsage('released');
        return NextResponse.json({ error: 'REQUEST_CANCELLED' }, { status: 499 });
      }
      await markGenerationStreaming(
        execution.executionId,
        user.id,
        null
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
            if (!failed) {
              completedStream = true;
            }
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
            // Only successful completions earn the reservation. Provider
            // failures, cancellations, and interrupted streams release it,
            // so held capacity is never consumed without output.
            if (!failed) await settleChatUsage('completed');
            else await settleChatUsage('released');
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
        await settleChatUsage('released');
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
      : /CHAT_LIMIT_REACHED|RATE_LIMITED|CONCURRENCY_LIMITED/.test(code) ? 429
        : /INVALID_|IDEMPOTENCY_CONFLICT/.test(code) ? 400
          : /UNAVAILABLE|NO_CONFIGURED_PROVIDER_ROUTE/.test(code) ? 503 : 500;
    return NextResponse.json(
      { error: code },
      { status }
    );
  }
}
