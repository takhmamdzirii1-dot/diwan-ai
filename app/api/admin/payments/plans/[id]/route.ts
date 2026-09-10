import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getOwnerAccess } from '@/lib/auth/owner';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';

const schema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{1,80}$/), name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  kind: z.enum(['credit_pack', 'subscription']), priceDzd: z.number().int().positive().safe(),
  unifiedCredits: z.number().int().positive().safe(), active: z.boolean(),
  displayOrder: z.number().int().min(-10000).max(10000), featured: z.boolean(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_PAYMENT_PLAN' }, { status: 400 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'INVALID_PAYMENT_PLAN' }, { status: 400 });
  const plan = parsed.data;
  const { data: existing, error: readError } = await client.from('payment_plans').select('slug').eq('id', id).maybeSingle();
  if (readError) return NextResponse.json({ error: 'PAYMENT_PLAN_UPDATE_FAILED' }, { status: 409 });
  if (!existing) return NextResponse.json({ error: 'PAYMENT_PLAN_NOT_FOUND' }, { status: 404 });
  if (existing.slug !== plan.slug) return NextResponse.json({ error: 'PAYMENT_PLAN_SLUG_IMMUTABLE' }, { status: 409 });
  const { data, error } = await client.from('payment_plans').update({
    name: plan.name, description: plan.description || null, kind: plan.kind,
    price_dzd: plan.priceDzd, unified_credits: plan.unifiedCredits, active: plan.active,
    display_order: plan.displayOrder, featured: plan.featured,
  }).eq('id', id).select('id,slug,name,description,kind,price_dzd,unified_credits,active,display_order,featured').maybeSingle();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'PAYMENT_PLAN_SLUG_EXISTS' : 'PAYMENT_PLAN_UPDATE_FAILED' }, { status: 409 });
  if (!data) return NextResponse.json({ error: 'PAYMENT_PLAN_NOT_FOUND' }, { status: 404 });
  revalidatePath('/admin/payments');
  revalidatePath('/en'); revalidatePath('/fr'); revalidatePath('/ar');
  return NextResponse.json({ plan: {
    id: data.id, slug: data.slug, name: data.name, description: data.description,
    kind: data.kind, priceDzd: data.price_dzd, unifiedCredits: Number(data.unified_credits),
    active: data.active, displayOrder: data.display_order, featured: data.featured,
  } });
}
