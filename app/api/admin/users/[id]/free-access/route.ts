import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerAccess, isOwnerUser } from '@/lib/auth/owner';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';

const bodySchema = z.object({
  state: z.enum(['eligible', 'review_required', 'ineligible', 'manually_approved']),
  reason: z.string().trim().min(3).max(500),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success || id === access.user.id) {
    return NextResponse.json({ error: 'INVALID_USER' }, { status: 400 });
  }
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'INVALID_FREE_ACCESS_CHANGE' }, { status: 400 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const target = await client.auth.admin.getUserById(id);
  if (target.error || !target.data.user) return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
  if (isOwnerUser(target.data.user)) return NextResponse.json({ error: 'OWNER_ACCOUNT_PROTECTED' }, { status: 409 });
  const { data, error } = await client.rpc('set_free_access_eligibility', {
    p_user_id: id,
    p_state: body.data.state,
    p_actor_user_id: access.user.id,
    p_reason: body.data.reason,
  });
  if (error) return NextResponse.json({ error: 'FREE_ACCESS_CHANGE_FAILED' }, { status: 409 });
  const updated = await client.from('free_access_eligibility')
    .select('state,reason_code,evidence,updated_at,updated_by').eq('user_id', id).single();
  if (updated.error) return NextResponse.json({ error: 'FREE_ACCESS_DETAIL_UNAVAILABLE' }, { status: 503 });
  return NextResponse.json({ ...data, detail: updated.data }, { headers: { 'Cache-Control': 'private, no-store' } });
}
