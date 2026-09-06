import type { Metadata } from 'next';
import React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { cookies } from 'next/headers';
import { ModalProvider } from '../../../src/context/ModalContext';
import studioMessages from '../../../messages/studio-en.json';
import studioFrench from '../../../messages/studio-fr.json';
import studioArabic from '../../../messages/studio-ar.json';
import DocumentLocale from '../../../src/components/DocumentLocale';
import StudioWorkspace from '../../../src/components/studio/StudioWorkspace';

export const metadata: Metadata = {
  title: 'VANTRA Studio',
  description: 'VANTRA unified AI workspace.',
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/brand/vantra-icon-32.png', sizes: '32x32', type: 'image/png' }], apple: '/brand/vantra-icon-256.png' },
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
    <div lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className="studio-overlay-root min-h-screen bg-[#070707] text-[#F5F6F8]">
      <DocumentLocale locale={locale} />
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ModalProvider>
          {children}
          <StudioWorkspace />
        </ModalProvider>
      </NextIntlClientProvider>
    </div>
  );
}
