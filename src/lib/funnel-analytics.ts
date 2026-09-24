'use client';

type FunnelEvent = 'trial_started' | 'trial_expired' | 'free_media_exhausted' | 'paywall_shown'
  | 'pro_accepted' | 'pro_declined' | 'lite_shown' | 'lite_accepted' | 'lite_declined'
  | 'checkout_started' | 'payment_method_selected' | 'payment_submitted'
  | 'payment_approved' | 'payment_rejected'
  | 'model_locked_clicked' | 'model_trial_used' | 'model_trial_exhausted' | 'media_upgrade_prompt_shown'
  | 'renewal_reminder_shown' | 'renewal_started' | 'renewal_completed' | 'renewal_failed'
  | 'reactivation_started' | 'reactivation_completed' | 'reactivation_failed';

export function trackFunnelEvent(event: FunnelEvent, key: string, metadata?: Record<string, string | number | boolean | null>) {
  return fetch('/api/analytics/funnel', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event, key, metadata }),
    keepalive: true,
  }).catch(() => null);
}
