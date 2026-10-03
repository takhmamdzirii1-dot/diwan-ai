// Outcome events are written by trusted server flows after their authoritative action.
const serverOnlyEvents = new Set([
  'signup_completed', 'first_generation_succeeded', 'landing_view', 'cta_click', 'pricing_select',
  'payment_submitted', 'payment_approved', 'payment_rejected',
  'renewal_completed', 'renewal_failed',
  'reactivation_completed', 'reactivation_failed',
  'model_trial_used', 'model_trial_exhausted',
]);

export function isClientFunnelEvent(event: string): boolean {
  return !serverOnlyEvents.has(event);
}
