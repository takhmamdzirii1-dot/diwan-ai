import { Cairo, IBM_Plex_Mono, IBM_Plex_Sans_Arabic, Noto_Sans_Arabic, Inter, Sora } from 'next/font/google';

export const sora = Sora({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-sora', display: 'swap' });

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-mono',
  display: 'swap',
});

// next/font emits self-hosted, unicode-range-scoped Google font faces.
export const chatLatin = Inter({ subsets: ['latin'], variable: '--font-chat-latin', display: 'swap',
  preload: false, adjustFontFallback: false });
export const chatArabic = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '500', '600', '700'],
  variable: '--font-chat-arabic', display: 'swap', preload: false, adjustFontFallback: false });
export const chatArabicFallback = Noto_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '600'],
  variable: '--font-chat-arabic-fallback', display: 'swap', preload: false, adjustFontFallback: false });

export const rootFontClasses = `${inter.variable} ${cairo.variable} ${ibmPlexMono.variable} ${sora.variable} ${chatLatin.variable} ${chatArabic.variable} ${chatArabicFallback.variable}`;
