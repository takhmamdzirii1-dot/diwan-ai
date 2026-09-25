export type PaidTopUpPlanCode = 'lite' | 'pro' | 'max';

export type TopUpCatalogRow = {
  entitlement: unknown;
};

export function topUpPlanCode(entitlement: unknown): PaidTopUpPlanCode | null {
  if (!entitlement || typeof entitlement !== 'object' || Array.isArray(entitlement)) return null;
  const value = (entitlement as { top_up_plan_code?: unknown }).top_up_plan_code;
  return value === 'lite' || value === 'pro' || value === 'max' ? value : null;
}

export function liteTopUpsRemaining(approvedInPeriod: number) {
  return Math.max(0, 2 - Math.max(0, Math.trunc(approvedInPeriod)));
}

export function eligibleTopUpRows<T extends TopUpCatalogRow>(
  rows: readonly T[],
  activePlanCode: PaidTopUpPlanCode | null,
  liteRemaining: number | null,
) {
  if (!activePlanCode) return [];
  if (activePlanCode === 'lite' && (liteRemaining ?? 0) <= 0) return [];
  return rows.filter((row) => topUpPlanCode(row.entitlement) === activePlanCode);
}
