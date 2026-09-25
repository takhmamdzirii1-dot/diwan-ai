export const FREE_VIDEO_MAX_DURATION_SECONDS = 5;

export function freeVideoDurationAllowed(planCode: string, durationSeconds: number) {
  return !['free', 'lite'].includes(planCode) || durationSeconds <= FREE_VIDEO_MAX_DURATION_SECONDS;
}

export type StudioAccessKind = 'trial_active' | 'paid_active';
export type FreeEligibilityState = 'eligible' | 'review_required' | 'ineligible' | 'manually_approved';

export type StudioAccessState = {
  kind: StudioAccessKind;
  trialStartedAt: string;
  trialExpiresAt: null;
  paidPlanId: string | null;
  paidPlanCode: string | null;
  paidPlanName: string | null;
  hasSeenLiteOffer: boolean;
  freeEligibility: FreeEligibilityState;
};

export type AccessEntitlement = {
  plan_id: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  payment_plans: { plan_code: string | null; name: string } | Array<{ plan_code: string | null; name: string }> | null;
};

export function generationAccessError(access: StudioAccessState, _modality: 'chat' | 'image' | 'video') {
  if (access.kind !== 'paid_active' && !['eligible', 'manually_approved'].includes(access.freeEligibility)) {
    return 'FREE_ACCESS_RESTRICTED' as const;
  }
  return null;
}

export function deriveStudioAccess(input: {
  createdAt: string;
  now?: Date;
  entitlements?: AccessEntitlement[];
  hasSeenLiteOffer?: boolean;
  freeEligibility?: FreeEligibilityState;
}): StudioAccessState {
  const rows = input.entitlements ?? [];
  const now = input.now ?? new Date();
  const paid = rows.filter((row) => {
    const relation = Array.isArray(row.payment_plans) ? row.payment_plans[0] : row.payment_plans;
    return relation?.plan_code && relation.plan_code !== 'free';
  });
  const active = paid.find((row) => row.status === 'active'
    && new Date(row.starts_at) <= now
    && (!row.ends_at || new Date(row.ends_at) > now));
  const selected = active ?? paid[0] ?? null;
  const plan = selected ? (Array.isArray(selected.payment_plans) ? selected.payment_plans[0] : selected.payment_plans) : null;
  return {
    kind: active ? 'paid_active' : 'trial_active',
    trialStartedAt: input.createdAt,
    trialExpiresAt: null,
    paidPlanId: selected?.plan_id ?? null,
    paidPlanCode: plan?.plan_code ?? null,
    paidPlanName: plan?.name ?? null,
    hasSeenLiteOffer: input.hasSeenLiteOffer === true,
    freeEligibility: input.freeEligibility ?? 'eligible',
  };
}
