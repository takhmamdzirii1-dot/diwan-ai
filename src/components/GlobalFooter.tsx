'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { VantraLogo } from './VantraLogo';

const LINKS = [
  { key: 'terms', href: '#' },
  { key: 'privacy', href: '#' },
  { key: 'twitter', href: 'https://x.com', external: true },
  { key: 'status', href: '#' },
];

export default function GlobalFooter() {
  const t = useTranslations('footer');

  return (
    <footer className="border-t border-white/[0.05] py-12">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg border border-white/10 flex items-center justify-center">
            <VantraLogo className="w-3.5 h-3.5" />
          </div>
          <span className="text-[12.5px] font-semibold tracking-[0.14em] text-white/80">VANTRA</span>
          <span className="text-[11px] text-white/30">© {new Date().getFullYear()}</span>
        </div>

        {/* Links */}
        <nav aria-label={t('aria')} className="flex flex-wrap items-center justify-center gap-5 sm:gap-7">
          {LINKS.map((l) => (
            <a
              key={l.key}
              href={l.href}
              {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="text-sm text-white/40 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded"
            >
              {t(l.key)}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
