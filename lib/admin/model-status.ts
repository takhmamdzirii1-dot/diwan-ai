import { isMissingCustomerPricing } from '@/lib/admin/model-economics';
import type { AdminModelRow } from '@/lib/admin/types';

export type ModelRuntimeStatus = 'enabled' | 'disabled' | 'unconfigured';

type StatusInput = Pick<AdminModelRow, 'catalogOnly' | 'enabled' | 'archived'>;

/**
 * Canonical Admin model status. Active means runtime enabled, Disabled means
 * runtime disabled — an enabled model with missing route/pricing/provider
 * setup stays Active (see modelNeedsAttention). Catalog-only rows are not
 * runtime models, so they read as Unconfigured.
 */
export function modelStatusOf(model: StatusInput): ModelRuntimeStatus {
  if (model.catalogOnly) return 'unconfigured';
  return model.enabled ? 'enabled' : 'disabled';
}

/** Display badge value. Archived rows are runtime-disabled; the badge keeps
 *  the explicit Archived label while they filter/count as Disabled. */
export function modelStatusBadgeOf(model: StatusInput): ModelRuntimeStatus | 'archived' {
  if (model.archived) return 'archived';
  return modelStatusOf(model);
}

type AttentionInput = Pick<
  AdminModelRow,
  'enabled' | 'catalogOnly' | 'creditPrice' | 'routes'
>;

/**
 * Enabled-but-not-runnable marker. Uses only signals already shown
 * elsewhere in Admin (route readiness, customer pricing) — no new
 * semantics, no Studio visibility or access changes.
 */
export function modelNeedsAttention(model: AttentionInput): boolean {
  if (!model.enabled || model.catalogOnly) return false;
  if (isMissingCustomerPricing(model)) return true;
  return !model.routes.some(
    (route) => route.enabled && route.configured && route.providerEnabled
  );
}
