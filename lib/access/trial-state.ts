export const FREE_TRIAL_DAYS = 7;
export const FREE_VIDEO_MAX_DURATION_SECONDS = 5;

export function freeVideoDurationAllowed(planCode: string, durationSeconds: number) {
  return planCode !== 'free' || durationSeconds <= FREE_VIDEO_MAX_DURATION_SECONDS;
}

export type StudioAccessKind = 'trial_active' | 'trial_expired' | 'paid_active' | 'paid_lapsed';

export type StudioAccessState = {
  kind: StudioAccessKind;
  trialStartedAt: string;
  trialExpiresAt: string;
  paidPlanId: string | null;
  paidPlanCode: string | null;
  paidPlanName: string | null;
  hasSeenLiteOffer: boolean;
};

export type AccessEntitlement = {
  plan_id: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  payment_plans: { plan_code: string | null; name: string } | Array<{ plan_code: string | null; name: string }> | null;
};

export function generationAccessError(access: StudioAccessState, modality: 'chat' | 'image' | 'video') {
  if (access.kind === 'paid_lapsed') return 'PAID_PLAN_REACTIVATION_REQUIRED' as const;
  if (access.kind === 'trial_expired' && modality !== 'chat') return 'FREE_MEDIA_EXPIRED' as const;
  return null;
}

export function trialExpiresAt(createdAt: string) {
  const started = new Date(createdAt);
  return new Date(started.getTime() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function deriveStudioAccess(input: {
  createdAt: string;
  now?: Date;
  entitlements?: AccessEntitlement[];
  hasSeenLiteOffer?: boolean;
}): StudioAccessState {
  const rows = input.entitlements ?? [];
  const now = input.now ?? new Date();
  const paid = rows.filter((row) => {
    const relation = Array.isArray(row.payment_plans) ? row.payment_plans[0] : row.payment_plans;
    return relation?.plan_code && relation.plan_code !== 'free';
  });
  const active = paid.find((row) => row.status === 'active' && (!row.ends_at || new Date(row.ends_at) > now));
  const selected = active ?? paid[0] ?? null;
  const plan = selected ? (Array.isArray(selected.payment_plans) ? selected.payment_plans[0] : selected.payment_plans) : null;
  const expiresAt = trialExpiresAt(input.createdAt);
  return {
    kind: active ? 'paid_active' : paid.length ? 'paid_lapsed' : now < new Date(expiresAt) ? 'trial_active' : 'trial_expired',
    trialStartedAt: input.createdAt,
    trialExpiresAt: expiresAt,
    paidPlanId: selected?.plan_id ?? null,
    paidPlanCode: plan?.plan_code ?? null,
    paidPlanName: plan?.name ?? null,
    hasSeenLiteOffer: input.hasSeenLiteOffer === true,
  };
}
