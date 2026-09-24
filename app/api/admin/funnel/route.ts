import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { getOwnerAccess } from '@/lib/auth/owner';

export const dynamic = 'force-dynamic';

const RANGES = { '7d': 7, '30d': 30 } as const;

/**
 * Owner-only conversion funnel aggregates. Counts real user_funnel audit
 * rows only — raw event counts and distinct users per event, never
 * fabricated rates. Acquisition vs renewal/reactivation splits come from
 * the event names themselves.
 */
export async function GET(request: Request) {
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const url = new URL(request.url);
  const range = url.searchParams.get('range') === '30d' ? '30d' : '7d';
  const cutoff = new Date(Date.now() - RANGES[range] * 86_400_000).toISOString();
  const { data, error } = await client
    .from('admin_audit_log')
    .select('action,actor_user_id,created_at')
    .eq('resource_type', 'user_funnel')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) {
    return NextResponse.json({ error: 'FUNNEL_UNAVAILABLE', events: [] }, { status: 503 });
  }
  const byEvent = new Map<string, { count: number; users: Set<string> }>();
  for (const row of data ?? []) {
    const action = String(row.action ?? '');
    if (!action) continue;
    let entry = byEvent.get(action);
    if (!entry) {
      entry = { count: 0, users: new Set() };
      byEvent.set(action, entry);
    }
    entry.count += 1;
    if (row.actor_user_id) entry.users.add(String(row.actor_user_id));
  }
  return NextResponse.json({
    range,
    generatedAt: new Date().toISOString(),
    truncated: (data ?? []).length >= 5000,
    events: [...byEvent.entries()].map(([event, entry]) => ({
      event,
      count: entry.count,
      users: entry.users.size,
    })),
  });
}
