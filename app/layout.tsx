import React from 'react';
import { rootFontClasses } from './fonts';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" dir="ltr" className={`dark ${rootFontClasses}`} suppressHydrationWarning>
      <body className="relative min-h-screen bg-[#16181A] text-[#F5F6F8] antialiased">
        {children}
      </body>
    </html>
  );
}
