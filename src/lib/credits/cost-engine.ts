/**
 * Server-side, provider-agnostic cost calculations for the inactive Phase 8B
 * financial engine. Production pricing is intentionally empty until verified
 * commercial inputs are supplied.
 */

export type CostModality = 'chat' | 'image' | 'video';

export type UsageUnits = {
  inputTokens?: bigint;
  outputTokens?: bigint;
  cachedTokens?: bigint;
  images?: bigint;
  megapixelsMicros?: bigint;
  videos?: bigint;
  videoSeconds?: bigint;
};

export type PricingRates = {
  inputTokensPerMillionMinor?: bigint;
  outputTokensPerMillionMinor?: bigint;
  cachedTokensPerMillionMinor?: bigint;
  perImageMinor?: bigint;
  perMegapixelMinor?: bigint;
  perVideoMinor?: bigint;
  perVideoSecondMinor?: bigint;
};

export type ModelPricing = {
  modelId: string;
  provider: string;
  providerModel: string;
  modality: CostModality;
  version: string;
  currency: string;
  creditValueMinor: bigint;
  minimumMarginBps: bigint;
  rates: PricingRates;
};

export type CostQuote = {
  modelId: string;
  pricingVersion: string;
  currency: string;
  providerCostMinor: bigint;
  creditsRequired: bigint;
  creditRevenueMinor: bigint;
  marginMinor: bigint;
  marginBps: bigint;
};

export class UnknownPricingError extends Error {
  constructor(modelId: string) {
    super(`No verified pricing exists for model: ${modelId}`);
    this.name = 'UnknownPricingError';
  }
}

export class UnsupportedUsageError extends Error {
  constructor(unit: keyof UsageUnits, modelId: string) {
    super(`Pricing for ${modelId} does not support usage unit: ${unit}`);
    this.name = 'UnsupportedUsageError';
  }
}

export class MarginProtectionError extends Error {
  constructor() {
    super('The quoted credits do not satisfy the configured minimum margin');
    this.name = 'MarginProtectionError';
  }
}

const MILLION = 1_000_000n;
const BASIS_POINTS = 10_000n;

const ceilDivide = (value: bigint, divisor: bigint) => {
  if (divisor <= 0n) throw new RangeError('Divisor must be positive');
  return value === 0n ? 0n : (value + divisor - 1n) / divisor;
};

const readUnit = (usage: UsageUnits, unit: keyof UsageUnits) => {
  const value = usage[unit] ?? 0n;
  if (value < 0n) throw new RangeError(`${unit} cannot be negative`);
  return value;
};

const chargeScaled = (
  usage: UsageUnits,
  unit: keyof UsageUnits,
  rate: bigint | undefined,
  scale: bigint,
  modelId: string,
) => {
  const quantity = readUnit(usage, unit);
  if (quantity === 0n) return 0n;
  if (rate === undefined) throw new UnsupportedUsageError(unit, modelId);
  if (rate < 0n) throw new RangeError(`Rate for ${unit} cannot be negative`);
  return ceilDivide(quantity * rate, scale);
};

export class CostEngine {
  private readonly pricingByModel: ReadonlyMap<string, ModelPricing>;

  constructor(pricing: readonly ModelPricing[]) {
    this.pricingByModel = new Map(pricing.map((entry) => [entry.modelId, entry]));
    if (this.pricingByModel.size !== pricing.length) {
      throw new Error('Duplicate model pricing entry');
    }
  }

  requirePricing(modelId: string) {
    const pricing = this.pricingByModel.get(modelId);
    if (!pricing) throw new UnknownPricingError(modelId);
    if (pricing.creditValueMinor <= 0n) throw new RangeError('creditValueMinor must be positive');
    if (pricing.minimumMarginBps < 0n || pricing.minimumMarginBps >= BASIS_POINTS) {
      throw new RangeError('minimumMarginBps must be between 0 and 9999');
    }
    if (!/^[A-Z]{3}$/.test(pricing.currency)) throw new RangeError('currency must be an ISO-style code');
    return pricing;
  }

  calculateProviderCost(modelId: string, usage: UsageUnits) {
    const pricing = this.requirePricing(modelId);
    const rates = pricing.rates;

    const cost =
      chargeScaled(usage, 'inputTokens', rates.inputTokensPerMillionMinor, MILLION, modelId) +
      chargeScaled(usage, 'outputTokens', rates.outputTokensPerMillionMinor, MILLION, modelId) +
      chargeScaled(usage, 'cachedTokens', rates.cachedTokensPerMillionMinor, MILLION, modelId) +
      chargeScaled(usage, 'images', rates.perImageMinor, 1n, modelId) +
      chargeScaled(usage, 'megapixelsMicros', rates.perMegapixelMinor, MILLION, modelId) +
      chargeScaled(usage, 'videos', rates.perVideoMinor, 1n, modelId) +
      chargeScaled(usage, 'videoSeconds', rates.perVideoSecondMinor, 1n, modelId);

    const hasUsage = Object.keys(usage).some((key) => readUnit(usage, key as keyof UsageUnits) > 0n);
    if (!hasUsage) throw new RangeError('At least one positive usage unit is required');
    return cost;
  }

  quote(modelId: string, usage: UsageUnits): CostQuote {
    const pricing = this.requirePricing(modelId);
    const providerCostMinor = this.calculateProviderCost(modelId, usage);
    const requiredRevenueMinor = ceilDivide(
      providerCostMinor * BASIS_POINTS,
      BASIS_POINTS - pricing.minimumMarginBps,
    );
    const creditsRequired = ceilDivide(requiredRevenueMinor, pricing.creditValueMinor);
    const creditRevenueMinor = creditsRequired * pricing.creditValueMinor;
    const marginMinor = creditRevenueMinor - providerCostMinor;
    const marginBps = creditRevenueMinor === 0n
      ? 0n
      : (marginMinor * BASIS_POINTS) / creditRevenueMinor;

    if (providerCostMinor > 0n && marginBps < pricing.minimumMarginBps) {
      throw new MarginProtectionError();
    }

    return {
      modelId,
      pricingVersion: pricing.version,
      currency: pricing.currency,
      providerCostMinor,
      creditsRequired,
      creditRevenueMinor,
      marginMinor,
      marginBps,
    };
  }

  verifyActualCost(modelId: string, usage: UsageUnits, creditsCharged: bigint): CostQuote {
    if (creditsCharged < 0n) throw new RangeError('creditsCharged cannot be negative');
    const pricing = this.requirePricing(modelId);
    const providerCostMinor = this.calculateProviderCost(modelId, usage);
    const creditRevenueMinor = creditsCharged * pricing.creditValueMinor;
    const marginMinor = creditRevenueMinor - providerCostMinor;
    const marginBps = creditRevenueMinor === 0n
      ? (providerCostMinor === 0n ? 0n : -BASIS_POINTS)
      : (marginMinor * BASIS_POINTS) / creditRevenueMinor;

    if (providerCostMinor > 0n && marginBps < pricing.minimumMarginBps) {
      throw new MarginProtectionError();
    }

    return {
      modelId,
      pricingVersion: pricing.version,
      currency: pricing.currency,
      providerCostMinor,
      creditsRequired: creditsCharged,
      creditRevenueMinor,
      marginMinor,
      marginBps,
    };
  }
}

// Deliberately empty: production pricing must be verified before activation.
export const productionCostEngine = new CostEngine([]);
