import type { Metadata } from 'next';
import React from 'react';
import { Inter, Cairo, IBM_Plex_Mono } from 'next/font/google';
import AmbientMotionBackground from '../src/components/AmbientMotionBackground';
import { ModalProvider } from '../src/context/ModalContext';
import './globals.css';

// Self-hosted via next/font — zero external font requests, zero layout shift
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VANTRA — Algerian AI Gateway • Pay in DZD with Edahabia & CIB',
  description: 'Unify access to Claude 3.5 Sonnet, Flux 4K, Kling AI, GPT-4o, DeepSeek and frontier AI models in Algeria with local DZD payment.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark scroll-smooth ${inter.variable} ${cairo.variable} ${ibmPlexMono.variable}`}
    >
      <body className="bg-[#16181A] text-[#F5F6F8] antialiased min-h-screen relative">
        <ModalProvider>
          <AmbientMotionBackground />
          {children}
        </ModalProvider>
      </body>
    </html>
  );
}
