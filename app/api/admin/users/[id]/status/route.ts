import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerAccess, isOwnerUser } from '@/lib/auth/owner';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';

const schema = z.object({ status: z.enum(['active', 'suspended']) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (id === access.user.id) {
    return NextResponse.json({ error: 'OWNER_ACCOUNT_PROTECTED' }, { status: 409 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_USER_STATUS' }, { status: 400 });

  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });

  const { data: target, error: readError } = await client.auth.admin.getUserById(id);
  if (readError || !target.user) return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
  if (isOwnerUser(target.user)) {
    return NextResponse.json({ error: 'OWNER_ACCOUNT_PROTECTED' }, { status: 409 });
  }

  const { error } = await client.auth.admin.updateUserById(id, {
    ban_duration: parsed.data.status === 'suspended' ? '876000h' : 'none',
  });
  if (error) {
    console.error('[admin users] status update failed', { code: error.code, userId: id });
    return NextResponse.json({ error: 'USER_STATUS_UPDATE_FAILED' }, { status: 409 });
  }

  const resultingStatus = parsed.data.status === 'suspended'
    ? 'suspended'
    : target.user.email_confirmed_at ? 'active' : 'unconfirmed';
  revalidatePath('/admin/users');
  return NextResponse.json({ status: resultingStatus });
}
