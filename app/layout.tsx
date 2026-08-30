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
  title: 'VANTRA | Next-Generation AI Studio',
  description:
    "From thought to artifact in three moves. Generate text, images, and video with the world's most powerful AI models in one unified workspace.",
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: 'VANTRA Studio',
    description: 'The ultimate AI workspace for creators.',
    type: 'website',
  },
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
