import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { getEffectiveRuntimeModels } from '@/lib/models/runtime-config';
import { estimatePlanOutcomes } from '@/lib/payments/outcome-estimates';
import { PAYMENT_GATEWAYS } from '@/lib/payments/gateways';
import { eligibleTopUpRows, liteTopUpsRemaining, type PaidTopUpPlanCode } from '@/lib/payments/top-up-catalog';
import { topUpPackLimit } from '@/lib/payments/top-up-pack';
import { createClient } from '@/src/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'PAYMENT_CATALOG_UNAVAILABLE' }, { status: 503 });
  const { data, error } = await client.from('payment_plans')
    .select('id,slug,plan_code,name,description,kind,price_dzd,unified_credits,active,display_order,featured,access_period_days,public_visible')
    .eq('public_visible', true).in('plan_code', ['free', 'pro', 'max'])
    .or('active.eq.true,plan_code.eq.free')
    .order('display_order').order('created_at');
  if (error) {
    console.error('[payments] plan catalog failed', { code: error.code });
    return NextResponse.json({ error: 'PAYMENT_CATALOG_UNAVAILABLE' }, { status: 503 });
  }
  const plans = (data ?? []).map((plan) => ({
    id: plan.id, slug: plan.slug, planCode: plan.plan_code, name: plan.name, description: plan.description,
    kind: plan.kind, priceDzd: plan.price_dzd, unifiedCredits: Number(plan.unified_credits),
    active: plan.active, displayOrder: plan.display_order, featured: plan.featured,
    accessPeriodDays: plan.access_period_days, publicVisible: plan.public_visible,
  }));
  const pro = plans.find((plan) => plan.planCode === 'pro');
  let creditPacks: typeof plans = [];
  let topUp: {
    activePlanCode: PaidTopUpPlanCode | null;
    activePlanName: string | null;
    liteRemaining: number | null;
    reason: 'ACTIVE_PAID_PLAN_REQUIRED' | 'LITE_TOP_UP_LIMIT_REACHED' | null;
  } = { activePlanCode: null, activePlanName: null, liteRemaining: null, reason: 'ACTIVE_PAID_PLAN_REQUIRED' };
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (user) {
    const { data: entitlements, error: entitlementError } = await client.from('user_entitlements')
      .select('starts_at,ends_at,payment_plans!inner(plan_code,name)')
      .eq('user_id', user.id).eq('status', 'active').lte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: false }).limit(5);
    if (!entitlementError) {
      const active = (entitlements ?? []).find((row) => !row.ends_at || Date.parse(row.ends_at) > Date.now());
      const relation = active?.payment_plans as unknown as { plan_code?: string; name?: string } | { plan_code?: string; name?: string }[] | undefined;
      const activePlan = Array.isArray(relation) ? relation[0] : relation;
      const code = activePlan?.plan_code;
      if (code && ['lite', 'pro', 'max'].includes(code)) {
        const { data: packRows, error: packError } = await client.from('payment_plans')
          .select('id,slug,plan_code,name,description,kind,price_dzd,unified_credits,active,display_order,featured,access_period_days,public_visible,entitlement')
          .eq('kind', 'credit_pack').eq('active', true).order('display_order');
        if (!packError) {
          const { data: approvedOrders, error: ordersError } = await client.from('payment_orders')
            .select('plan_id').eq('user_id', user.id).eq('order_kind', 'credit_pack')
            .eq('status', 'approved').gte('reviewed_at', active!.starts_at);
          const liteRemaining = code === 'lite' ? liteTopUpsRemaining(ordersError ? 2 : (approvedOrders?.length ?? 0)) : null;
          const activePlanCode = code as PaidTopUpPlanCode;
          topUp = {
            activePlanCode,
            activePlanName: typeof activePlan?.name === 'string' ? activePlan.name : code.toUpperCase(),
            liteRemaining,
            reason: activePlanCode === 'lite' && liteRemaining === 0 ? 'LITE_TOP_UP_LIMIT_REACHED' : null,
          };
          const approvedByPack = new Map<string, number>();
          for (const order of approvedOrders ?? []) approvedByPack.set(order.plan_id, (approvedByPack.get(order.plan_id) ?? 0) + 1);
          creditPacks = (ordersError ? [] : eligibleTopUpRows(packRows ?? [], activePlanCode, liteRemaining))
            .filter((pack) => { const limit = topUpPackLimit(pack.entitlement); return limit == null || (approvedByPack.get(pack.id) ?? 0) < limit; })
            .map((pack) => ({ id: pack.id, slug: pack.slug, planCode: pack.plan_code ?? pack.slug,
            name: pack.name, description: pack.description, kind: pack.kind,
            priceDzd: pack.price_dzd, unifiedCredits: Number(pack.unified_credits),
            active: pack.active, displayOrder: pack.display_order, featured: pack.featured,
            accessPeriodDays: pack.access_period_days, publicVisible: pack.public_visible,
            purchasesRemaining: topUpPackLimit(pack.entitlement) == null ? null : Math.max(0, topUpPackLimit(pack.entitlement)! - (approvedByPack.get(pack.id) ?? 0)) }));
        }
      }
    }
  }
  let proOutcomeEstimates = { image: null, video: null } as {
    image: ReturnType<typeof estimatePlanOutcomes>;
    video: ReturnType<typeof estimatePlanOutcomes>;
  };
  if (pro) {
    try {
      const models = await getEffectiveRuntimeModels(client);
      proOutcomeEstimates = {
        image: estimatePlanOutcomes(models, 'pro', 'image', pro.unifiedCredits),
        video: estimatePlanOutcomes(models, 'pro', 'video', pro.unifiedCredits),
      };
    } catch {
      // The public catalog remains available if model presentation data is temporarily unavailable.
    }
  }
  return NextResponse.json({
    plans, creditPacks, topUp, proOutcomeEstimates,
    gatewayAvailability: {
      baridimob: PAYMENT_GATEWAYS.baridimob.isConfigured(),
      ccp: PAYMENT_GATEWAYS.ccp.isConfigured(),
      edahabia: PAYMENT_GATEWAYS.edahabia.isConfigured(),
      cib: PAYMENT_GATEWAYS.cib.isConfigured(),
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
