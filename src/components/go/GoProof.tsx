'use client';

import { useTranslations } from 'next-intl';
import { GO_PROOF_BRANDS } from '@/src/go/variants';

/**
 * Model/capability proof. Icons come from the canonical local
 * /brand/models set via MODEL_BRANDS — no second catalog, no network icons.
 */
export default function GoProof() {
  const t = useTranslations('go.proof');

  return (
    <section id="models" className="relative scroll-mt-20 border-y border-white/[0.05]">
      <div className="mx-auto max-w-[1120px] px-6 py-12 md:py-14">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
          {t('label')}
        </p>
        <ul className="mx-auto mt-8 grid max-w-[760px] grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
          {GO_PROOF_BRANDS.map((brand) => (
            <li
              key={brand.name}
              className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-3"
              title={brand.name}
            >
              <img
                src={brand.iconUrl}
                alt=""
                width={28}
                height={28}
                loading="lazy"
                decoding="async"
                className="h-7 w-7 object-contain"
              />
              <span className="max-w-full truncate text-[11px] font-medium text-white/55">
                {brand.name}
              </span>
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-6 max-w-[62ch] text-center text-[12.5px] leading-relaxed text-white/35">
          {t('note')}
        </p>
      </div>
    </section>
  );
}
