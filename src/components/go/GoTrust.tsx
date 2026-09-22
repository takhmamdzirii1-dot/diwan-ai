'use client';

import { BadgeCheck, Banknote, Gift, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

const TRUST_ICONS = [Banknote, ShieldCheck, Gift, BadgeCheck];

/** Trust section — only real, currently-true statements. No counters, no reviews. */
export default function GoTrust() {
  const t = useTranslations('go.trust');
  const items = t.raw('items') as { title: string; text: string }[];

  return (
    <section className="relative" aria-label={t('label')}>
      <div className="mx-auto max-w-[1120px] px-6 py-14 md:py-20">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
          {t('label')}
        </p>
        <h2 className="mx-auto mt-5 max-w-[22ch] text-center text-3xl font-bold leading-[1.08] tracking-[-0.035em] text-[#f5f5f5] md:text-[40px]">
          {t('title')}
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => {
            const Icon = TRUST_ICONS[i % TRUST_ICONS.length];
            return (
              <div
                key={item.title}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-start"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
                  <Icon className="h-5 w-5 text-white/75" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold leading-snug text-[#f5f5f5]">
                  {item.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-white/50">{item.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
