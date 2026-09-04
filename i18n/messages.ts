import type {Locale} from './routing';

const messageLoaders = {
  fr: () => import('../messages/fr.json').then((module) => module.default),
  ar: () => import('../messages/ar.json').then((module) => module.default),
  en: () => import('../messages/en.json').then((module) => module.default),
};

export function loadMessages(locale: Locale) {
  return messageLoaders[locale]();
}
