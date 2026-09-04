'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { formatDa, PRICING_FACTS } from '../content/marketingFacts';
import type { Locale } from '../../i18n/routing';

interface LocalizedPricingTier {
  name: string;
  blurb: string;
  cta: string;
}

export default function GlobalPricing({ onGetStarted }: { onGetStarted: () => void }) {
  const t = useTranslations('pricing');
  const locale = useLocale() as Locale;
  const tiers = t.raw('tiers') as LocalizedPricingTier[];
  const benefits = t.raw('benefits') as string[];

  return (
    <section id="pricing" className="relative !py-24 md:!py-28 overflow-hidden">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-[11px] font-semibold tracking-widest uppercase text-white/40"
        >
          {t('label')}
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 text-3xl md:text-5xl font-extrabold tracking-tight text-white"
        >
          {t('title')}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-5 text-white/50 text-lg"
        >
          {t('subtitle')}
        </motion.p>
      </div>

      {/* Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto gap-4 lg:gap-6 mt-16 md:mt-20 px-6 items-stretch">
        {tiers.map((tier, i) => {
          const facts = PRICING_FACTS[i];
          const recommended = i === 1;
          const localPaymentAvailable = facts.amountDa > 0;
          return (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative flex flex-col rounded-2xl p-6 lg:p-8 border transition-colors',
              recommended
                ? 'bg-white/[0.055] border-white/25'
                : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.035]'
            )}
          >
            {recommended && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-black text-[10.5px] font-bold uppercase tracking-wider">
                {t('recommended')}
              </span>
            )}

            <p className="text-[13px] font-semibold text-white/70">{tier.name}</p>

            <div className="mt-4 flex items-baseline gap-1.5">
              <span dir="ltr" className="text-4xl font-extrabold tracking-tight text-white">{formatDa(facts.amountDa, locale)}</span>
              {facts.monthly && <span className="text-[13px] text-white/40">{t('monthlyCadence')}</span>}
            </div>
            {localPaymentAvailable && (
              <p className="mt-2 text-[11px] text-white/40">{t('localPayment')}</p>
            )}

            <p className="mt-3 text-[13px] text-white/50 leading-relaxed">{tier.blurb}</p>

            <ul className="mt-7 pt-6 border-t border-white/[0.07] space-y-3.5 flex-1">
              {benefits.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13px] text-white/65">
                  <Check className="h-4 w-4 shrink-0 text-white/80 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={onGetStarted}
              className={cn(
                'mt-8 w-full h-11 rounded-xl text-[13.5px] font-semibold transition-colors cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]',
                recommended
                  ? 'bg-white text-black hover:bg-gray-200'
                  : 'border border-white/15 bg-white/[0.03] text-white/85 hover:text-white hover:bg-white/[0.07]'
              )}
            >
              {tier.cta}
            </button>
          </motion.div>
          );
        })}
      </div>
    </section>
  );
}
