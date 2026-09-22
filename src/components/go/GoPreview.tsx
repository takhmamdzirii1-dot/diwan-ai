'use client';

import { Image as ImageIcon, Play, SendHorizonal } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Lightweight static product preview. Pure markup — no AI requests, no
 * media downloads, no animation library. Explicitly illustrative.
 */
export default function GoPreview({ onPrimary }: { onPrimary: () => void }) {
  const t = useTranslations('go.preview');

  return (
    <section id="preview" className="relative scroll-mt-20">
      <div className="mx-auto max-w-[1120px] px-6 py-10 md:py-14">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
          {t('label')}
        </p>
        <h2 className="mx-auto mt-5 max-w-[22ch] text-center text-3xl font-bold leading-[1.08] tracking-[-0.035em] text-[#f5f5f5] md:text-[44px]">
          {t('title')}
        </h2>
        <p className="mx-auto mt-5 max-w-[60ch] text-center text-[15px] leading-relaxed text-white/50">
          {t('sub')}
        </p>

        <div
          className="relative mx-auto mt-8 max-w-[960px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0c0e] shadow-[0_32px_90px_-48px_rgba(255,255,255,0.22)]"
          role="img"
          aria-label={t('title')}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
          />
          <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-3" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-5 md:p-5">
            {/* Chat mock */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                {t('chatTitle')}
              </p>
              <div className="mt-3 rounded-xl rounded-es-sm bg-white/[0.07] p-3 text-start text-[13px] leading-relaxed text-white/80">
                {t('chatSample')}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5">
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-white/50 motion-reduce:animate-none" />
                <span className="h-2 flex-1 rounded bg-white/10" />
                <SendHorizonal className="h-4 w-4 shrink-0 text-white/40" aria-hidden="true" />
              </div>
            </div>
            {/* Image mock */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                {t('imageTitle')}
              </p>
              <div className="mt-3 flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl bg-[radial-gradient(ellipse_at_50%_35%,rgba(255,255,255,0.10),rgba(255,255,255,0.02)_70%)]">
                <ImageIcon className="h-7 w-7 text-white/50" aria-hidden="true" />
                <span className="px-3 text-center text-[12px] text-white/45">{t('imageNote')}</span>
              </div>
            </div>
            {/* Video mock */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                {t('videoTitle')}
              </p>
              <div className="mt-3 flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl bg-black/40 sm:aspect-auto sm:h-full sm:min-h-[120px]">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/[0.06]">
                  <Play className="h-4 w-4 fill-white/80 text-white/80" aria-hidden="true" />
                </span>
                <span className="px-2 text-center text-[12px] text-white/45">{t('videoNote')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={onPrimary}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-[#f5f5f5] px-8 text-[15px] font-semibold text-black transition-[background-color,transform] duration-200 hover:bg-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
          >
            {t('cta')}
          </button>
          <p className="mt-3 text-[12.5px] text-white/40">{t('microcopy')}</p>
        </div>
      </div>
    </section>
  );
}
