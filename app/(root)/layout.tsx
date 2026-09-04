import React from 'react';
import { rootFontClasses } from '../fonts';
import '../globals.css';

export default function RedirectRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" dir="ltr" className={`dark scroll-smooth ${rootFontClasses}`}>
      <body className="bg-[#16181A] text-[#F5F6F8] antialiased min-h-screen relative">
        {children}
      </body>
    </html>
  );
}
