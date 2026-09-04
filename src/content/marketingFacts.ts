import type {Locale} from '../../i18n/routing';

// These values are preserved from the existing homepage. They are centralized
// here so localization can never make product truth differ between languages.
// Business validation is still required before launch (see FAQ_OWNER_TODOS).
export const HERO_STAT_VALUES = ['12+', 'DA', '1', '3'] as const;

export const PRICING_FACTS = [
  {id: 'free', amountDa: 0, monthly: false},
  {id: 'pro', amountDa: 2500, monthly: true},
  {id: 'max', amountDa: 5900, monthly: true},
] as const;

export function formatDa(amount: number, locale: Locale) {
  const numberLocale = locale === 'fr' ? 'fr-FR' : 'en-US';
  return `${new Intl.NumberFormat(numberLocale, {maximumFractionDigits: 0}).format(amount)} DA`;
}
