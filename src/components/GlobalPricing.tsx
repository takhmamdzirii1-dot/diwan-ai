'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { formatDa } from '../content/marketingFacts';
import type { Locale } from '../../i18n/routing';
import type { PaymentPlan } from '@/lib/payments/types';

interface LocalizedPricingTier {
  name: string;
  blurb: string;
  cta: string;
  features: string[];
}

type PricingCard = {
  tier: LocalizedPricingTier;
  plan: PaymentPlan | null;
  free: boolean;
};

export default function GlobalPricing({ onGetStarted }: { onGetStarted: (planId?: string) => void }) {
  const t = useTranslations('pricing');
  const locale = useLocale() as Locale;
  const tiers = t.raw('tiers') as LocalizedPricingTier[];
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/payments/plans', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !Array.isArray(body.plans)) throw new Error('catalog unavailable');
        if (active) setPlans(body.plans);
      })
      .catch(() => { if (active) setPlans([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const cards = useMemo<PricingCard[]>(() => {
    return [
      { tier: tiers[0], plan: null, free: true },
      ...Array.from({ length: 2 }, (_, index) => ({
        tier: tiers[index + 1] ?? tiers[tiers.length - 1],
        plan: plans[index] ?? null,
        free: false,
      })),
    ];
  }, [plans, tiers]);

  return (
    <section id="pricing" className="relative overflow-hidden !py-24 md:!py-32">
      {/* Header */}
      <div className="mx-auto max-w-[960px] px-6 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40"
        >
          {t('label')}
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 text-4xl font-bold leading-[1.05] tracking-[-0.04em] text-[#f5f5f5] md:text-[56px]"
        >
          {t('title')}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mt-6 max-w-[820px] text-base leading-relaxed text-white/50 md:text-[18px]"
        >
          {t('subtitle')}
        </motion.p>
      </div>

      {/* Tiers — original presentation, with paid values supplied by the owner catalog. */}
      <div className="mx-auto mt-14 grid max-w-[1240px] grid-cols-1 items-stretch gap-5 px-6 md:mt-[72px] md:grid-cols-3 lg:gap-6">
        {cards.map(({ tier, plan, free }, i) => {
          const recommended = plan?.featured ?? (!free && i === 1);
          const localPaymentAvailable = Boolean(plan);
          const unavailable = !free && !plan;
          const features = plan
            ? [t('creditsValue', { count: plan.unifiedCredits.toLocaleString(locale) }), ...tier.features.slice(1)]
            : tier.features;
          return (
          <motion.div
            key={plan?.id ?? `${free ? 'free' : 'catalog-slot'}-${i}`}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative flex h-[500px] flex-col overflow-visible rounded-[24px] border p-7 transition-[background-color,border-color] duration-200 lg:h-[520px] lg:p-8',
              recommended
                ? 'border-white/[0.22] bg-[#111112] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_24px_70px_rgba(0,0,0,0.24)]'
                : 'border-white/[0.085] bg-[#09090a]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] hover:border-white/[0.13] hover:bg-[#0b0b0c]'
            )}
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-[18%] top-0 h-px bg-[radial-gradient(ellipse,rgba(255,255,255,0.22),transparent_72%)]" />
            {recommended && (
              <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f5f5f5] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-black shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                {t('recommended')}
              </span>
            )}

            <p className="text-[13px] font-semibold text-white/65">{plan?.name ?? tier.name}</p>

            <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span dir="ltr" className="text-[42px] font-bold leading-none tracking-[-0.045em] text-[#f7f7f7] lg:text-[46px]">
                {free ? formatDa(0, locale) : plan ? formatDa(plan.priceDzd, locale) : '—'}
              </span>
              {plan?.kind === 'subscription' && <span className="text-[12px] font-medium text-white/35">{t('monthlyCadence')}</span>}
            </div>
            {localPaymentAvailable && (
              <p className="mt-3 text-[11px] font-medium text-white/40">{t('localPayment')}</p>
            )}

            <p className={cn('max-w-[300px] text-[13px] leading-[1.65] text-white/50', localPaymentAvailable ? 'mt-4' : 'mt-5')}>
              {plan?.description ?? (unavailable && !loading ? t('catalogPendingShort') : tier.blurb)}
            </p>

            <ul className="mt-7 flex flex-1 flex-col gap-4 border-t border-white/[0.075] pt-7">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-[13px] leading-5 text-white/65">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-white/[0.12] bg-white/[0.025]">
                    <Check strokeWidth={1.8} className="h-2.5 w-2.5 text-white/80" />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 border-t border-white/[0.06] pt-6">
              <button
                type="button"
                onClick={() => onGetStarted(plan?.id)}
                disabled={unavailable}
                className={cn(
                  'h-12 w-full cursor-pointer rounded-xl text-[13.5px] font-semibold transition-[background-color,color,border-color,transform] duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] disabled:cursor-not-allowed disabled:opacity-50',
                  recommended
                    ? 'bg-[#f5f5f5] text-black hover:bg-white'
                    : 'border border-white/[0.14] bg-white/[0.025] text-white/85 hover:border-white/[0.22] hover:bg-white/[0.055] hover:text-white'
                )}
              >
                {unavailable ? t('catalogPendingAction') : tier.cta}
              </button>
            </div>
          </motion.div>
          );
        })}
      </div>
    </section>
  );
}
