import type { MetadataRoute } from 'next';
import { routing } from '../i18n/routing';

const baseUrl = 'https://ai-alpha-delta-six.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [locale, `${baseUrl}/${locale}`])
  );

  return routing.locales.map((locale) => ({
    url: `${baseUrl}/${locale}`,
    changeFrequency: 'weekly' as const,
    priority: 1,
    alternates: {
      languages: {
        ...languages,
        'x-default': `${baseUrl}/`,
      },
    },
  }));
}
