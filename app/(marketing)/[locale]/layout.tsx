import type { Metadata } from 'next';
import React from 'react';
import { hasLocale } from 'next-intl';
import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import AmbientMotionBackground from '../../../src/components/AmbientMotionBackground';
import { ModalProvider } from '../../../src/context/ModalContext';
import { loadMessages } from '../../../i18n/messages';
import { routing } from '../../../i18n/routing';
import { rootFontClasses } from '../../fonts';
import '../../globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://ai-alpha-delta-six.vercel.app'),
  icons: { icon: '/icon.svg' },
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
    <html lang={locale} dir={direction} className={`dark scroll-smooth ${rootFontClasses}`}>
      <body className="bg-[#16181A] text-[#F5F6F8] antialiased min-h-screen relative">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ModalProvider>
            <AmbientMotionBackground />
            {children}
          </ModalProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
