import type { MetadataRoute } from 'next';
import { routing } from '../i18n/routing';
import { LEGAL_DOCUMENTS } from '../src/content/legal';

const baseUrl = 'https://ai-alpha-delta-six.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [locale, `${baseUrl}/${locale}`])
  );

  const homepageEntries = routing.locales.map((locale) => ({
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

  const legalEntries = LEGAL_DOCUMENTS.flatMap((document) => {
    const legalLanguages = Object.fromEntries(
      routing.locales.map((locale) => [locale, `${baseUrl}/${locale}/${document}`])
    );
    return routing.locales.map((locale) => ({
      url: `${baseUrl}/${locale}/${document}`,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
      alternates: { languages: { ...legalLanguages, 'x-default': `${baseUrl}/${document}` } },
    }));
  });

  return [...homepageEntries, ...legalEntries];
}
