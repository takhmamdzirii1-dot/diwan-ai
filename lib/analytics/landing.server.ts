import 'server-only';
import { createHash } from 'node:crypto';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { landingBatchSchema, sanitizeAttribution } from './marketing';
import { scheduleMetaConversion } from './meta.server';

// Bounded per-instance abuse protection, not a distributed rate-limit promise.
const visits = new Map<string, { count: number; until: number }>();
export async function recordLandingBatch(body: unknown, consent: boolean) {
  const parsed = landingBatchSchema.safeParse(body);
  if (!parsed.success) return { status: 400, error: 'INVALID_MARKETING_EVENT' };
  const { visitorId, events } = parsed.data;
  const now = Date.now();
  const prior = visits.get(visitorId);
  const visit = prior && prior.until > now ? prior : { count: 0, until: now + 3_600_000 };
  if (visit.count + events.length > 120) return { status: 429, error: 'EVENT_LIMIT' };
  if (visits.size >= 1000) visits.delete(visits.keys().next().value!);
  visit.count += events.length; visits.set(visitorId, visit);
  const admin = getSupabaseAdminClient();
  if (!admin) return { status: 503, error: 'ANALYTICS_UNAVAILABLE' };
  const acquisition = sanitizeAttribution(parsed.data.acquisition);
  const rows = events.map(event => {
    const digest = createHash('sha256').update(`${visitorId}:${event.id}`).digest('hex').slice(0, 32);
    const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20)}`;
    return { id, actor_user_id: null, action: event.event, resource_type: 'user_funnel',
      resource_id: `${event.event}:${event.id}`, metadata: { ...acquisition, ...event, visitorId } };
  });
  // Conflict-ignore preserves immutable historical rows and delivers conversions
  // only for newly inserted events. A beacon replay cannot double-count.
  const result = await admin.from('admin_audit_log').upsert(rows, { onConflict: 'id', ignoreDuplicates: true }).select('id');
  if (result.error) {
    console.warn('[marketing] event write failed', { code: result.error.code });
    return { status: 503, error: 'ANALYTICS_UNAVAILABLE' };
  }
  const inserted = new Set((result.data ?? []).map(row => row.id));
  rows.forEach((row, index) => {
    if (inserted.has(row.id)) scheduleMetaConversion({ event: row.action, id: events[index].id,
      subject: visitorId, consent, acquisition });
  });
  return { status: 200, recorded: inserted.size };
}
