'use client';

import { useTranslations } from 'next-intl';
import { VARIANT_BENEFITS, type GoVariant } from '@/src/go/variants';

/** Maximum 4 concise outcome-focused benefits, ordered per variant angle. */
export default function GoBenefits({ variant }: { variant: GoVariant }) {
  const t = useTranslations('go');
  const order = VARIANT_BENEFITS[variant];

  return (
    <section className="relative" aria-label={t('benefitsLabel')}>
      <div className="mx-auto max-w-[1120px] px-6 py-14 md:py-20">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
          {t('benefitsLabel')}
        </p>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {order.map((key, i) => (
            <div
              key={key}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-start"
            >
              <p className="text-[11px] font-bold tabular-nums tracking-[0.2em] text-white/30">
                {`0${i + 1}`}
              </p>
              <h2 className="mt-3 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-[#f5f5f5]">
                {t(`benefitItems.${key}.title`)}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-white/50">
                {t(`benefitItems.${key}.text`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
