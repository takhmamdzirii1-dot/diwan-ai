'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

type SupportingFeature = {
  title: string;
  description: string;
  visual: 'balance' | 'models' | 'workspace';
};

function SupportingVisual({
  visual,
  modelLabels,
  modes,
}: {
  visual: SupportingFeature['visual'];
  modelLabels: string[];
  modes: string[];
}) {
  if (visual === 'balance') {
    return (
      <div className="flex h-12 w-[6.5rem] flex-col justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4">
        <span className="h-1 w-full rounded-full bg-white/70" />
        <span className="h-1 w-4/5 rounded-full bg-white/40" />
        <span className="h-1 w-3/5 rounded-full bg-white/20" />
      </div>
    );
  }

  if (visual === 'models') {
    return (
      <div className="grid h-12 w-[6.5rem] grid-cols-2 gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1.5">
        {modelLabels.map((label) => (
          <span
            key={label}
            className="flex items-center justify-center rounded border border-white/[0.06] bg-white/[0.025] px-1 text-[7px] font-medium tracking-wide text-white/60 sm:text-[8px]"
          >
            {label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div dir="ltr" className="flex h-12 w-[6.5rem] items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1.5 text-[8px] text-white/45 sm:text-[9px]">
      {modes.map((mode, index) => (
        <span key={mode} className={`flex h-full flex-1 items-center justify-center ${index === 0 ? 'rounded bg-white/[0.12] text-white/85' : ''}`}>
          {mode}
        </span>
      ))}
    </div>
  );
}

export default function WhyVantra() {
  const t = useTranslations('why');
  const features = t.raw('features') as SupportingFeature[];
  const modelLabels = t.raw('modelLabels') as string[];
  const modes = t.raw('modes') as string[];

  return (
    <section id="why-vantra" className="relative overflow-hidden bg-[#050505] py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-14 border-t border-white/[0.07] pt-10 md:grid-cols-[0.9fr_1.1fr] md:gap-20 md:pt-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{t('label')}</p>
            <h2 className="mt-5 max-w-md text-3xl font-semibold tracking-tight text-white md:text-5xl">
              {t('title')}
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-7 text-white/45">
              {t('subtitle')}
            </p>

            <div className="mt-10 rounded-2xl border border-white/[0.1] bg-white/[0.035] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <h3 className="text-xl font-medium tracking-tight text-white">{t('localTitle')}</h3>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-white/50">
                    {t('localDescription')}
                  </p>
                </div>
                <div aria-hidden="true" className="flex shrink-0 flex-col items-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.05] text-sm font-medium tracking-[0.08em] text-white/85">DA</div>
                  <span className="h-1 w-6 rounded-full bg-white/30" />
                </div>
              </div>
            </div>
          </motion.div>

          <div className="border-b border-white/[0.07]">
            {features.map((feature, index) => (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 border-t border-white/[0.07] py-8 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-6"
              >
                <div aria-hidden="true" className="pt-0.5"><SupportingVisual visual={feature.visual} modelLabels={modelLabels} modes={modes} /></div>
                <div>
                  <h3 className="text-lg font-medium tracking-tight text-white">{feature.title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">{feature.description}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
