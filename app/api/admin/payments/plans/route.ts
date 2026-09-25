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
  includedVideoAllowance: z.number().int().min(0).max(4).nullable().optional().default(null),
  active: z.boolean(), displayOrder: z.number().int().min(-10000).max(10000), featured: z.boolean(),
  topUpPlanCode: z.enum(['lite', 'pro', 'max']).optional(),
  topUpPurchaseLimitPerPeriod: z.number().int().min(1).max(1000).nullable().optional(),
}).superRefine((plan, context) => {
  if (plan.kind === 'credit_pack' && (!plan.topUpPlanCode || (plan.topUpPlanCode === 'lite' && plan.topUpPurchaseLimitPerPeriod != null && plan.topUpPurchaseLimitPerPeriod > 2))) {
    context.addIssue({ code: 'custom', path: ['topUpPlanCode'], message: 'A credit pack requires one paid plan; Lite allows at most two purchases per period.' });
  }
  if ((plan.slug === 'lite') !== (plan.includedVideoAllowance !== null)) {
    context.addIssue({ code: 'custom', path: ['includedVideoAllowance'], message: 'Lite requires an included-video allowance; other plans must leave it empty.' });
  }
});

const reorderSchema = z.object({ orderedIds: z.array(z.string().uuid()).min(1).max(1000) })
  .refine(({ orderedIds }) => new Set(orderedIds).size === orderedIds.length);

function serializePlan(data: any) {
  return {
    id: data.id, slug: data.slug, name: data.name, description: data.description,
    kind: data.kind, priceDzd: data.price_dzd, unifiedCredits: Number(data.unified_credits),
    subscriptionCreditAllowance: data.subscription_credit_allowance == null ? null : Number(data.subscription_credit_allowance),
    includedVideoAllowance: data.included_video_allowance == null ? null : Number(data.included_video_allowance),
    active: data.active, displayOrder: data.display_order, featured: data.featured,
    topUpPlanCode: data.entitlement?.top_up_plan_code ?? null,
    topUpPurchaseLimitPerPeriod: data.entitlement?.top_up_purchase_limit_per_period ?? null,
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
    price_dzd: plan.priceDzd, unified_credits: plan.unifiedCredits,
    included_video_allowance: plan.includedVideoAllowance, active: plan.active,
    ...(plan.kind === 'credit_pack' ? { entitlement: { top_up_plan_code: plan.topUpPlanCode, ...(plan.topUpPurchaseLimitPerPeriod == null ? {} : { top_up_purchase_limit_per_period: plan.topUpPurchaseLimitPerPeriod }) } } : {}),
    display_order: plan.displayOrder, featured: plan.featured, updated_by: access.user.id,
  }).select('id,slug,name,description,kind,price_dzd,unified_credits,subscription_credit_allowance,included_video_allowance,active,display_order,featured,entitlement').single();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'PAYMENT_PLAN_SLUG_EXISTS' : 'PAYMENT_PLAN_CREATE_FAILED' }, { status: 409 });
  revalidatePath('/admin/payments');
  revalidatePath('/admin/audit');
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
  const { data, error } = await client.rpc('admin_reorder_payment_plans', {
    p_ordered_ids: parsed.data.orderedIds,
    p_actor_user_id: access.user.id,
  });
  if (error || !data) {
    console.error('[admin plans] reorder failed', { code: error?.code });
    return NextResponse.json({ error: 'PLAN_REORDER_FAILED' }, { status: 409 });
  }
  revalidatePath('/admin/payments');
  revalidatePath('/admin/audit');
  revalidatePath('/en'); revalidatePath('/fr'); revalidatePath('/ar');
  return NextResponse.json({ plans: data.map(serializePlan) });
}
