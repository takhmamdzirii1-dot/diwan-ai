import type { AdminModelRow } from './types';

export function isCustomerPriceConfigured(model: Pick<AdminModelRow, 'creditPrice'>) {
  return typeof model.creditPrice === 'number'
    && Number.isSafeInteger(model.creditPrice)
    && model.creditPrice >= 0;
}

export function isMissingCustomerPricing(model: Pick<AdminModelRow, 'creditPrice'>) {
  return !isCustomerPriceConfigured(model);
}
