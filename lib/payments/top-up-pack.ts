import { topUpPlanCode, type PaidTopUpPlanCode } from './top-up-catalog';

export function topUpPackLimit(entitlement: unknown): number | null {
  if (!entitlement || typeof entitlement !== 'object' || Array.isArray(entitlement)) return null;
  const value = (entitlement as { top_up_purchase_limit_per_period?: unknown }).top_up_purchase_limit_per_period;
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function topUpPackPlan(entitlement: unknown): PaidTopUpPlanCode | null {
  return topUpPlanCode(entitlement);
}

export function paidTopUpPlanLabel(plan: PaidTopUpPlanCode | null | undefined): string {
  if (plan === 'lite') return 'Lite';
  if (plan === 'pro') return 'Pro';
  if (plan === 'max') return 'MAX';
  return 'Not configured';
}

export function topUpPackLimitLabel(entitlement: unknown): string {
  const plan = topUpPackPlan(entitlement);
  if (!plan) return 'Not configured';
  const limit = topUpPackLimit(entitlement);
  if (plan === 'lite') return `${Math.min(limit ?? 2, 2)} / paid period`;
  return limit == null ? 'No pack limit' : `${limit} / paid period`;
}
