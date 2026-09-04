import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['fr', 'ar', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'always',
  localeDetection: true,
  alternateLinks: false,
  localeCookie: {
    name: 'vantra_locale',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  },
});

export type Locale = (typeof routing.locales)[number];
