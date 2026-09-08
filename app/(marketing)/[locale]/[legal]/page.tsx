import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import LegalPage from '../../../../src/components/legal/LegalPage';
import { LEGAL_DOCUMENTS, legalContent, type LegalDocumentId, type LegalLocale } from '../../../../src/content/legal';
import { routing } from '../../../../i18n/routing';

const baseUrl = 'https://ai-alpha-delta-six.vercel.app';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => LEGAL_DOCUMENTS.map((legal) => ({ locale, legal })));
}

function isLegalDocument(value: string): value is LegalDocumentId {
  return LEGAL_DOCUMENTS.includes(value as LegalDocumentId);
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; legal: string }> }): Promise<Metadata> {
  const { locale, legal } = await params;
  if (!hasLocale(routing.locales, locale) || !isLegalDocument(legal)) notFound();
  const copy = legalContent[locale as LegalLocale][legal];
  const languages = Object.fromEntries(routing.locales.map((nextLocale) => [nextLocale, `/${nextLocale}/${legal}`]));

  return {
    title: `${copy.title} | VANTRA`,
    description: copy.description,
    alternates: { canonical: `/${locale}/${legal}`, languages: { ...languages, 'x-default': `/${legal}` } },
    openGraph: {
      title: `${copy.title} | VANTRA`,
      description: copy.description,
      url: `${baseUrl}/${locale}/${legal}`,
      siteName: 'VANTRA',
      locale: locale === 'ar' ? 'ar_DZ' : locale === 'fr' ? 'fr_DZ' : 'en',
      type: 'website',
    },
  };
}

export default async function LocalizedLegalPage({ params }: { params: Promise<{ locale: string; legal: string }> }) {
  const { locale, legal } = await params;
  if (!hasLocale(routing.locales, locale) || !isLegalDocument(legal)) notFound();
  return <LegalPage locale={locale as LegalLocale} document={legal} />;
}
