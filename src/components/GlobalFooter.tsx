'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { VantraLogo } from './VantraLogo';

const LINKS = [
  { key: 'models', href: '#models' },
  { key: 'pricing', href: '#pricing' },
  { key: 'faq', href: '#faq' },
  { key: 'terms', href: '#' },
  { key: 'privacy', href: '#' },
  { key: 'status', href: '#' },
  { key: 'twitter', href: 'https://x.com', external: true },
];

export default function GlobalFooter() {
  const t = useTranslations('footer');

  return (
    <footer className="border-t border-white/[0.075] py-8 md:py-9">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-7 px-6 sm:flex-row md:px-10 lg:px-14">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.12]">
            <VantraLogo className="h-3.5 w-3.5" />
          </div>
          <span className="text-[12.5px] font-semibold tracking-[0.16em] text-white/85">VANTRA</span>
          <span className="text-[11px] text-white/38">© 2026</span>
        </div>

        {/* Links */}
        <nav aria-label={t('aria')} className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:justify-end lg:gap-x-7">
          {LINKS.map((l) => (
            <a
              key={l.key}
              href={l.href}
              {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="rounded text-[13px] text-white/45 transition-colors duration-200 hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {t(l.key)}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
