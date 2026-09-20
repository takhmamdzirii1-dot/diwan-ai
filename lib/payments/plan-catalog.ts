import type { PaymentPlan } from './types';

export const PUBLIC_PLAN_CODES = ['free', 'pro', 'max'] as const;
export type PublicPlanCode = (typeof PUBLIC_PLAN_CODES)[number];

const publicPlanCodes = new Set<string>(PUBLIC_PLAN_CODES);

export function isPublicCatalogPlan(plan: PaymentPlan): plan is PaymentPlan & { planCode: PublicPlanCode } {
  return plan.publicVisible && publicPlanCodes.has(plan.planCode);
}

export function isPurchasablePlan(plan: PaymentPlan) {
  return plan.active && plan.priceDzd > 0 && plan.unifiedCredits > 0;
}

