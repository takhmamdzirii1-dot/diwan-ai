import type { Metadata } from 'next';
import React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import AmbientMotionBackground from '../../../src/components/AmbientMotionBackground';
import { ModalProvider } from '../../../src/context/ModalContext';
import studioMessages from '../../../messages/studio-en.json';
import { rootFontClasses } from '../../fonts';
import '../../globals.css';

export const metadata: Metadata = {
  title: 'VANTRA Studio',
  description: 'VANTRA unified AI workspace.',
  icons: { icon: '/icon.svg' },
};

export default function StudioRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`dark ${rootFontClasses}`}>
      <body className="bg-[#16181A] text-[#F5F6F8] antialiased min-h-screen relative">
        <NextIntlClientProvider locale="en" messages={studioMessages}>
          <ModalProvider>
            <AmbientMotionBackground />
            {children}
          </ModalProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
