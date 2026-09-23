import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { createClient } from '@/src/lib/supabase/server';
import type { PaymentPlan } from '@/lib/payments/types';
import { getStudioAccess } from '@/lib/access/trial-access';

export const dynamic = 'force-dynamic';

type PlanRelation = {
  id: string;
  plan_code: string | null;
  slug: string;
  name: string;
  description: string | null;
  kind: 'credit_pack' | 'subscription';
  price_dzd: number;
  unified_credits: number | string;
  active: boolean;
  display_order: number;
  featured: boolean;
  access_period_days: number | null;
  public_visible: boolean;
} | null;

function toPaymentPlan(plan: NonNullable<PlanRelation>): PaymentPlan {
  return {
    id: plan.id,
    slug: plan.slug,
    planCode: plan.plan_code ?? plan.slug,
    name: plan.name,
    description: plan.description,
    kind: plan.kind,
    priceDzd: plan.price_dzd,
    unifiedCredits: Number(plan.unified_credits),
    active: plan.active,
    displayOrder: plan.display_order,
    featured: plan.featured,
    accessPeriodDays: plan.access_period_days,
    publicVisible: plan.public_visible,
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'PAYMENT_CATALOG_UNAVAILABLE' }, { status: 503 });
  }

  const { data, error } = await admin
    .from('user_entitlements')
    .select('starts_at,payment_plans!inner(id,plan_code,slug,name,description,kind,price_dzd,unified_credits,active,display_order,featured,access_period_days,public_visible)')
    .eq('user_id', user.id)
    .order('starts_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: 'PAYMENT_CATALOG_UNAVAILABLE' }, { status: 503 });
  }

  const historicalPlans = (data ?? [])
    .map((row) => {
      const relation = row.payment_plans as unknown as PlanRelation | PlanRelation[];
      return Array.isArray(relation) ? relation[0] : relation;
    })
    .filter((plan): plan is NonNullable<PlanRelation> => Boolean(plan));
  const returningPaidEligible = historicalPlans.some((plan) => ['lite', 'pro', 'max'].includes(plan.plan_code ?? ''));
  const latest = historicalPlans[0] ?? null;

  // Lite stays hidden in the acquisition funnel until the user explicitly
  // declines Pro. Returning paid eligibility remains unchanged.
  let acquisitionEligible = false;
  if (!returningPaidEligible) {
    const [{ data: decline }, access] = await Promise.all([
      admin.from('admin_audit_log')
        .select('id')
        .eq('actor_user_id', user.id)
        .eq('resource_type', 'user_funnel')
        .eq('action', 'pro_declined')
        .limit(1)
        .maybeSingle(),
      getStudioAccess(user).catch(() => null),
    ]);
    acquisitionEligible = Boolean(decline && (access?.kind === 'trial_active' || access?.kind === 'trial_expired') && !access.hasSeenLiteOffer);
  }
  const eligible = returningPaidEligible || acquisitionEligible;

  let liteOffer: PaymentPlan | null = null;
  if (eligible) {
    const { data: lite, error: liteError } = await admin
      .from('payment_plans')
      .select('id,plan_code,slug,name,description,kind,price_dzd,unified_credits,active,display_order,featured,access_period_days,public_visible')
      .eq('plan_code', 'lite')
      .eq('active', true)
      .eq('public_visible', false)
      .eq('eligibility_required', true)
      .maybeSingle();
    if (liteError) {
      return NextResponse.json({ error: 'PAYMENT_CATALOG_UNAVAILABLE' }, { status: 503 });
    }
    if (lite) liteOffer = toPaymentPlan(lite as NonNullable<PlanRelation>);
  }

  const renewalPlanId = latest?.active ? latest.id : null;
  return NextResponse.json(
    { liteOffer, renewalPlanId },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
