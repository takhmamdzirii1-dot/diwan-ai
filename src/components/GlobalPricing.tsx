'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PricingTier {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: string;
  recommended?: boolean;
  localPaymentAvailable?: boolean;
}

// TODO(owner): Replace these shared benefits with confirmed per-plan
// allowances once the launch entitlements are finalized.
const SHARED_PRODUCT_BENEFITS = [
  'Chat, Image and Video in one workspace',
  'One shared balance across creation modes',
  'Multiple supported AI models in one platform',
];

const TIERS: PricingTier[] = [
  {
    name: 'Free',
    price: '0 DA',
    cadence: '',
    blurb: 'Explore VANTRA’s unified AI workspace.',
    features: SHARED_PRODUCT_BENEFITS,
    cta: 'Start Free',
  },
  {
    name: 'Pro',
    price: '2,500 DA',
    cadence: '/ month',
    blurb: 'For regular work across Chat, Image and Video.',
    features: SHARED_PRODUCT_BENEFITS,
    cta: 'Choose Pro',
    recommended: true,
    localPaymentAvailable: true,
  },
  {
    name: 'Max',
    price: '5,900 DA',
    cadence: '/ month',
    blurb: 'For more demanding creative workflows.',
    features: SHARED_PRODUCT_BENEFITS,
    cta: 'Choose Max',
    localPaymentAvailable: true,
  },
];

export default function GlobalPricing({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section id="pricing" className="relative bg-[#050505] !py-24 md:!py-28 overflow-hidden">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-[11px] font-semibold tracking-widest uppercase text-white/40"
        >
          Pricing
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 text-3xl md:text-5xl font-extrabold tracking-tight text-white"
        >
          One platform. One shared balance.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-5 text-white/50 text-lg"
        >
          Use Chat, Image and Video—and supported AI models—from one VANTRA balance instead of managing separate services.
        </motion.p>
      </div>

      {/* Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto gap-4 lg:gap-6 mt-16 md:mt-20 px-6 items-stretch">
        {TIERS.map((tier, i) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative flex flex-col rounded-2xl p-6 lg:p-8 border transition-colors',
              tier.recommended
                ? 'bg-white/[0.055] border-white/25'
                : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.035]'
            )}
          >
            {tier.recommended && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-black text-[10.5px] font-bold uppercase tracking-wider">
                Recommended
              </span>
            )}

            <p className="text-[13px] font-semibold text-white/70">{tier.name}</p>

            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-4xl font-extrabold tracking-tight text-white">{tier.price}</span>
              {tier.cadence && <span className="text-[13px] text-white/40">{tier.cadence}</span>}
            </div>
            {tier.localPaymentAvailable && (
              <p className="mt-2 text-[11px] text-white/40">Local payment available</p>
            )}

            <p className="mt-3 text-[13px] text-white/50 leading-relaxed">{tier.blurb}</p>

            <ul className="mt-7 pt-6 border-t border-white/[0.07] space-y-3.5 flex-1">
              {tier.features.map((f) => (
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
                tier.recommended
                  ? 'bg-white text-black hover:bg-gray-200'
                  : 'border border-white/15 bg-white/[0.03] text-white/85 hover:text-white hover:bg-white/[0.07]'
              )}
            >
              {tier.cta}
            </button>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
