import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { loadMessages } from './messages';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;

  if (hasLocale(routing.locales, requestedLocale)) {
    return {
      locale: requestedLocale,
      messages: await loadMessages(requestedLocale),
    };
  }

  // Non-localized routes such as /studio remain English for now. Localized
  // marketing routes validate their segment in the route layout and page.
  return {
    locale: 'en',
    messages: await import('../messages/studio-en.json').then((module) => module.default),
  };
});
