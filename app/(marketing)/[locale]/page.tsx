import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import App from '../../../src/App';
import { loadMessages } from '../../../i18n/messages';
import { routing } from '../../../i18n/routing';

const languageAlternates = {
  fr: '/fr',
  ar: '/ar',
  en: '/en',
  'x-default': '/',
};

export const dynamicParams = false;
export const dynamic = 'force-static';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const { metadata } = await loadMessages(locale);

  return {
    title: metadata.title,
    description: metadata.description,
    alternates: {
      canonical: `/${locale}`,
      languages: languageAlternates,
    },
    openGraph: {
      title: metadata.openGraphTitle,
      description: metadata.openGraphDescription,
      url: `/${locale}`,
      siteName: 'VANTRA',
      locale: locale === 'ar' ? 'ar_DZ' : locale === 'fr' ? 'fr_DZ' : 'en',
      type: 'website',
    },
  };
}

export default async function LocalizedMarketingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return <App />;
}
