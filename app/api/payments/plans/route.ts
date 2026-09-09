import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'PAYMENT_CATALOG_UNAVAILABLE' }, { status: 503 });
  const { data, error } = await client.from('payment_plans')
    .select('id,slug,name,description,kind,price_dzd,unified_credits,active,display_order,featured')
    .eq('active', true).order('display_order').order('created_at');
  if (error) {
    console.error('[payments] plan catalog failed', { code: error.code });
    return NextResponse.json({ error: 'PAYMENT_CATALOG_UNAVAILABLE' }, { status: 503 });
  }
  return NextResponse.json({ plans: (data ?? []).map((plan) => ({
    id: plan.id, slug: plan.slug, name: plan.name, description: plan.description,
    kind: plan.kind, priceDzd: plan.price_dzd, unifiedCredits: Number(plan.unified_credits),
    active: plan.active, displayOrder: plan.display_order, featured: plan.featured,
  })) });
}
