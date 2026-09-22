import 'server-only';

import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { resolveCurrentModelPlan } from '@/lib/models/plan-entitlements.server';
import type { ModelPlanCode } from '@/lib/models/plan-entitlements';
import {
  CHAT_WINDOW_5H_MS,
  CHAT_WINDOW_7D_MS,
  chatLevelForPlan,
  chatUsageState,
  evaluateChatWindows,
  isValidChatWeight,
  windowUtilization,
  type ChatLevel,
  type ChatPlanLimits,
  type ChatUsageState,
  type ChatWindowSnapshot,
} from './chat-usage';

export type ChatAdmissionReason = 'ok' | 'already_recorded' | 'limit_reached' | 'limits_unconfigured';

export interface ChatAdmission {
  allowed: boolean;
  duplicate: boolean;
  reason: ChatAdmissionReason;
  planCode: ModelPlanCode;
  level: ChatLevel;
  state: ChatUsageState;
  snapshot: ChatWindowSnapshot;
}

interface WindowSums {
  fiveHourUsed: number;
  weeklyUsed: number;
  oldest5h: string | null;
  oldest7d: string | null;
}

function adminClient() {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('CHAT_USAGE_UNAVAILABLE');
  return client;
}

function toReason(reason: string, duplicate: boolean): ChatAdmissionReason {
  if (duplicate || reason === 'already_recorded') return 'already_recorded';
  if (reason === 'limit_reached') return 'limit_reached';
  if (reason === 'limits_unconfigured' || reason === 'invalid_weight') return 'limits_unconfigured';
  return 'ok';
}

/** Per-plan rolling allowances. Absent table/row = Admin-unconfigured (fail closed), never invented. */
export async function getChatPlanLimits(): Promise<Record<string, ChatPlanLimits>> {
  const { data, error } = await adminClient()
    .from('chat_plan_limits')
    .select('plan_code,five_hour_limit,weekly_limit');
  if (error) throw new Error('CHAT_LIMITS_UNAVAILABLE');
  const limits: Record<string, ChatPlanLimits> = {};
  for (const row of data ?? []) {
    limits[String(row.plan_code)] = {
      fiveHour: row.five_hour_limit == null ? null : Number(row.five_hour_limit),
      weekly: row.weekly_limit == null ? null : Number(row.weekly_limit),
    };
  }
  return limits;
}

function windowSums(rows: { weight: number; created_at: string }[], nowMs: number): WindowSums {
  const fiveHourCutoff = nowMs - CHAT_WINDOW_5H_MS;
  let fiveHourUsed = 0;
  let weeklyUsed = 0;
  let oldest5h: string | null = null;
  let oldest7d: string | null = null;
  for (const row of rows) {
    const at = new Date(row.created_at).getTime();
    if (!Number.isFinite(at) || at > nowMs) continue;
    weeklyUsed += row.weight;
    if (!oldest7d) oldest7d = row.created_at;
    if (at > fiveHourCutoff) {
      fiveHourUsed += row.weight;
      if (!oldest5h) oldest5h = row.created_at;
    }
  }
  return { fiveHourUsed, weeklyUsed, oldest5h, oldest7d };
}

export async function getChatWindowUsage(userId: string, nowMs: number = Date.now()): Promise<WindowSums> {
  const weekAgo = new Date(nowMs - CHAT_WINDOW_7D_MS).toISOString();
  const { data, error } = await adminClient()
    .from('chat_usage_records')
    .select('weight,created_at')
    .eq('user_id', userId)
    .gte('created_at', weekAgo)
    .order('created_at', { ascending: true })
    .limit(10_000);
  if (error) throw new Error('CHAT_USAGE_UNAVAILABLE');
  return windowSums(
    (data ?? []).map((row) => ({ weight: Number(row.weight) || 0, created_at: String(row.created_at) })),
    nowMs
  );
}

function admission(
  planCode: ModelPlanCode,
  limits: ChatPlanLimits | null,
  sums: WindowSums,
  weight: number,
  decision: { allowed: boolean; nextAvailableAt: string | null },
  duplicate: boolean,
  reason: ChatAdmissionReason
): ChatAdmission {
  const util5 = windowUtilization(sums.fiveHourUsed, limits?.fiveHour ?? null);
  const util7 = windowUtilization(sums.weeklyUsed, limits?.weekly ?? null);
  return {
    allowed: decision.allowed,
    duplicate,
    reason,
    planCode,
    level: chatLevelForPlan(planCode),
    state: decision.allowed ? chatUsageState(util5, util7) : 'limit',
    snapshot: {
      fiveHourUsed: sums.fiveHourUsed,
      weeklyUsed: sums.weeklyUsed,
      fiveHourLimit: limits?.fiveHour ?? null,
      weeklyLimit: limits?.weekly ?? null,
      nextAvailableAt: decision.nextAvailableAt,
    },
  };
}

