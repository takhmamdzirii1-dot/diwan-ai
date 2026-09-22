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
 * A window record in ascending creation order (ties keep insertion order).
 */
export interface ChatWindowRecord {
  createdAtMs: number;
  weight: number;
}

/**
 * Earliest timestamp at which enough weighted capacity has expired for the
 * requested weight. Walks records oldest-first accumulating freed weight —
 * expiring one old record is often insufficient when weights differ, so the
 * cutoff advances until the cumulative freed weight covers the need.
 * Returns null when the need can never be met (single weight above limit).
 * Mirrors the reserve_chat_usage RPC walk exactly.
 */
export function computeWindowRelease(
  recordsAsc: readonly ChatWindowRecord[],
  windowMs: number,
  used: number,
  limit: number | null,
  weight: number
): string | null {
  if (limit == null) return null;
  const needed = used + weight - limit;
  if (needed <= 0) return null;
  // Oldest-first, like the RPC's ORDER BY created_at (ties keep insertion order).
  const ordered = [...recordsAsc].sort((a, b) => a.createdAtMs - b.createdAtMs);
  let freed = 0;
  for (const record of ordered) {
    freed += record.weight;
    if (freed >= needed) return new Date(record.createdAtMs + windowMs).toISOString();
  }
  return null;
}

/**
 * Shared allow/deny decision. Mirrors the reserve_chat_usage RPC: allow when
 * the weight fits both finite windows; otherwise bind to the later of the
 * two per-window availabilities (a window that can never free enough binds
 * with no countdown).
 */
export function evaluateChatWindows(
  snapshot: {
    fiveHourUsed: number;
    weeklyUsed: number;
    records5h: readonly ChatWindowRecord[];
    records7d: readonly ChatWindowRecord[];
  },
  limits: ChatPlanLimits,
  weight: number
): { allowed: boolean; bindingWindow: ChatWindowName; nextAvailableAt: string | null } {
  const need5 = limits.fiveHour != null && snapshot.fiveHourUsed + weight > limits.fiveHour;
  const need7 = limits.weekly != null && snapshot.weeklyUsed + weight > limits.weekly;
  if (!need5 && !need7) {
    const util5 = windowUtilization(snapshot.fiveHourUsed, limits.fiveHour);
    const util7 = windowUtilization(snapshot.weeklyUsed, limits.weekly);
    return { allowed: true, bindingWindow: util5 >= util7 ? 'five_hour' : 'weekly', nextAvailableAt: null };
  }
  const next5 = need5
    ? computeWindowRelease(snapshot.records5h, CHAT_WINDOW_5H_MS, snapshot.fiveHourUsed, limits.fiveHour, weight)
    : null;
  const next7 = need7
    ? computeWindowRelease(snapshot.records7d, CHAT_WINDOW_7D_MS, snapshot.weeklyUsed, limits.weekly, weight)
    : null;
  if (need5 && need7) {
    if (next5 == null) return { allowed: false, bindingWindow: 'five_hour', nextAvailableAt: null };
    if (next7 == null) return { allowed: false, bindingWindow: 'weekly', nextAvailableAt: null };
    return next5 >= next7
      ? { allowed: false, bindingWindow: 'five_hour', nextAvailableAt: next5 }
      : { allowed: false, bindingWindow: 'weekly', nextAvailableAt: next7 };
  }
  if (need5) return { allowed: false, bindingWindow: 'five_hour', nextAvailableAt: next5 };
  return { allowed: false, bindingWindow: 'weekly', nextAvailableAt: next7 };
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
