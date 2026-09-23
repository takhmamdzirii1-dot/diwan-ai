import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/src/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { FUNNEL_EVENTS, recordFunnelEvent } from '@/lib/analytics/funnel-events';

const schema = z.object({
  event: z.enum(FUNNEL_EVENTS),
  key: z.string().trim().min(1).max(220),
  metadata: z.record(z.union([z.string().max(300), z.number(), z.boolean(), z.null()])).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_FUNNEL_EVENT' }, { status: 400 });
  const { event, key, metadata } = parsed.data;
  await recordFunnelEvent({ userId: user.id, event: event!, key: key!, metadata });
  if (parsed.data.event === 'lite_declined') {
    const admin = getSupabaseAdminClient();
    if (admin) {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, has_seen_lite_offer: true },
      });
    }
  }
  return NextResponse.json({ recorded: true });
}
