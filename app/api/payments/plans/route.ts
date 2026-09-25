import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { getEffectiveRuntimeModels } from '@/lib/models/runtime-config';
import { estimatePlanOutcomes } from '@/lib/payments/outcome-estimates';
import { PAYMENT_GATEWAYS } from '@/lib/payments/gateways';
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
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (user) {
    const { data: entitlements, error: entitlementError } = await client.from('user_entitlements')
      .select('starts_at,ends_at,payment_plans!inner(plan_code)')
      .eq('user_id', user.id).eq('status', 'active').lte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: false }).limit(5);
    if (!entitlementError) {
      const active = (entitlements ?? []).find((row) => !row.ends_at || Date.parse(row.ends_at) > Date.now());
      const relation = active?.payment_plans as unknown as { plan_code?: string } | { plan_code?: string }[] | undefined;
      const code = Array.isArray(relation) ? relation[0]?.plan_code : relation?.plan_code;
      if (code && ['lite', 'pro', 'max'].includes(code)) {
        const { data: packRows, error: packError } = await client.from('payment_plans')
          .select('id,slug,plan_code,name,description,kind,price_dzd,unified_credits,active,display_order,featured,access_period_days,public_visible,entitlement')
          .eq('kind', 'credit_pack').eq('active', true).order('display_order');
        if (!packError) {
          let liteRemaining = 2;
          if (code === 'lite') {
            const { count } = await client.from('payment_orders').select('id', { count: 'exact', head: true })
              .eq('user_id', user.id).eq('order_kind', 'credit_pack').eq('status', 'approved')
              .gte('reviewed_at', active!.starts_at);
            liteRemaining = Math.max(0, 2 - (count ?? 2));
          }
          creditPacks = (packRows ?? []).filter((pack) => {
            const eligible = (pack.entitlement as { top_up_plan_code?: string } | null)?.top_up_plan_code;
            return code === 'max' ? !eligible || eligible === 'max' : liteRemaining > 0 && eligible === code;
          }).map((pack) => ({ id: pack.id, slug: pack.slug, planCode: pack.plan_code ?? pack.slug,
            name: pack.name, description: pack.description, kind: pack.kind,
            priceDzd: pack.price_dzd, unifiedCredits: Number(pack.unified_credits),
            active: pack.active, displayOrder: pack.display_order, featured: pack.featured,
            accessPeriodDays: pack.access_period_days, publicVisible: pack.public_visible }));
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
    plans, creditPacks, proOutcomeEstimates,
    gatewayAvailability: {
      baridimob: PAYMENT_GATEWAYS.baridimob.isConfigured(),
      ccp: PAYMENT_GATEWAYS.ccp.isConfigured(),
      edahabia: PAYMENT_GATEWAYS.edahabia.isConfigured(),
      cib: PAYMENT_GATEWAYS.cib.isConfigured(),
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
