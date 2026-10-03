import { NextResponse } from 'next/server';
import { mediaUser, MEDIA_PRIVATE_HEADERS } from '@/lib/ai/media-api.server';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { requireMediaGenerationAccess } from '@/lib/access/trial-access';
import { resolveRuntimeModelAccess } from '@/lib/models/plan-entitlements.server';
import { modelPlanErrorPayload } from '@/lib/models/plan-entitlements';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await mediaUser(request);
  if (!user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const modality = params.get('modality');
  if (modality !== 'image' && modality !== 'video') return NextResponse.json({ error: 'INVALID_MODALITY' }, { status: 400 });
  try {
    await requireMediaGenerationAccess(user);
    const { model, currentPlan } = await resolveRuntimeModelAccess(user.id, params.get('modelId') ?? '', modality);
    if (model.customerCreditPrice == null) throw new Error('MODEL_CUSTOMER_PRICE_UNCONFIGURED');
    const admin = getSupabaseAdminClient();
    if (!admin) throw new Error('CREDIT_ACCOUNT_UNAVAILABLE');
    const account = await admin.from('credits').select('balance,free_image_remaining,free_video_remaining,lite_video_remaining').eq('user_id', user.id).maybeSingle();
    if (account.error || !account.data) throw new Error('CREDIT_ACCOUNT_UNAVAILABLE');
    const remaining = currentPlan === 'free' ? Number(modality === 'image' ? account.data.free_image_remaining : account.data.free_video_remaining)
      : currentPlan === 'lite' && modality === 'video' ? Number(account.data.lite_video_remaining) : null;
    const cost = remaining == null ? model.customerCreditPrice : 0;
    if (remaining !== null && remaining <= 0) {
      const error = currentPlan === 'lite' ? 'LITE_VIDEO_ALLOWANCE_EXHAUSTED'
        : modality === 'image' ? 'FREE_IMAGE_TRIAL_EXHAUSTED' : 'FREE_VIDEO_TRIAL_EXHAUSTED';
      return NextResponse.json({ error }, { status: 409, headers: MEDIA_PRIVATE_HEADERS });
    }
    return NextResponse.json({ credits: cost, catalogCredits: model.customerCreditPrice, balance: Number(account.data.balance), allowanceRemaining: remaining,
      canGenerate: remaining == null ? Number(account.data.balance) >= cost : remaining > 0 }, { headers: MEDIA_PRIVATE_HEADERS });
  } catch (cause) {
    const access = modelPlanErrorPayload(cause);
    const code = cause instanceof Error ? cause.message : 'GENERATION_QUOTE_UNAVAILABLE';
    const allowed = /^(?:FREE_ACCESS_RESTRICTED|PAID_PLAN_REACTIVATION_REQUIRED|MODEL_CUSTOMER_PRICE_UNCONFIGURED|MODEL_TRIAL_UNCONFIGURED|CREDIT_ACCOUNT_UNAVAILABLE|MODEL_NOT_AVAILABLE)$/;
    return NextResponse.json(access ?? { error: allowed.test(code) ? code : 'GENERATION_QUOTE_UNAVAILABLE' }, { status: 409, headers: MEDIA_PRIVATE_HEADERS });
  }
}
