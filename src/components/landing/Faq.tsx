'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { SectionHeading } from './ui';

interface FaqItem {
  question: string;
  answer: string;
}

// Do not publish answers to these points until the owner confirms the product
// policy and launch behavior.
export const FAQ_OWNER_TODOS = [
  'Confirm the exact launch model catalog before naming individual models.',
  'Confirm per-model credit deductions, rollover rules, and exact zero-balance behavior.',
  'Confirm the production payment-method list and whether an international card is ever required.',
  'Confirm plan cancellation and plan-change behavior.',
  'Confirm generated-content ownership, commercial-use, and video-download terms.',
] as const;

export default function Faq() {
  const t = useTranslations('faq');
  const items = t.raw('items') as FaqItem[];
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative !py-24 md:!py-28">
      <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-[1fr_1.35fr] gap-10 md:gap-12">
        {/* Sticky heading */}
        <div className="md:sticky md:top-24 self-start">
          <SectionHeading
            align="start"
            label={t('label')}
            title={t('title')}
            sub={t('subtitle')}
          />
        </div>

        {/* Accordion */}
        <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.question}>
                <button
                  type="button"
                  id={`faq-trigger-${i}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className={cn(
                    'w-full flex items-center justify-between gap-4 py-4 sm:py-5 text-start text-[15px] leading-snug font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-lg px-2 -mx-2',
                    isOpen ? 'text-white' : 'text-white/60 hover:text-white/90'
                  )}
                >
                  {item.question}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'shrink-0 h-7 w-7 rounded-full border flex items-center justify-center text-[13px] leading-none transition-[transform,color,background-color,border-color] duration-300',
                      isOpen ? 'bg-white text-black border-white rotate-45' : 'border-white/15 text-white/50'
                    )}
                  >
                    +
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-panel-${i}`}
                      role="region"
                      aria-labelledby={`faq-trigger-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-5 pe-8 text-[13.5px] leading-relaxed text-white/50">{item.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
