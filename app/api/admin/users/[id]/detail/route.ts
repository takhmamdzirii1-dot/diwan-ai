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
  const [balances, periods, entitlements, ledger, payments, jobs, freeAccess, riskSummary] = await Promise.all([
    client.from('credits')
      .select('balance,subscription_balance,subscription_rollover_balance,purchased_balance,free_image_remaining,free_video_remaining,lite_video_remaining,subscription_entitlement_id,subscription_plan_code,lite_video_entitlement_id')
      .eq('user_id', id).maybeSingle(),
    client.from('subscription_periods')
      .select('entitlement_id,plan_code,period_starts_at,period_ends_at,base_allowance,rollover_amount,included_videos')
      .eq('user_id', id).eq('state', 'active').maybeSingle(),
    client.from('user_entitlements').select('id,plan_name,status,starts_at,ends_at')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(20),
    client.from('credit_transactions').select('id,transaction_type,amount,reason,created_at')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(30),
    client.from('payment_orders').select('id,plan_name,status,amount_dzd,created_at')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(20),
    client.from('ai_executions').select('id,model_id,modality,state,credits_charged,created_at')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(20),
    client.from('free_access_eligibility')
      .select('state,reason_code,evidence,updated_at,updated_by').eq('user_id', id).maybeSingle(),
    client.rpc('free_device_risk_summary', { p_user_id: id }),
  ]);
  if ([balances, periods, entitlements, ledger, payments, jobs].some((result) => result.error)) {
    return NextResponse.json({ error: 'USER_DETAIL_QUERY_FAILED' }, { status: 503 });
  }
  const period = periods.data;
  const account = balances.data;
  const now = Date.now();
  const currentPeriod = period && account
    && period.entitlement_id === account.subscription_entitlement_id
    && period.plan_code === account.subscription_plan_code
    && Date.parse(period.period_starts_at) <= now
    && Date.parse(period.period_ends_at) > now ? period : null;
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
    freeAccess: freeAccess.error ? null : {
      ...(freeAccess.data ?? { state: 'eligible', reason_code: null, evidence: {}, updated_at: null, updated_by: null }),
      riskSummary: riskSummary.error ? null : riskSummary.data,
    },
    balances: balances.data ? {
      balance: String(balances.data.balance),
      subscription_balance: String(balances.data.subscription_balance),
      subscription_rollover_balance: String(balances.data.subscription_rollover_balance),
      purchased_balance: String(balances.data.purchased_balance),
      free_image_remaining: Number(balances.data.free_image_remaining),
      free_video_remaining: Number(balances.data.free_video_remaining),
      lite_video_remaining: Number(balances.data.lite_video_remaining),
    } : null,
    allowances: {
      plan_code: currentPeriod?.plan_code ?? null,
      subscription_base: currentPeriod ? String(currentPeriod.base_allowance) : null,
      rollover: currentPeriod?.plan_code === 'pro' ? String(currentPeriod.rollover_amount) : null,
      lite_videos: currentPeriod?.plan_code === 'lite'
        && account?.lite_video_entitlement_id === currentPeriod.entitlement_id
        ? Number(currentPeriod.included_videos) : null,
    },
    entitlements: entitlements.data ?? [], ledger: ledger.data ?? [],
    payments: payments.data ?? [], jobs: jobs.data ?? [],
    audit: [...(generalAudit.data ?? []), ...(audit.data ?? [])]
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
      .slice(0, 30),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
