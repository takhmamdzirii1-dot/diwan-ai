import type { Metadata } from 'next';
import React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { cookies } from 'next/headers';
import { ModalProvider } from '../../../src/context/ModalContext';
import studioMessages from '../../../messages/studio-en.json';
import studioFrench from '../../../messages/studio-fr.json';
import studioArabic from '../../../messages/studio-ar.json';
import { rootFontClasses } from '../../fonts';
import '../../globals.css';

export const metadata: Metadata = {
  title: 'VANTRA Studio',
  description: 'VANTRA unified AI workspace.',
  icons: { icon: '/icon.svg' },
};

function mergeMessages(base: Record<string, any>, translated: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key,
    value && typeof value === 'object' && !Array.isArray(value)
      ? mergeMessages(value, translated?.[key] ?? {})
      : translated?.[key] ?? value,
  ]));
}

export default async function StudioRootLayout({ children }: { children: React.ReactNode }) {
  const preference = (await cookies()).get('vantra_locale')?.value;
  const locale = preference === 'fr' || preference === 'ar' ? preference : 'en';
  const translated = locale === 'fr' ? studioFrench : locale === 'ar' ? studioArabic : {};
  const messages = mergeMessages(studioMessages, translated);
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={`dark ${rootFontClasses}`}>
      <body className="studio-overlay-root bg-[#070707] text-[#F5F6F8] antialiased min-h-screen relative">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ModalProvider>
            {children}
          </ModalProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
