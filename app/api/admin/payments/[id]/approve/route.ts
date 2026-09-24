import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getOwnerAccess } from '@/lib/auth/owner';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { recordFunnelEvent } from '@/lib/analytics/funnel-events';
import { classifyRenewalContext, renewalEventFor, type RenewalContext } from '@/lib/subscription/renewal';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'INVALID_PAYMENT_ORDER' }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : null;
  const { data: payment } = await client.from('payment_orders').select('user_id,plan_id,order_kind').eq('id', id).maybeSingle();
  // Renewal context is resolved BEFORE the RPC (all visible rows are prior
  // history) so completed AND failed approvals classify identically.
  let renewalContext: RenewalContext = 'new';
  if (payment?.user_id && payment?.plan_id) {
    const nowIso = new Date().toISOString();
    const [{ data: orderPlan }, { data: activePaid }, { data: prior }] = await Promise.all([
      client.from('payment_plans').select('plan_code').eq('id', payment.plan_id).maybeSingle(),
      client.from('user_entitlements').select('plan_id,payment_plans!inner(plan_code)').eq('user_id', payment.user_id).eq('status', 'active').or(`ends_at.is.null,ends_at.gt.${nowIso}`).limit(1).maybeSingle(),
      client.from('user_entitlements').select('ends_at').eq('user_id', payment.user_id).eq('plan_id', payment.plan_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const orderPlanCode = orderPlan?.plan_code ?? null;
    const activeRelation = activePaid?.payment_plans as unknown as { plan_code?: unknown } | { plan_code?: unknown }[] | null;
    const activePlanCode = Array.isArray(activeRelation) ? activeRelation[0]?.plan_code : activeRelation?.plan_code;
    const wasLapsed = prior?.ends_at != null && new Date(String(prior.ends_at)).getTime() <= Date.now();
    if (payment.order_kind === 'subscription' && typeof orderPlanCode === 'string') {
      if (orderPlanCode === activePlanCode) renewalContext = 'early_renewal';
      else if (wasLapsed) renewalContext = 'reactivation';
    } else if (payment.order_kind === 'credit_pack') {
      renewalContext = 'top_up';
    }
  }
  const { data, error } = await client.rpc('approve_manual_payment', {
    p_payment_order_id: id, p_actor_user_id: access.user.id, p_review_note: note,
  });
  if (error) {
    console.error('[admin payments] approval failed', { code: error.code, paymentOrderId: id });
    const failedEvent = renewalEventFor('failed', renewalContext);
    if (payment?.user_id && failedEvent) {
      await recordFunnelEvent({ userId: payment.user_id, event: failedEvent, key: id, metadata: { paymentOrderId: id } });
    }
    return NextResponse.json({ error: 'PAYMENT_APPROVAL_FAILED' }, { status: 409 });
  }
  if (payment?.user_id) {
    const lifecycleType = (data as { lifecycle_type?: unknown } | null)?.lifecycle_type;
    await recordFunnelEvent({ userId: payment.user_id, event: 'payment_approved', key: id, metadata: { paymentOrderId: id, lifecycleType: typeof lifecycleType === 'string' ? lifecycleType : null } });
    const completedContext = lifecycleType === 'same_plan_renewal'
      ? (renewalContext === 'reactivation' ? 'reactivation' as const : 'early_renewal' as const)
      : classifyRenewalContext({ lifecycleType: typeof lifecycleType === 'string' ? lifecycleType : null, wasLapsed: false, orderKind: payment.order_kind ?? null });
    const completedEvent = renewalEventFor('completed', completedContext);
    if (completedEvent) {
      await recordFunnelEvent({ userId: payment.user_id, event: completedEvent, key: id, metadata: { paymentOrderId: id, lifecycleType: typeof lifecycleType === 'string' ? lifecycleType : null } });
    }
  }
  revalidatePath('/admin');
  revalidatePath('/admin/payments');
  return NextResponse.json({ result: data });
}
