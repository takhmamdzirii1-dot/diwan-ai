import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { getStudioAccess } from '@/lib/access/trial-access';
import { recordFunnelEvent } from '@/lib/analytics/funnel-events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  try {
    const access = await getStudioAccess(user);
    if (access.kind === 'trial_active') {
      await recordFunnelEvent({ userId: user.id, event: 'trial_started', key: 'canonical', occurredAt: access.trialStartedAt });
    }
    return NextResponse.json({ access }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'STUDIO_ACCESS_UNAVAILABLE' }, { status: 503 });
  }
}
