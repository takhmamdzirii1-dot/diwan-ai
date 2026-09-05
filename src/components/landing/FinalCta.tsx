'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Magnetic } from './ui';

export default function FinalCta({ onGetStarted }: { onGetStarted: () => void }) {
  const t = useTranslations('finalCta');

  return (
    <section className="relative overflow-hidden pb-24 pt-28 md:pb-28 md:pt-32">
      {/* Center glow */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_38%_48%_at_50%_56%,rgba(255,255,255,0.055),transparent_72%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1120px] px-6 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3 }}
          className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/55"
        >
          {t('eyebrow')}
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 text-4xl font-bold leading-[1.04] tracking-[-0.045em] text-[#f7f7f7] md:text-[64px] lg:text-[68px]"
        >
          {t('title')}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mx-auto mt-6 max-w-[760px] text-base leading-relaxed text-white/50 md:text-[19px]"
        >
          {t('subtitle')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: 0.18 }}
          className="mt-10"
        >
          <Magnetic strength={0.2}>
            <button
              type="button"
              onClick={onGetStarted}
              className="h-16 w-[min(336px,calc(100vw-48px))] cursor-pointer rounded-xl bg-[#f5f5f5] px-8 text-[15px] font-semibold text-black shadow-[0_14px_42px_-18px_rgba(255,255,255,0.38)] transition-[background-color,transform] duration-200 hover:bg-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] sm:px-10"
            >
              {t('button')}
            </button>
          </Magnetic>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: 0.24 }}
          className="mt-8 text-[13px] tracking-[0.02em] text-white/42 sm:text-sm"
        >
          {t('microcopy')}
        </motion.p>
      </div>
    </section>
  );
}
