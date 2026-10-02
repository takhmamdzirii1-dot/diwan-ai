import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/src/lib/supabase/server';
import { listConnectedReviews, resolveConnectedReview } from '@/lib/connected-apps/reviews.server';
import { connectedBody } from '@/lib/connected-apps/http.server';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const input = z.object({ reviewId: z.string().uuid(), approve: z.boolean() }).strict();

export async function GET() {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401, headers });
  if (process.env.CONNECTED_APPS_WRITES_ENABLED !== 'true') return NextResponse.json({ reviews: [] }, { headers });
  try { return NextResponse.json({ reviews: await listConnectedReviews(user.id) }, { headers }); }
  catch { return NextResponse.json({ error: 'CONNECTED_APPS_UNAVAILABLE' }, { status: 503, headers }); }
}

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403, headers });
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401, headers });
  const value = input.safeParse(await connectedBody(new Response(request.body), 4096)
    .then(body => JSON.parse(body)).catch(() => null));
  if (!value.success) return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400, headers });
  try { return NextResponse.json(await resolveConnectedReview(user.id, value.data.reviewId, value.data.approve, request.signal), { headers }); }
  catch { return NextResponse.json({ error: 'CONNECTED_APPS_UNAVAILABLE' }, { status: 503, headers }); }
}
