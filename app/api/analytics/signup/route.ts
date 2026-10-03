import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/src/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { isNewSignup, sanitizeAttribution } from '@/lib/analytics/marketing';
import { recordFunnelEvent } from '@/lib/analytics/funnel-events';

const schema = z.object({ startedAt: z.string().datetime(), acquisition: z.unknown().optional() }).strict();
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  const text = await request.text();
  if (text.length > 4096) return NextResponse.json({ error: 'INVALID_SIGNUP_EVENT' }, { status: 400 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: 'INVALID_SIGNUP_EVENT' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_SIGNUP_EVENT' }, { status: 400 });
  if (!isNewSignup(user.created_at, parsed.data.startedAt)) return NextResponse.json({ recorded: false });
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: 'ANALYTICS_UNAVAILABLE' }, { status: 503 });
  // Email signup already persisted acquisition via Auth. OAuth signup arrives
  // here after authentication; first-touch metadata is never replaced.
  const existing = sanitizeAttribution(user.user_metadata?.acquisition);
  const acquisition = Object.keys(existing).length ? existing : sanitizeAttribution(parsed.data.acquisition);
  const consent = (await cookies()).get('vantra_marketing_consent')?.value === 'granted';
  const saved = await admin.auth.admin.updateUserById(user.id, { user_metadata: {
    ...user.user_metadata, acquisition, marketing_consent: consent,
  } });
  if (saved.error) return NextResponse.json({ error: 'ANALYTICS_UNAVAILABLE' }, { status: 503 });
  const recorded = await recordFunnelEvent({ userId: user.id, event: 'signup_completed', key: user.id });
  return NextResponse.json({ recorded: recorded === true, eventId: `signup_completed:${user.id}` });
}
