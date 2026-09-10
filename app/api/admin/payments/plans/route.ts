import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getOwnerAccess } from '@/lib/auth/owner';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';

const schema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{1,80}$/), name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  kind: z.enum(['credit_pack', 'subscription']).default('credit_pack'),
  priceDzd: z.number().int().positive().safe(), unifiedCredits: z.number().int().positive().safe(),
  active: z.boolean(), displayOrder: z.number().int().min(-10000).max(10000), featured: z.boolean(),
});

const reorderSchema = z.object({ orderedIds: z.array(z.string().uuid()).min(1).max(1000) })
  .refine(({ orderedIds }) => new Set(orderedIds).size === orderedIds.length);

function serializePlan(data: any) {
  return {
    id: data.id, slug: data.slug, name: data.name, description: data.description,
    kind: data.kind, priceDzd: data.price_dzd, unifiedCredits: Number(data.unified_credits),
    active: data.active, displayOrder: data.display_order, featured: data.featured,
  };
}

export async function POST(request: Request) {
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_PAYMENT_PLAN' }, { status: 400 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const plan = parsed.data;
  const { data, error } = await client.from('payment_plans').insert({
    slug: plan.slug, name: plan.name, description: plan.description || null, kind: plan.kind,
    price_dzd: plan.priceDzd, unified_credits: plan.unifiedCredits, active: plan.active,
    display_order: plan.displayOrder, featured: plan.featured,
  }).select('id,slug,name,description,kind,price_dzd,unified_credits,active,display_order,featured').single();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'PAYMENT_PLAN_SLUG_EXISTS' : 'PAYMENT_PLAN_CREATE_FAILED' }, { status: 409 });
  revalidatePath('/admin/payments');
  revalidatePath('/en'); revalidatePath('/fr'); revalidatePath('/ar');
  return NextResponse.json({ plan: serializePlan(data) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const parsed = reorderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_PLAN_ORDER' }, { status: 400 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const { data, error } = await client.rpc('admin_reorder_payment_plans', { p_ordered_ids: parsed.data.orderedIds });
  if (error || !data) {
    console.error('[admin plans] reorder failed', { code: error?.code });
    return NextResponse.json({ error: 'PLAN_REORDER_FAILED' }, { status: 409 });
  }
  revalidatePath('/admin/payments');
  revalidatePath('/en'); revalidatePath('/fr'); revalidatePath('/ar');
  return NextResponse.json({ plans: data.map(serializePlan) });
}
