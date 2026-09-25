import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { getOwnerAccess } from '@/lib/auth/owner';

export const dynamic = 'force-dynamic';

/** Owner-only: live chat plan allowances (raw units stay server-side). */
export async function GET() {
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const { data, error } = await client
    .from('chat_plan_limits')
    .select('plan_code,five_hour_limit,weekly_limit,fallback_enabled,updated_at')
    .order('plan_code');
  if (error) {
    return NextResponse.json({ error: 'CHAT_LIMITS_UNAVAILABLE', limits: [] }, { status: 503 });
  }
  const controls = await client.from('chat_cost_controls')
    .select('cost_normalization_enabled,usage_unit_cost_usd,complexity_enabled,complexity_rules,context_controls,output_controls,concurrency_controls')
    .eq('singleton', true).maybeSingle();
  return NextResponse.json({
    costControls: controls.error ? null : controls.data,
    limits: (data ?? []).map((row) => ({
      planCode: String(row.plan_code),
      fiveHourLimit: row.five_hour_limit == null ? null : Number(row.five_hour_limit),
      weeklyLimit: row.weekly_limit == null ? null : Number(row.weekly_limit),
      fallbackEnabled: Boolean(row.fallback_enabled),
      updatedAt: String(row.updated_at),
    })),
  });
}
