import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import GoLanding from '../../../../../src/components/go/GoLanding';
import { GO_VARIANTS, isGoVariant } from '../../../../../src/go/variants';
import { loadMessages } from '../../../../../i18n/messages';
import { routing, type Locale } from '../../../../../i18n/routing';

type GoParams = { locale: string; variant: string };

export const dynamicParams = false;
export const dynamic = 'force-static';

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    GO_VARIANTS.map((variant) => ({ locale, variant }))
  );
}

async function goHeroCopy(locale: Locale, variant: string) {
  const messages = (await loadMessages(locale)) as Record<string, any>;
  return messages.go?.hero?.[variant] as
    | { metaTitle?: string; metaDesc?: string }
    | undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<GoParams>;
}): Promise<Metadata> {
  const { locale, variant } = await params;
  if (!hasLocale(routing.locales, locale) || !isGoVariant(variant)) notFound();

  const copy = await goHeroCopy(locale, variant);

  return {
    title: copy?.metaTitle ?? 'VANTRA',
    description: copy?.metaDesc ?? 'VANTRA',
    // Paid acquisition page: keep the homepage as the SEO canonical surface.
    robots: { index: false, follow: true },
    alternates: {
      canonical: `/${locale}/go/${variant}`,
    },
    openGraph: {
      title: copy?.metaTitle ?? 'VANTRA',
      description: copy?.metaDesc ?? 'VANTRA',
      url: `/${locale}/go/${variant}`,
      siteName: 'VANTRA',
      type: 'website',
    },
  };
}

export default async function GoVariantPage({
  params,
}: {
  params: Promise<GoParams>;
}) {
  const { locale, variant } = await params;
  if (!hasLocale(routing.locales, locale) || !isGoVariant(variant)) notFound();
  return <GoLanding variant={variant} />;
}
