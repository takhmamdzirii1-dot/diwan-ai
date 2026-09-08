'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { VantraLogo, VantraWordmark } from './VantraLogo';

export default function GlobalFooter() {
  const t = useTranslations('footer');
  const locale = useLocale();
  const links = [
    { key: 'models', href: `/${locale}#models` },
    { key: 'pricing', href: `/${locale}#pricing` },
    { key: 'faq', href: `/${locale}#faq` },
    { key: 'terms', href: `/${locale}/terms` },
    { key: 'privacy', href: `/${locale}/privacy` },
    { key: 'billing', href: `/${locale}/billing` },
    { key: 'status', href: '#' },
    { key: 'twitter', href: 'https://x.com', external: true },
  ];

  return (
    <footer className="border-t border-white/[0.075] py-8 md:py-9">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-7 px-6 sm:flex-row md:px-10 lg:px-14">
        {/* Brand */}
        <div dir="ltr" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.12]">
            <VantraLogo className="h-3.5 w-3.5" />
          </div>
          <VantraWordmark />
          <span className="text-[11px] text-white/38">© 2026</span>
        </div>

        {/* Links */}
        <nav aria-label={t('aria')} className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:justify-end lg:gap-x-7">
          {links.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="rounded text-[13px] text-white/45 transition-colors duration-200 hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
