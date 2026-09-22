import { MODEL_BRANDS, type ModelBrandId } from '@/src/config/model-catalog';

/** Paid-ads landing variants served at /[locale]/go/[variant]. */
export const GO_VARIANTS = ['all-ai', 'ai-in-dzd', 'creators'] as const;
export type GoVariant = (typeof GO_VARIANTS)[number];

export function isGoVariant(value: string | undefined | null): value is GoVariant {
  return GO_VARIANTS.some((variant) => variant === value);
}

export type GoBenefitKey = 'workspace' | 'together' | 'localpay' | 'switch';

/** Benefit display order is the only structural difference between variants. */
export const VARIANT_BENEFITS: Record<GoVariant, readonly GoBenefitKey[]> = {
  'all-ai': ['workspace', 'together', 'switch', 'localpay'],
  'ai-in-dzd': ['localpay', 'workspace', 'switch', 'together'],
  creators: ['together', 'switch', 'workspace', 'localpay'],
};

/** Anchor the variant's secondary hero action scrolls to. */
export const VARIANT_SECONDARY_TARGET: Record<GoVariant, string> = {
  'all-ai': 'how',
  'ai-in-dzd': 'pricing',
  creators: 'how',
};

/**
 * Recognizable brands for the capability-proof strip. Derived from the
 * canonical MODEL_BRANDS system (local /brand/models icons) — never a
 * second catalog. Only brands with a shipped icon are eligible.
 */
const PROOF_BRANDS: readonly ModelBrandId[] = [
  'openai',
  'claude',
  'google',
  'xai',
  'meta',
  'deepseek',
  'qwen',
  'kimi',
  'mistral',
  'bfl',
  'kling',
  'luma',
] as const;

export const GO_PROOF_BRANDS: readonly { name: string; iconUrl: string }[] =
  PROOF_BRANDS.filter((id) => MODEL_BRANDS[id].icon).map((id) => ({
    name: MODEL_BRANDS[id].name,
    iconUrl: `/brand/models/${MODEL_BRANDS[id].icon as string}`,
  }));
