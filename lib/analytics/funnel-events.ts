import 'server-only';

import { createHash } from 'node:crypto';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';

export const FUNNEL_EVENTS = [
  'trial_started', 'trial_expired', 'free_media_exhausted', 'paywall_shown',
  'pro_accepted', 'pro_declined', 'lite_shown', 'lite_accepted', 'lite_declined',
  'checkout_started', 'payment_method_selected', 'payment_submitted',
  'payment_approved', 'payment_rejected',
] as const;
export type FunnelEvent = typeof FUNNEL_EVENTS[number];

const acquisitionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'landing_variant'] as const;

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
  const safeAcquisition: Record<string, string> = {};
  if (acquisition && typeof acquisition === 'object') {
    for (const key of acquisitionKeys) {
      const value = (acquisition as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.length <= 300) safeAcquisition[key] = value;
    }
  }
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
}
