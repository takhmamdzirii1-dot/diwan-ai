'use client';

import { Image as ImageIcon, MessageSquare, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { GoVariant } from '@/src/go/variants';

/**
 * Angle-specific hero. Static markup (no animation library) for fast first
 * paint in the Meta in-app browser. Compact modality visual only — the full
 * brand proof lives further down the page.
 */
export default function GoHero({
  variant,
  onPrimary,
  onSecondary,
}: {
  variant: GoVariant;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const t = useTranslations(`go.hero.${variant}`);
  const tp = useTranslations('go.preview');
  const modalities = [
    { icon: MessageSquare, label: tp('chatTitle') },
    { icon: ImageIcon, label: tp('imageTitle') },
    { icon: Play, label: tp('videoTitle') },
  ];

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[420px] max-w-[900px] bg-[radial-gradient(ellipse_55%_60%_at_50%_0%,rgba(255,255,255,0.07),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-[880px] px-6 pb-10 pt-24 text-center sm:pt-28 md:pb-14 md:pt-28">
        <p className="mx-auto inline-flex min-h-9 items-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
          {t('eyebrow')}
        </p>
        <h1 className="mx-auto mt-6 max-w-[16ch] text-4xl font-bold leading-[1.06] tracking-[-0.04em] text-[#f5f5f5] sm:text-5xl md:text-[64px]">
          {t('headline')}
        </h1>
        <p className="mx-auto mt-6 max-w-[52ch] text-base leading-relaxed text-white/55 md:text-lg">
          {t('sub')}
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onPrimary}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-[#f5f5f5] px-8 text-[15px] font-semibold text-black shadow-[0_14px_42px_-18px_rgba(255,255,255,0.38)] transition-[background-color,transform] duration-200 hover:bg-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
          >
            {t('cta')}
          </button>
          <button
            type="button"
            onClick={onSecondary}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-white/12 bg-white/[0.03] px-8 text-[15px] font-medium text-white/80 transition-colors duration-200 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {t('secondary')}
          </button>
        </div>
        <div className="mx-auto mt-10 grid max-w-[560px] grid-cols-3 gap-2.5 sm:gap-3" aria-label={t('eyebrow')}>
          {modalities.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-2 py-3"
            >
              <Icon className="h-5 w-5 text-white/80" aria-hidden="true" />
              <span className="text-[12px] font-semibold text-white/70">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
