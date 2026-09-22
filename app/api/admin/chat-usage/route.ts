import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { getOwnerAccess } from '@/lib/auth/owner';

export const dynamic = 'force-dynamic';

/**
 * Owner-only chat usage/debug ledger: who used what, when, at which weight,
 * under which plan, with the idempotency/execution references needed to
 * explain any single charge later.
 */
export async function GET(request: Request) {
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const url = new URL(request.url);
  const userFilter = url.searchParams.get('user_id')?.trim() || null;
  const modelFilter = url.searchParams.get('model_id')?.trim() || null;
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 500);
  let query = client
    .from('chat_usage_records')
    .select('id,user_id,operation_key,execution_id,model_key,model_id,plan_code,weight,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (userFilter) query = query.eq('user_id', userFilter);
  if (modelFilter) query = query.eq('model_id', modelFilter);
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'CHAT_USAGE_UNAVAILABLE', records: [] }, { status: 503 });
  }
  return NextResponse.json({
    records: (data ?? []).map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      operationKey: String(row.operation_key),
      executionId: row.execution_id == null ? null : String(row.execution_id),
      modelKey: String(row.model_key),
      modelId: String(row.model_id),
      planCode: String(row.plan_code),
      weight: Number(row.weight),
      createdAt: String(row.created_at),
    })),
  });
}
