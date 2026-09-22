import type { ModelPlanCode } from '@/lib/models/plan-entitlements';

/**
 * Weighted Chat Usage Engine — pure core.
 *
 * Chat never consumes VANTRA Credits. Each successful chat request consumes
 * internal weighted units (the chat model's customer_credit_price) against
 * per-plan rolling 5-hour and 7-day allowances. Raw units, weights, and
 * numeric limits must never reach customer-facing surfaces; see the
 * ChatLevel / ChatUsageState mappings below.
 */

export const CHAT_WINDOW_5H_MS = 5 * 3_600_000;
export const CHAT_WINDOW_7D_MS = 7 * 86_400_000;

export type ChatLevel = 'standard' | 'extended' | 'high';
export type ChatUsageState = 'plenty' | 'high' | 'near' | 'limit';
export type ChatWindowName = 'five_hour' | 'weekly' | null;

export interface ChatPlanLimits {
  fiveHour: number | null;
  weekly: number | null;
}

export interface ChatWindowSnapshot {
  fiveHourUsed: number;
  weeklyUsed: number;
  fiveHourLimit: number | null;
  weeklyLimit: number | null;
  nextAvailableAt: string | null;
}

/** Customer-facing chat tier. Max rides the top tier; it is a frozen plan. */
export function chatLevelForPlan(plan: ModelPlanCode): ChatLevel {
  if (plan === 'lite') return 'extended';
  if (plan === 'pro' || plan === 'max') return 'high';
  return 'standard';
}

/** A usable chat weight is a non-negative safe integer. Null/negative/NaN
 *  means Admin-unconfigured: metered usage must fail closed, never invent. */
export function isValidChatWeight(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0;
}

/** Utilization of a window. A null limit means unlimited (utilization 0). */
export function windowUtilization(used: number, limit: number | null): number {
  if (limit == null) return 0;
  if (limit <= 0) return used > 0 ? 2 : 0;
  return used / limit;
}

/** Customer-facing state from the hotter window. Thresholds only — no raw
 *  numbers leak through this mapping. */
export function chatUsageState(util5h: number, utilWeek: number): ChatUsageState {
  const peak = Math.max(util5h, utilWeek);
  if (peak >= 1) return 'limit';
  if (peak >= 0.9) return 'near';
  if (peak >= 0.7) return 'high';
  return 'plenty';
}

/**
 * Shared allow/deny decision. Mirrors the consume_chat_usage RPC: allow when
 * neither post-add utilization exceeds 1, bind to the hotter window, and
 * report the oldest record of the binding window as next availability.
 */
export function evaluateChatWindows(
  snapshot: { fiveHourUsed: number; weeklyUsed: number; oldest5h: string | null; oldest7d: string | null },
  limits: ChatPlanLimits,
  weight: number,
  nowMs: number = Date.now()
): { allowed: boolean; bindingWindow: ChatWindowName; nextAvailableAt: string | null } {
  const post5 = snapshot.fiveHourUsed + weight;
  const post7 = snapshot.weeklyUsed + weight;
  const util5 = windowUtilization(post5, limits.fiveHour);
  const util7 = windowUtilization(post7, limits.weekly);
  const bindingWindow: ChatWindowName = util5 >= util7 ? 'five_hour' : 'weekly';
  if (util5 <= 1 && util7 <= 1) {
    return { allowed: true, bindingWindow, nextAvailableAt: null };
  }
  const oldest = bindingWindow === 'five_hour' ? snapshot.oldest5h : snapshot.oldest7d;
  const windowMs = bindingWindow === 'five_hour' ? CHAT_WINDOW_5H_MS : CHAT_WINDOW_7D_MS;
  if (!oldest) return { allowed: false, bindingWindow, nextAvailableAt: null };
  const next = new Date(new Date(oldest).getTime() + windowMs).getTime();
  return {
    allowed: false,
    bindingWindow,
    nextAvailableAt: new Date(Math.max(next, nowMs)).toISOString(),
  };
}

/** Calm countdown text for "More Chat capacity becomes available in …".
 *  Returns null when there is nothing meaningful to count down to. */
export function formatCapacityWait(nextAvailableAt: string | null, nowMs: number = Date.now()): string | null {
  if (!nextAvailableAt) return null;
  const diffMs = new Date(nextAvailableAt).getTime() - nowMs;
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
  const totalMinutes = Math.max(1, Math.ceil(diffMs / 60_000));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 48) return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours === 0 ? `${days}d` : `${days}d ${restHours}h`;
}
