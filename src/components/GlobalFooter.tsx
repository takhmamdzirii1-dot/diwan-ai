'use client';

import React from 'react';
import { SITE_LINKS } from '@/src/content/site';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { VantraLogo, VantraWordmark } from './VantraLogo';

export default function GlobalFooter({ legalOnly = false }: { legalOnly?: boolean }) {
  const t = useTranslations('footer');
  const locale = useLocale();
  const links = [
    { key: 'models', href: `/${locale}#models` },
    { key: 'pricing', href: `/${locale}#pricing` },
    { key: 'faq', href: `/${locale}#faq` },
    { key: 'terms', href: `/${locale}/terms` },
    { key: 'privacy', href: `/${locale}/privacy` },
    { key: 'billing', href: `/${locale}/billing` },
    ...(SITE_LINKS.status ? [{ key: 'status', href: SITE_LINKS.status, external: true }] : []),
    ...(SITE_LINKS.social ? [{ key: 'twitter', href: SITE_LINKS.social, external: true }] : []),
    ...(SITE_LINKS.support ? [{ key: 'support', href: SITE_LINKS.support, external: true }] : []),
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
          {links.filter(l => !legalOnly || ['terms', 'privacy', 'billing', 'support'].includes(l.key)).map((l) => (
            <Link
              key={l.key}
              href={l.href}
              {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="rounded inline-flex min-h-11 items-center text-[13px] text-white/60 transition-colors duration-200 hover:text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
