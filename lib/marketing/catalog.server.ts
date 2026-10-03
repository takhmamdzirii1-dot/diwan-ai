import 'server-only';
import { cache } from 'react';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { getEffectiveRuntimeModels } from '@/lib/models/runtime-config';
import { PAYMENT_GATEWAYS } from '@/lib/payments/gateways';
import { estimatePlanOutcomes } from '@/lib/payments/outcome-estimates';
import { landingModelPresentation, type LandingCatalog } from '@/src/content/landing-catalog';

/** Build-time snapshot of the same authoritative catalog used by checkout.
 * No cookies, user data, runtime fetch from the browser or alternate price constants.
 * Failed reads fail the build rather than publishing invented/unavailable prices.
 */
export const loadLandingCatalog = cache(async (): Promise<LandingCatalog> => {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('LANDING_CATALOG_CONFIGURATION_REQUIRED');
  const [{ data, error }, models] = await Promise.all([
    client.from('payment_plans')
      .select('id,slug,plan_code,name,description,kind,price_dzd,unified_credits,active,display_order,featured,access_period_days,public_visible')
      .eq('public_visible', true).in('plan_code', ['free', 'pro', 'max'])
      .or('active.eq.true,plan_code.eq.free').order('display_order').order('created_at'),
    getEffectiveRuntimeModels(client),
  ]);
  if (error || !data) throw new Error('LANDING_CATALOG_READ_FAILED');
  if (data.some((plan) => plan.price_dzd == null || plan.unified_credits == null)) {
    throw new Error('LANDING_CATALOG_INVALID');
  }
  const plans = data.map((plan) => ({
    id: plan.id, slug: plan.slug, planCode: plan.plan_code, name: plan.name,
    description: plan.description, kind: plan.kind, priceDzd: Number(plan.price_dzd),
    unifiedCredits: Number(plan.unified_credits), active: plan.active,
    displayOrder: plan.display_order, featured: plan.featured,
    accessPeriodDays: plan.access_period_days, publicVisible: plan.public_visible,
  }));
  if (plans.some((plan) => !Number.isSafeInteger(plan.priceDzd) || plan.priceDzd < 0
    || !Number.isSafeInteger(plan.unifiedCredits) || plan.unifiedCredits < 0)) {
    throw new Error('LANDING_CATALOG_INVALID');
  }
  const pro = plans.find((plan) => plan.planCode === 'pro');
  return {
    plans,
    ...landingModelPresentation(models),
    modelAccessCounts: Object.fromEntries(['free', 'pro', 'max'].map(code => [code,
      models.filter(model => model.enabled && model.visibleInStudio && !model.archived
        && model.planAccess[code as 'free' | 'pro' | 'max'].state !== 'locked').length,
    ])) as Record<'free' | 'pro' | 'max', number>,
    proEstimates: {
      image: pro ? estimatePlanOutcomes(models, 'pro', 'image', pro.unifiedCredits) : null,
      video: pro ? estimatePlanOutcomes(models, 'pro', 'video', pro.unifiedCredits) : null,
    },
    gateways: {
      baridimob: PAYMENT_GATEWAYS.baridimob.isConfigured(),
      ccp: PAYMENT_GATEWAYS.ccp.isConfigured(),
      edahabia: PAYMENT_GATEWAYS.edahabia.isConfigured(),
      cib: PAYMENT_GATEWAYS.cib.isConfigured(),
    },
  };
});
