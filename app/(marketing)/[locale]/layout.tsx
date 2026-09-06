import type { Metadata } from 'next';
import React from 'react';
import { hasLocale } from 'next-intl';
import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import AmbientMotionBackground from '../../../src/components/AmbientMotionBackground';
import DocumentLocale from '../../../src/components/DocumentLocale';
import { ModalProvider } from '../../../src/context/ModalContext';
import { loadMessages } from '../../../i18n/messages';
import { routing } from '../../../i18n/routing';

export const metadata: Metadata = {
  metadataBase: new URL('https://ai-alpha-delta-six.vercel.app'),
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/brand/vantra-icon-32.png', sizes: '32x32', type: 'image/png' }], apple: '/brand/vantra-icon-256.png' },
};

export default async function MarketingLocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const messages = await loadMessages(locale);
  const direction = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <div lang={locale} dir={direction} className="min-h-screen bg-[#16181A]">
      <DocumentLocale locale={locale} scrollSmooth />
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ModalProvider>
          <AmbientMotionBackground />
          {children}
        </ModalProvider>
      </NextIntlClientProvider>
    </div>
  );
}
