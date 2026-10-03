import 'server-only';

import { createHash } from 'node:crypto';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { sanitizeAttribution, isCompletedGeneration } from './marketing';
import { scheduleMetaConversion } from './meta.server';

export const FUNNEL_EVENTS = [
  'landing_view', 'cta_click', 'pricing_select', 'signup_completed', 'first_generation_succeeded',
  'trial_started', 'trial_expired', 'free_media_exhausted', 'paywall_shown',
  'pro_accepted', 'pro_declined', 'lite_shown', 'lite_accepted', 'lite_declined',
  'checkout_started', 'payment_method_selected', 'payment_submitted',
  'payment_approved', 'payment_rejected',
  'model_locked_clicked', 'model_trial_used', 'model_trial_exhausted', 'media_upgrade_prompt_shown',
  'renewal_reminder_shown', 'renewal_started', 'renewal_completed', 'renewal_failed',
  'reactivation_started', 'reactivation_completed', 'reactivation_failed',
] as const;
export type FunnelEvent = typeof FUNNEL_EVENTS[number];

export async function recordFunnelEvent(input: {
  userId: string;
  event: FunnelEvent;
  key: string;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}) {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  const { data: auth } = await admin.auth.admin.getUserById(input.userId);
  const acquisition = auth.user?.user_metadata?.acquisition;
  const safeAcquisition = sanitizeAttribution(acquisition);
  const resourceId = `${input.event}:${input.key}`.slice(0, 300);
  const digest = createHash('sha256').update(`${input.userId}:${resourceId}`).digest('hex').slice(0, 32);
  const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20)}`;
  const { error } = await admin.from('admin_audit_log').insert({
    id,
    actor_user_id: input.userId,
    action: input.event,
    resource_type: 'user_funnel',
    resource_id: resourceId,
    metadata: { ...safeAcquisition, ...(input.metadata ?? {}) },
    ...(input.occurredAt ? { created_at: input.occurredAt } : {}),
  });
  if (error && error.code !== '23505') {
    console.error('[funnel] event write failed', { event: input.event, code: error.code });
  }
  if (error) return false;
  // No change to payment authority/snapshots: read the approved immutable order
  // only to report its real value. Never send client-reported prices to Meta.
  try {
    let valueDzd: number | undefined;
    if (input.event === 'payment_approved' && auth.user?.user_metadata?.marketing_consent === true) {
      const order = await admin.from('payment_orders').select('amount_dzd,status')
        .eq('id', input.key).eq('user_id', input.userId).maybeSingle();
      if (!order.error && order.data?.status === 'approved') valueDzd = Number(order.data.amount_dzd);
    }
    if (input.event !== 'payment_approved' || (valueDzd !== undefined && Number.isFinite(valueDzd))) {
      scheduleMetaConversion({ event: input.event, id: resourceId, subject: input.userId,
        acquisition: safeAcquisition, consent: auth.user?.user_metadata?.marketing_consent === true,
        valueDzd, occurredAt: input.occurredAt });
    }
  } catch { console.warn('[marketing] conversion preparation unavailable', { event: input.event }); }
  return true;
}

/** Analytics only, called AFTER the existing atomic finalizer. Single event per
 * account, including successful replay; failures never count. */
export async function recordFirstGenerationSuccess(userId: string, executionId: string, result: unknown) {
  if (!isCompletedGeneration(result)) return;
  try {
    await recordFunnelEvent({ userId, event: 'first_generation_succeeded', key: 'first-success', metadata: { executionId } });
  } catch { console.warn('[funnel] first success telemetry unavailable'); }
}
