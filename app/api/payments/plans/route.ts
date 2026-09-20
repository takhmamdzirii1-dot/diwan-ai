import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';

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
  return NextResponse.json({ plans: (data ?? []).map((plan) => ({
    id: plan.id, slug: plan.slug, planCode: plan.plan_code, name: plan.name, description: plan.description,
    kind: plan.kind, priceDzd: plan.price_dzd, unifiedCredits: Number(plan.unified_credits),
    active: plan.active, displayOrder: plan.display_order, featured: plan.featured,
    accessPeriodDays: plan.access_period_days, publicVisible: plan.public_visible,
  })) });
}