/** Read-only allowance check. Never inserts; the atomic consume RPC re-checks. */
export async function precheckChatUsage(args: {
  userId: string;
  planCode: ModelPlanCode;
  weight: number;
  nowMs?: number;
}): Promise<ChatAdmission> {
  const nowMs = args.nowMs ?? Date.now();
  const limits = (await getChatPlanLimits())[args.planCode] ?? null;
  const sums = await getChatWindowUsage(args.userId, nowMs);
  if (!limits) {
    return admission(args.planCode, null, sums, args.weight,
      { allowed: false, nextAvailableAt: null }, false, 'limits_unconfigured');
  }
  const decision = evaluateChatWindows(sums, limits, args.weight, nowMs);
  return admission(args.planCode, limits, sums, args.weight, {
    allowed: decision.allowed,
    nextAvailableAt: decision.allowed ? null : decision.nextAvailableAt,
  }, false, decision.allowed ? 'ok' : 'limit_reached');
}

type ConsumeArgs = {
  userId: string;
  operationKey: string;
  executionId: string | null;
  modelKey: string;
  modelId: string;
  planCode: ModelPlanCode;
  weight: number;
};

/**
 * Atomic consume. Serialized per user inside Postgres; the same operation
 * key can be replayed safely (retries never double-charge). Call only after
 * a successful provider completion — failures must never reach this path.
 */
export async function consumeChatUsage(args: ConsumeArgs): Promise<ChatAdmission> {
  const { data, error } = await adminClient().rpc('consume_chat_usage', {
    p_user_id: args.userId,
    p_operation_key: args.operationKey,
    p_execution_id: args.executionId,
    p_model_key: args.modelKey,
    p_model_id: args.modelId,
    p_plan_code: args.planCode,
    p_weight: args.weight,
  });
  if (error) throw new Error(error.message || 'CHAT_USAGE_RECORD_FAILED');
  const result = data as {
    allowed?: unknown; duplicate?: unknown; reason?: unknown;
    five_hour_used?: unknown; weekly_used?: unknown;
    five_hour_limit?: unknown; weekly_limit?: unknown;
    next_available_at?: unknown;
  };
  const limits: ChatPlanLimits = {
    fiveHour: result.five_hour_limit == null ? null : Number(result.five_hour_limit),
    weekly: result.weekly_limit == null ? null : Number(result.weekly_limit),
  };
  const sums: WindowSums = {
    fiveHourUsed: Number(result.five_hour_used) || 0,
    weeklyUsed: Number(result.weekly_used) || 0,
    oldest5h: null,
    oldest7d: null,
  };
  const duplicate = result.duplicate === true;
  const nextAvailableAt = result.next_available_at == null ? null : String(result.next_available_at);
  return admission(args.planCode, limits, sums, args.weight, {
    allowed: result.allowed === true,
    nextAvailableAt: result.allowed === true ? null : nextAvailableAt,
  }, duplicate, toReason(String(result.reason ?? ''), duplicate));
}

/** Resolve plan + weight + limits context for a metered chat model. */
export async function resolveChatUsageContext(args: {
  userId: string;
  modelKey: string;
  modelId: string;
  customerCreditPrice: number | null;
}): Promise<{ planCode: ModelPlanCode; weight: number }> {
  const planCode = await resolveCurrentModelPlan(args.userId);
  const weight = args.customerCreditPrice;
  if (!isValidChatWeight(weight)) throw new Error('CHAT_WEIGHT_UNCONFIGURED');
  return { planCode, weight };
}

/** Customer-safe usage state for ambient display. No raw units or limits. */
export async function getChatUsageState(userId: string): Promise<{
  level: ChatLevel;
  state: ChatUsageState;
  nextAvailableAt: string | null;
}> {
  const planCode = await resolveCurrentModelPlan(userId);
  const nowMs = Date.now();
  const limits = (await getChatPlanLimits())[planCode] ?? null;
  const sums = await getChatWindowUsage(userId, nowMs);
  const level = chatLevelForPlan(planCode);
  if (!limits) return { level, state: 'limit', nextAvailableAt: null };
  const state = chatUsageState(
    windowUtilization(sums.fiveHourUsed, limits.fiveHour),
    windowUtilization(sums.weeklyUsed, limits.weekly)
  );
  if (state !== 'limit') return { level, state, nextAvailableAt: null };
  // At the limit: probe with zero added weight to surface the binding window's roll-off.
  const probe = evaluateChatWindows(sums, limits, 0, nowMs);
  return { level, state, nextAvailableAt: probe.nextAvailableAt };
}
