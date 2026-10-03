import type { PaymentPlan } from '@/lib/payments/types';
import type { OutcomeEstimate } from '@/lib/payments/outcome-estimates';
import { modelBrand, modelIconUrl } from '@/src/config/model-catalog';

export type GatewayAvailability = Record<'baridimob' | 'ccp' | 'edahabia' | 'cib', boolean>;
export type LandingBrand = { name: string; iconUrl: string };
export type LandingCatalog = {
  plans: PaymentPlan[];
  modelNames: string[];
  brands: LandingBrand[];
  proEstimates: { image: OutcomeEstimate; video: OutcomeEstimate };
  gateways: GatewayAvailability;
  modelAccessCounts?: Record<'free' | 'pro' | 'max', number>;
};

/** Public presentation only; never serialize routing, pricing internals or credentials. */
export function landingModelPresentation(models: readonly {
  displayName: string; modality: 'chat' | 'image' | 'video'; modelId: string;
  category: string | null; enabled: boolean; visibleInStudio: boolean; archived: boolean;
}[]) {
  const enabled = models.filter((model) => model.enabled && model.visibleInStudio && !model.archived);
  const brands = new Map<string, LandingBrand>();
  for (const model of enabled) {
    const brand = modelBrand(model.displayName, model.modality, null, model.modelId, model.category);
    const iconUrl = modelIconUrl(brand);
    if (iconUrl) brands.set(brand.name, { name: brand.name, iconUrl });
  }
  return { modelNames: [...new Set(enabled.map((model) => model.displayName))], brands: [...brands.values()] };
}
