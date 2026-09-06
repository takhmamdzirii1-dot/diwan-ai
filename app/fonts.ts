import { Cairo, IBM_Plex_Mono, Inter, Sora } from 'next/font/google';

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

export const rootFontClasses = `${inter.variable} ${cairo.variable} ${ibmPlexMono.variable} ${sora.variable}`;
