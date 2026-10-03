/** Non-secret UI intent only. Checkout still resolves/validates the plan server-side.
 * localStorage survives OAuth navigation and email confirmation in another tab. */
export const LANDING_PLAN_INTENT_KEY = 'vantra.landing-plan.v1';
const MAX_AGE = 30 * 60 * 1000;
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function saveLandingPlan(storage: StorageLike, planId: string, now = Date.now()) {
  if (!/^[a-z0-9-]{1,64}$/i.test(planId)) return;
  storage.setItem(LANDING_PLAN_INTENT_KEY, JSON.stringify({ planId, createdAt: now }));
}
export function takeLandingPlan(storage: StorageLike, now = Date.now()): string | null {
  const raw = storage.getItem(LANDING_PLAN_INTENT_KEY);
  storage.removeItem(LANDING_PLAN_INTENT_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return typeof value.planId === 'string' && /^[a-z0-9-]{1,64}$/i.test(value.planId)
      && Number.isFinite(value.createdAt) && now >= value.createdAt && now - value.createdAt <= MAX_AGE ? value.planId : null;
  } catch { return null; }
}
