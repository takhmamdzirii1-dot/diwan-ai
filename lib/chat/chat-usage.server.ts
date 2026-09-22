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
  type ChatWindowRecord,
  type ChatWindowSnapshot,
} from './chat-usage';

export type ChatAdmissionReason = 'ok' | 'already_recorded' | 'already_reserved' | 'limit_reached' | 'limits_unconfigured';

export interface ChatAdmission {
  allowed: boolean;
  duplicate: boolean;
  reason: ChatAdmissionReason;
  planCode: ModelPlanCode;
  level: ChatLevel;
  state: ChatUsageState;
  snapshot: ChatWindowSnapshot;
}

interface WindowView {
  fiveHourUsed: number;
  weeklyUsed: number;
  records5h: ChatWindowRecord[];
  records7d: ChatWindowRecord[];
}

function adminClient() {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('CHAT_USAGE_UNAVAILABLE');
  return client;
}

function toReason(reason: string, duplicate: boolean): ChatAdmissionReason {
  if (reason === 'already_recorded') return 'already_recorded';
  if (reason === 'already_reserved') return 'already_reserved';
  if (reason === 'limit_reached') return 'limit_reached';
  if (duplicate) return 'already_recorded';
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

interface UsageRow {
  weight: number;
  createdAtMs: number;
  live: boolean;
  completed: boolean;
}

/**
 * Window view mirroring the reserve RPC: held capacity counts completed
 * usage plus live (non-expired) reservations; the release walk uses
 * completed records only, exactly like the RPC.
 */
function windowView(rows: UsageRow[], nowMs: number): WindowView {
  const fiveHourCutoff = nowMs - CHAT_WINDOW_5H_MS;
  const held = rows.filter((row) => row.completed || row.live);
  const completedAsc = rows
    .filter((row) => row.completed)
    .sort((a, b) => a.createdAtMs - b.createdAtMs);
  return {
    fiveHourUsed: held.filter((row) => row.createdAtMs > fiveHourCutoff).reduce((n, row) => n + row.weight, 0),
    weeklyUsed: held.reduce((n, row) => n + row.weight, 0),
    records5h: completedAsc
      .filter((row) => row.createdAtMs > fiveHourCutoff)
      .map((row) => ({ createdAtMs: row.createdAtMs, weight: row.weight })),
    records7d: completedAsc.map((row) => ({ createdAtMs: row.createdAtMs, weight: row.weight })),
  };
}

export async function getChatWindowView(userId: string, nowMs: number = Date.now()): Promise<WindowView> {
  const weekAgo = new Date(nowMs - CHAT_WINDOW_7D_MS).toISOString();
  const { data, error } = await adminClient()
    .from('chat_usage_records')
    .select('weight,created_at,status,expires_at')
    .eq('user_id', userId)
    .gte('created_at', weekAgo)
    .order('created_at', { ascending: true })
    .limit(10_000);
  if (error) throw new Error('CHAT_USAGE_UNAVAILABLE');
  return windowView(
    (data ?? []).map((row) => {
      const createdAtMs = new Date(String(row.created_at)).getTime();
      const expiresAt = row.expires_at == null ? null : new Date(String(row.expires_at)).getTime();
      return {
        weight: Number(row.weight) || 0,
        createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : nowMs,
        completed: String(row.status) === 'completed',
        live: String(row.status) !== 'completed' && (expiresAt == null || expiresAt > nowMs),
      };
    }),
    nowMs
  );
}

function admission(
  planCode: ModelPlanCode,
  limits: ChatPlanLimits | null,
  view: WindowView,
  decision: { allowed: boolean; nextAvailableAt: string | null },
  duplicate: boolean,
  reason: ChatAdmissionReason
): ChatAdmission {
  const util5 = windowUtilization(view.fiveHourUsed, limits?.fiveHour ?? null);
  const util7 = windowUtilization(view.weeklyUsed, limits?.weekly ?? null);
  return {
    allowed: decision.allowed,
    duplicate,
    reason,
    planCode,
    level: chatLevelForPlan(planCode),
    state: decision.allowed ? chatUsageState(util5, util7) : 'limit',
    snapshot: {
      fiveHourUsed: view.fiveHourUsed,
      weeklyUsed: view.weeklyUsed,
      fiveHourLimit: limits?.fiveHour ?? null,
      weeklyLimit: limits?.weekly ?? null,
      nextAvailableAt: decision.nextAvailableAt,
    },
  };
}

/** Read-only allowance check. Never inserts; the atomic reserve RPC re-checks. */
export async function precheckChatUsage(args: {
  userId: string;
  planCode: ModelPlanCode;
  weight: number;
  nowMs?: number;
}): Promise<ChatAdmission> {
  const nowMs = args.nowMs ?? Date.now();
  const limits = (await getChatPlanLimits())[args.planCode] ?? null;
  const view = await getChatWindowView(args.userId, nowMs);
  if (!limits) {
    return admission(args.planCode, null, view,
      { allowed: false, nextAvailableAt: null }, false, 'limits_unconfigured');
  }
  const decision = evaluateChatWindows(view, limits, args.weight);
  return admission(args.planCode, limits, view, {
    allowed: decision.allowed,
    nextAvailableAt: decision.allowed ? null : decision.nextAvailableAt,
  }, false, decision.allowed ? 'ok' : 'limit_reached');
}

type ReserveArgs = {
  userId: string;
  operationKey: string;
  executionId: string | null;
  modelKey: string;
  modelId: string;
  planCode: ModelPlanCode;
  weight: number;
};

/**
 * Atomic reserve BEFORE provider dispatch. Holds 5h/7d capacity under the
 * per-user advisory lock; replays of the same operation key return the live
 * reservation without reserving twice.
 */
export async function reserveChatUsage(args: ReserveArgs): Promise<ChatAdmission> {
  const { data, error } = await adminClient().rpc('reserve_chat_usage', {
    p_user_id: args.userId,
    p_operation_key: args.operationKey,
    p_execution_id: args.executionId,
    p_model_key: args.modelKey,
    p_model_id: args.modelId,
    p_plan_code: args.planCode,
    p_weight: args.weight,
  });
  if (error) throw new Error(error.message || 'CHAT_RESERVE_FAILED');
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
  const view: WindowView = {
    fiveHourUsed: Number(result.five_hour_used) || 0,
    weeklyUsed: Number(result.weekly_used) || 0,
    records5h: [],
    records7d: [],
  };
  const duplicate = result.duplicate === true;
  const nextAvailableAt = result.next_available_at == null ? null : String(result.next_available_at);
  return admission(args.planCode, limits, view, {
    allowed: result.allowed === true,
    nextAvailableAt: result.allowed === true ? null : nextAvailableAt,
  }, duplicate, toReason(String(result.reason ?? ''), duplicate));
}

/**
 * Settle a reservation. 'completed' counts the request exactly once;
 * 'released' deletes it so failures, cancels, and interruptions never
 * consume usage. Safe to retry: unknown keys and repeats are no-ops.
 */
export async function finalizeChatUsage(
  operationKey: string,
  outcome: 'completed' | 'released'
): Promise<void> {
  const { data, error } = await adminClient().rpc('finalize_chat_usage', {
    p_operation_key: operationKey,
    p_outcome: outcome,
  });
  if (error) throw new Error(error.message || 'CHAT_FINALIZE_FAILED');
  const result = data as { ok?: unknown } | null;
  if (!result || result.ok !== true) throw new Error('CHAT_FINALIZE_FAILED');
}

/** Resolve plan + weight context for a metered chat model. */
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
  const view = await getChatWindowView(userId, nowMs);
  const level = chatLevelForPlan(planCode);
  if (!limits) return { level, state: 'limit', nextAvailableAt: null };
  const state = chatUsageState(
    windowUtilization(view.fiveHourUsed, limits.fiveHour),
    windowUtilization(view.weeklyUsed, limits.weekly)
  );
  if (state !== 'limit') return { level, state, nextAvailableAt: null };
  // At the limit: probe with zero added weight to surface the binding window's roll-off.
  const probe = evaluateChatWindows(view, limits, 0);
  return { level, state, nextAvailableAt: probe.nextAvailableAt };
}
