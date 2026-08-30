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
  highlighted?: boolean;
}

const TIERS: PricingTier[] = [
  {
    name: 'Hobby',
    price: '$0',
    cadence: '/mo',
    blurb: 'For exploring what VANTRA can do.',
    features: ['Free chat models included', '25 image generations / mo', 'Standard render queue', 'Community support'],
    cta: 'Start Free',
  },
  {
    name: 'Pro',
    price: '$15',
    cadence: '/mo',
    blurb: 'For serious creators shipping work weekly.',
    features: [
      'Everything in Hobby',
      '500 image generations / mo',
      'Motion Studio video renders',
      'Priority render queue',
    ],
    cta: 'Upgrade to Pro',
    highlighted: true,
  },
  {
    name: 'Studio',
    price: '$39',
    cadence: '/mo',
    blurb: 'For teams and agencies at scale.',
    features: [
      'Everything in Pro',
      '2,000 image generations / mo',
      '4K upscaling included',
      'Full developer API access',
    ],
    cta: 'Get Studio',
  },
];

export default function GlobalPricing({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section id="pricing" className="relative bg-[#050505] pt-24 pb-8 overflow-hidden">
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
          className="mt-4 text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
        >
          Start free. Scale when ready.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-5 text-white/50 text-lg"
        >
          No hidden fees. No forced subscriptions. Cancel anytime.
        </motion.p>
      </div>

      {/* Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto gap-8 mt-32 px-6">
        {TIERS.map((tier, i) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative flex flex-col rounded-2xl p-8 border transition-colors',
              tier.highlighted
                ? 'bg-white/[0.04] border-white/20 scale-105 shadow-2xl'
                : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.035]'
            )}
          >
            {tier.highlighted && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-black text-[10.5px] font-bold uppercase tracking-wider">
                Most Popular
              </span>
            )}

            <p className="text-[13px] font-semibold text-white/70">{tier.name}</p>

            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-4xl font-extrabold tracking-tight text-white">{tier.price}</span>
              <span className="text-[13px] text-white/40">{tier.cadence}</span>
            </div>

            <p className="mt-3 text-[13px] text-white/50 leading-relaxed">{tier.blurb}</p>

            <ul className="mt-7 space-y-3 flex-1">
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
                tier.highlighted
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
