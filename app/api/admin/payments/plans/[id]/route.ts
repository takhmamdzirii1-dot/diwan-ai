import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getOwnerAccess } from '@/lib/auth/owner';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';

const schema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{1,80}$/), name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  kind: z.enum(['credit_pack', 'subscription']), priceDzd: z.number().int().positive().safe(),
  unifiedCredits: z.number().int().positive().safe(),
  subscriptionCreditAllowance: z.number().int().positive().safe().nullable().optional().default(null), active: z.boolean(),
  includedVideoAllowance: z.number().int().min(0).max(4).nullable().optional().default(null),
  displayOrder: z.number().int().min(-10000).max(10000), featured: z.boolean(),
  publicVisible: z.boolean().optional(), eligibilityRequired: z.boolean().optional(),
}).superRefine((plan, context) => {
  if ((plan.slug === 'lite') !== (plan.includedVideoAllowance !== null)) {
    context.addIssue({ code: 'custom', path: ['includedVideoAllowance'], message: 'Lite requires an included-video allowance; other plans must leave it empty.' });
  }
  if ((plan.slug === 'lite') !== (plan.subscriptionCreditAllowance !== null)
    || (plan.slug === 'lite' && plan.subscriptionCreditAllowance !== plan.unifiedCredits)) {
    context.addIssue({ code: 'custom', path: ['subscriptionCreditAllowance'], message: 'Lite subscription Credits must be positive and match order Credits; other plans must leave them empty.' });
  }
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
  const { data: existing, error: readError } = await client.from('payment_plans').select('slug,plan_code').eq('id', id).maybeSingle();
  if (readError) return NextResponse.json({ error: 'PAYMENT_PLAN_UPDATE_FAILED' }, { status: 409 });
  if (!existing) return NextResponse.json({ error: 'PAYMENT_PLAN_NOT_FOUND' }, { status: 404 });
  if (existing.slug !== plan.slug) return NextResponse.json({ error: 'PAYMENT_PLAN_SLUG_IMMUTABLE' }, { status: 409 });
  const { data, error } = await client.from('payment_plans').update({
    name: plan.name, description: plan.description || null, kind: plan.kind,
    price_dzd: plan.priceDzd, unified_credits: plan.unifiedCredits,
    ...(existing.plan_code === 'lite' ? { subscription_credit_allowance: plan.subscriptionCreditAllowance } : {}),
    included_video_allowance: plan.includedVideoAllowance, active: plan.active,
    display_order: plan.displayOrder, featured: plan.featured,
    ...(plan.publicVisible === undefined ? {} : { public_visible: plan.publicVisible }),
    ...(plan.eligibilityRequired === undefined ? {} : { eligibility_required: plan.eligibilityRequired }),
    updated_by: access.user.id,
  }).eq('id', id).select('id,slug,name,description,kind,price_dzd,unified_credits,subscription_credit_allowance,included_video_allowance,active,display_order,featured,public_visible,eligibility_required,frozen').maybeSingle();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'PAYMENT_PLAN_SLUG_EXISTS' : 'PAYMENT_PLAN_UPDATE_FAILED' }, { status: 409 });
  if (!data) return NextResponse.json({ error: 'PAYMENT_PLAN_NOT_FOUND' }, { status: 404 });
  revalidatePath('/admin/payments');
  revalidatePath('/admin/audit');
  revalidatePath('/en'); revalidatePath('/fr'); revalidatePath('/ar');
  return NextResponse.json({ plan: {
    id: data.id, slug: data.slug, name: data.name, description: data.description,
    kind: data.kind, priceDzd: data.price_dzd, unifiedCredits: Number(data.unified_credits),
    subscriptionCreditAllowance: data.subscription_credit_allowance == null ? null : Number(data.subscription_credit_allowance),
    includedVideoAllowance: data.included_video_allowance == null ? null : Number(data.included_video_allowance),
    active: data.active, displayOrder: data.display_order, featured: data.featured,
    publicVisible: data.public_visible, eligibilityRequired: data.eligibility_required, frozen: data.frozen,
  } });
}
