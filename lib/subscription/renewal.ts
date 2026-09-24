import type { ModelPlanCode } from '@/lib/models/plan-entitlements';

/**
 * Manual-subscription renewal helpers (pure). VANTRA has no auto-renew:
 * every state derives from the exact subscription expiration timestamp,
 * never from fragile calendar-day assumptions.
 */

export type RenewalReminderKind = 'none' | 'expiring_soon' | 'ending_soon';

export interface RenewalReminder {
  kind: RenewalReminderKind;
  /** Whole days left, floored, never negative. */
  daysLeft: number;
  expiresAt: string;
}

export const RENEWAL_SOON_DAYS = 5;
export const RENEWAL_ENDING_DAYS = 1;

/** Reminder state for an active paid subscription. Free/lapsed plans: none. */
export function renewalReminderState(input: {
  planCode: ModelPlanCode;
  planEndsAt: string | null;
  nowMs?: number;
}): RenewalReminder | null {
  if (input.planCode === 'free' || !input.planEndsAt) return null;
  const endsAt = new Date(input.planEndsAt).getTime();
  const now = input.nowMs ?? Date.now();
  if (!Number.isFinite(endsAt)) return null;
  const diffMs = endsAt - now;
  if (diffMs <= 0) return null;
  const daysLeft = Math.floor(diffMs / 86_400_000);
  if (diffMs <= RENEWAL_ENDING_DAYS * 86_400_000) {
    return { kind: 'ending_soon', daysLeft, expiresAt: input.planEndsAt };
  }
  if (diffMs <= RENEWAL_SOON_DAYS * 86_400_000) {
    return { kind: 'expiring_soon', daysLeft, expiresAt: input.planEndsAt };
  }
  return null;
}

export type RenewalContext = 'new' | 'early_renewal' | 'reactivation' | 'upgrade' | 'plan_change' | 'top_up';

/**
 * Classify a checkout/approval into acquisition vs renewal/reactivation
 * from lifecycle + prior-lapsed evidence. Pure so both client (started)
 * and server (completed/failed) agree on one meaning.
 */
export function classifyRenewalContext(input: {
  lifecycleType: string | null;
  wasLapsed: boolean;
  orderKind: string | null;
}): RenewalContext {
  if (input.orderKind === 'credit_pack') return 'top_up';
  if (input.lifecycleType === 'same_plan_renewal') {
    return input.wasLapsed ? 'reactivation' : 'early_renewal';
  }
  if (input.lifecycleType === 'upgrade') return 'upgrade';
  if (input.lifecycleType === 'plan_change') return 'plan_change';
  return 'new';
}

export function renewalEventFor(
  stage: 'started' | 'completed' | 'failed',
  context: RenewalContext
): 'renewal_started' | 'renewal_completed' | 'renewal_failed' | 'reactivation_started' | 'reactivation_completed' | 'reactivation_failed' | null {
  if (context === 'early_renewal') return stage === 'started' ? 'renewal_started' : stage === 'completed' ? 'renewal_completed' : 'renewal_failed';
  if (context === 'reactivation') return stage === 'started' ? 'reactivation_started' : stage === 'completed' ? 'reactivation_completed' : 'reactivation_failed';
  return null;
}
