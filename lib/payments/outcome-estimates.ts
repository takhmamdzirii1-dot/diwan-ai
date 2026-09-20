type PricedModel = {
  modality: string;
  customerCreditPrice: number | null;
  enabled: boolean;
  archived: boolean;
  visibleInStudio: boolean;
  allowedPlans: readonly string[];
};

export type OutcomeEstimate = { min: number; max: number } | null;

export function estimatePlanOutcomes(
  models: readonly PricedModel[],
  planCode: string,
  modality: 'image' | 'video',
  allowance: number
): OutcomeEstimate {
  const prices = models
    .filter((model) => model.modality === modality
      && model.enabled
      && !model.archived
      && model.visibleInStudio
      && model.allowedPlans.includes(planCode)
      && Number.isSafeInteger(model.customerCreditPrice)
      && (model.customerCreditPrice ?? 0) > 0)
    .map((model) => model.customerCreditPrice as number);
  if (!prices.length || allowance <= 0) return null;
  return {
    min: Math.floor(allowance / Math.max(...prices)),
    max: Math.floor(allowance / Math.min(...prices)),
  };
}
