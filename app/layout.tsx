import type { Metadata } from 'next';
import React from 'react';
import AmbientMotionBackground from '../src/components/AmbientMotionBackground';
import { ModalProvider } from '../src/context/ModalContext';
import './globals.css';

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
    <html lang="en" className="dark scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="bg-[#050506] text-[#F5F6F8] antialiased min-h-screen relative selection:bg-[#1FD8B8] selection:text-[#050506]">
        <ModalProvider>
          <AmbientMotionBackground />
          {children}
        </ModalProvider>
      </body>
    </html>
  );
}
