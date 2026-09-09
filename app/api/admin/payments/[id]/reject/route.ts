import { NextResponse } from 'next/server';
import { getOwnerAccess } from '@/lib/auth/owner';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : null;
  const { data, error } = await client.rpc('reject_manual_payment', {
    p_payment_order_id: id, p_actor_user_id: access.user.id, p_review_note: note,
  });
  if (error) {
    console.error('[admin payments] rejection failed', { code: error.code, paymentOrderId: id });
    return NextResponse.json({ error: 'PAYMENT_REJECTION_FAILED' }, { status: 409 });
  }
  return NextResponse.json({ result: data });
}
