import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import type { EffectiveRuntimeModel } from '@/lib/models/runtime-config';
import type { ResolvedProviderRoute } from '@/lib/ai/providers/routes';
import { routeSnapshot } from '@/lib/ai/providers/routes';
import type {
  GenerationFailureOwner,
  GenerationTerminalState,
} from './generation-policy';

type RpcJson = Record<string, unknown>;

function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function hashGenerationPayload(payload: unknown) {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

export function resolveOperationKey(value: unknown) {
  if (value == null || value === '') return randomUUID();
  if (typeof value !== 'string' || !/^[A-Za-z0-9:_-]{8,200}$/.test(value)) {
    throw new Error('INVALID_IDEMPOTENCY_KEY');
  }
  return value;
}

function adminClient() {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('FINANCIAL_ENGINE_UNAVAILABLE');
  return client;
}

export async function beginGenerationExecution(args: {
  userId: string;
  operationKey: string;
  payloadHash: string;
  model: EffectiveRuntimeModel;
  route: ResolvedProviderRoute;
}) {
  const { data, error } = await adminClient().rpc('begin_ai_execution', {
    p_user_id: args.userId,
    p_operation_key: args.operationKey,
    p_payload_hash: args.payloadHash,
    p_modality: args.model.modality,
    p_model_key: args.model.key,
    p_model_id: args.model.modelId,
    p_route_id: args.route.id,
    p_provider_id: args.route.providerId,
    p_provider_model_id: args.route.providerModelId,
  });
  if (error) throw new Error(error.message || 'EXECUTION_GUARD_FAILED');
  const result = data as RpcJson;
  return {
    executionId: String(result.execution_id),
    state: String(result.state),
    idempotent: Boolean(result.idempotent),
  };
}

export async function reserveGenerationCredits(args: {
  userId: string;
  operationKey: string;
  payloadHash: string;
  model: EffectiveRuntimeModel;
  route: ResolvedProviderRoute;
}) {
  const amount = args.model.customerCreditPrice;
  if (amount == null) throw new Error('MODEL_CUSTOMER_PRICE_UNCONFIGURED');
  if (amount === 0) return null;
  const pricingVersion = args.model.updatedAt ?? 'registry-v1';
  const { data, error } = await adminClient().rpc('reserve_credits', {
    p_user_id: args.userId,
    p_operation_key: args.operationKey,
    p_payload_hash: args.payloadHash,
    p_modality: args.model.modality,
    p_model_id: args.model.modelId,
    p_amount: amount,
    p_pricing_version: pricingVersion,
    p_pricing_snapshot: {
      modelKey: args.model.key,
      customerCreditPrice: amount,
      pricingVersion,
    },
    p_route_snapshot: routeSnapshot(args.route),
    p_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  });
  if (error) throw new Error(error.message || 'CREDIT_RESERVATION_FAILED');
  const result = data as RpcJson;
  return {
    reservationId: String(result.reservation_id),
    idempotent: Boolean(result.idempotent),
  };
}

export async function markGenerationStreaming(
  executionId: string,
  userId: string,
  reservationId: string | null
) {
  const { error } = await adminClient().rpc('mark_ai_execution_streaming', {
    p_execution_id: executionId,
    p_user_id: userId,
    p_reservation_id: reservationId,
  });
  if (error) throw new Error(error.message || 'EXECUTION_TRANSITION_FAILED');
}

export async function settleGeneration(args: {
  executionId: string;
  userId: string;
  reservationId: string | null;
  operationKey: string;
  payloadHash: string;
  amount: number;
  finishReason: string;
  usage: Record<string, unknown>;
}) {
  if (args.reservationId) {
    const { error } = await adminClient().rpc('settle_credits', {
      p_user_id: args.userId,
      p_reservation_id: args.reservationId,
      p_operation_key: args.operationKey,
      p_payload_hash: args.payloadHash,
      p_actual_amount: args.amount,
      p_usage_metadata: args.usage,
    });
    if (error) throw new Error(error.message || 'CREDIT_SETTLEMENT_FAILED');
  }
  const { error } = await adminClient().rpc('complete_ai_execution', {
    p_execution_id: args.executionId,
    p_user_id: args.userId,
    p_credits_charged: args.amount,
    p_finish_reason: args.finishReason,
    p_execution_metadata: args.usage,
  });
  if (error) throw new Error(error.message || 'EXECUTION_COMPLETION_FAILED');
}

export async function releaseGeneration(args: {
  executionId: string;
  userId: string;
  reservationId: string | null;
  operationKey: string;
  payloadHash: string;
  reason: string;
}) {
  if (args.reservationId) {
    const { error } = await adminClient().rpc('release_credits', {
      p_user_id: args.userId,
      p_reservation_id: args.reservationId,
      p_operation_key: args.operationKey,
      p_payload_hash: args.payloadHash,
      p_reason: args.reason,
    });
    if (error && !/ALREADY_FINALIZED/i.test(error.message)) {
      throw new Error(error.message || 'CREDIT_RELEASE_FAILED');
    }
  }
  const { error } = await adminClient().rpc('fail_ai_execution', {
    p_execution_id: args.executionId,
    p_user_id: args.userId,
    p_error_code: args.reason,
  });
  if (error && !/INVALID_EXECUTION_TRANSITION/i.test(error.message)) {
    throw new Error(error.message || 'EXECUTION_FAILURE_RECORD_FAILED');
  }
}

/**
 * Atomic terminal path for all new generation finalization. The database RPC
 * reuses reserve_credits, settle_credits and release_credits in one transaction.
 * Legacy helpers above remain temporarily available for migration compatibility.
 */
export async function finalizeGeneration(args: {
  executionId: string;
  userId: string;
  reservationId: string | null;
  operationKey: string;
  payloadHash: string;
  terminalStatus: GenerationTerminalState;
  customerCharge: number;
  usageAuthoritative?: boolean;
  finishReason?: string | null;
  errorCode?: string | null;
  failureOwner?: GenerationFailureOwner;
  failureCategory?: string | null;
  actualUsage?: Record<string, unknown>;
  providerCostMinor?: number | null;
  providerCostCurrency?: string | null;
  providerOperationId?: string | null;
  attemptCount?: number;
}) {
  const { data, error } = await adminClient().rpc('finalize_ai_execution_terminal', {
    p_execution_id: args.executionId,
    p_user_id: args.userId,
    p_reservation_id: args.reservationId,
    p_operation_key: args.operationKey,
    p_payload_hash: args.payloadHash,
    p_terminal_status: args.terminalStatus,
    p_customer_charge: args.customerCharge,
    p_usage_authoritative: args.usageAuthoritative ?? false,
    p_finish_reason: args.finishReason ?? null,
    p_error_code: args.errorCode ?? null,
    p_failure_owner: args.failureOwner ?? null,
    p_failure_category: args.failureCategory ?? null,
    p_actual_usage: args.actualUsage ?? {},
    p_provider_cost_minor: args.providerCostMinor ?? null,
    p_provider_cost_currency: args.providerCostCurrency ?? null,
    p_provider_operation_id: args.providerOperationId ?? null,
    p_attempt_count: args.attemptCount ?? 1,
  });
  if (error) throw new Error(error.message || 'EXECUTION_FINALIZATION_FAILED');
  return data as RpcJson;
}

export async function recordProviderResult(
  providerId: string,
  succeeded: boolean,
  errorCode?: string
) {
  const { error } = await adminClient().rpc('record_provider_runtime_result', {
    p_provider_id: providerId,
    p_succeeded: succeeded,
    p_error_code: errorCode ?? null,
  });
  if (error) {
    console.error('[provider-runtime] telemetry update failed', {
      providerId,
      code: error.code,
    });
  }
}
