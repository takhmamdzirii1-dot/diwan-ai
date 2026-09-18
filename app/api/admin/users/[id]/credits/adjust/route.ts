import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerAccess } from '@/lib/auth/owner';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';

const schema = z.object({
  direction: z.enum(['add', 'deduct']),
  amount: z.number().int().positive().max(1_000_000_000),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().uuid(),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'INVALID_USER' }, { status: 400 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_CREDIT_ADJUSTMENT' }, { status: 400 });
  }

  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const { data: target, error: targetError } = await client.auth.admin.getUserById(id);
  if (targetError || !target.user) {
    return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
  }

  const signedAmount = parsed.data.direction === 'deduct'
    ? -parsed.data.amount
    : parsed.data.amount;
  const payloadHash = createHash('sha256').update(JSON.stringify({
    actorUserId: access.user.id,
    targetUserId: id,
    amount: signedAmount,
    reason: parsed.data.reason,
    idempotencyKey: parsed.data.idempotencyKey,
  })).digest('hex');
  const { data, error } = await client.rpc('admin_adjust_user_credits', {
    p_target_user_id: id,
    p_actor_user_id: access.user.id,
    p_amount: signedAmount,
    p_reason: parsed.data.reason,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_payload_hash: payloadHash,
  });
  if (error) {
    const code = /INSUFFICIENT_CREDITS/.test(error.message)
      ? 'INSUFFICIENT_CREDITS'
      : /IDEMPOTENCY_CONFLICT/.test(error.message)
        ? 'IDEMPOTENCY_CONFLICT'
        : /CREDIT_ACCOUNT_NOT_FOUND/.test(error.message)
          ? 'CREDIT_ACCOUNT_NOT_FOUND'
          : 'CREDIT_ADJUSTMENT_FAILED';
    return NextResponse.json({ error: code }, { status: code === 'INSUFFICIENT_CREDITS' ? 409 : 400 });
  }
  const result = data as Record<string, unknown>;
  revalidatePath('/admin/users');
  revalidatePath('/admin/audit');
  return NextResponse.json({
    balance: String(result.balance),
    transaction: {
      id: String(result.transaction_id),
      transaction_type: 'adjustment',
      amount: String(result.amount),
      reason: parsed.data.reason,
      created_at: String(result.created_at),
    },
    idempotent: Boolean(result.idempotent),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
