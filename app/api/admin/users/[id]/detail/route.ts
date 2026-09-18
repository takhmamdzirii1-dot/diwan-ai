import { NextResponse } from 'next/server';
import { getOwnerAccess } from '@/lib/auth/owner';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'INVALID_USER_ID' }, { status: 400 });
  }
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const [entitlements, ledger, payments, jobs] = await Promise.all([
    client.from('user_entitlements').select('id,plan_name,status,starts_at,ends_at')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(20),
    client.from('credit_transactions').select('id,transaction_type,amount,reason,created_at')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(30),
    client.from('payment_orders').select('id,plan_name,status,amount_dzd,created_at')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(20),
    client.from('ai_executions').select('id,model_id,modality,state,credits_charged,created_at')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(20),
  ]);
  if ([entitlements, ledger, payments, jobs].some((result) => result.error)) {
    return NextResponse.json({ error: 'USER_DETAIL_QUERY_FAILED' }, { status: 503 });
  }
  const orderIds = (payments.data ?? []).map((order) => order.id);
  const audit = orderIds.length ? await client.from('payment_audit_log')
    .select('id,payment_order_id,action,created_at').in('payment_order_id', orderIds)
    .order('created_at', { ascending: false }).limit(30) : { data: [], error: null };
  const generalAudit = await client.from('admin_audit_log')
    .select('id,resource_id,action,created_at').eq('resource_type', 'user').eq('resource_id', id)
    .order('created_at', { ascending: false }).limit(30);
  if (audit.error || generalAudit.error) {
    return NextResponse.json({ error: 'USER_DETAIL_QUERY_FAILED' }, { status: 503 });
  }
  return NextResponse.json({
    entitlements: entitlements.data ?? [], ledger: ledger.data ?? [],
    payments: payments.data ?? [], jobs: jobs.data ?? [],
    audit: [...(generalAudit.data ?? []), ...(audit.data ?? [])]
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
      .slice(0, 30),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
