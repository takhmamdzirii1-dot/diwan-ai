'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

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
  const [titleLead, titleRest] = t('title').split(/,\s*/, 2);

  return (
    <section id="faq" className="relative !py-24 md:!py-28">
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-12 px-6 md:grid-cols-[minmax(0,0.62fr)_minmax(0,1fr)] md:gap-16 lg:gap-24">
        {/* Sticky heading */}
        <div className="md:sticky md:top-24 self-start">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3 }}
            className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40"
          >
            {t('label')}
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 text-4xl font-bold leading-[1.04] tracking-[-0.04em] text-[#f5f5f5] md:text-[52px] lg:text-[56px]"
          >
            {titleLead}{titleRest && <><span>,</span><br />{titleRest}</>}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mt-6 max-w-sm text-base leading-relaxed text-white/45 md:text-[17px]"
          >
            {t('subtitle')}
          </motion.p>
        </div>

        {/* Accordion */}
        <div className="divide-y divide-white/[0.075] border-y border-white/[0.075]">
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
                    'group flex w-full cursor-pointer items-center justify-between gap-5 py-5 text-start text-[15px] font-semibold leading-snug transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:py-6 sm:text-base',
                    isOpen ? 'text-[#f5f5f5]' : 'text-white/55 hover:text-white/85'
                  )}
                >
                  <span>{item.question}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[16px] font-light leading-none transition-[transform,color,background-color,border-color] duration-300',
                      isOpen
                        ? 'rotate-45 border-white bg-white text-black'
                        : 'border-white/[0.14] bg-transparent text-white/50 group-hover:border-white/25 group-hover:text-white/80'
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
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-[680px] pb-7 pe-14 text-[14px] leading-[1.75] text-white/48 sm:text-[14.5px]">{item.answer}</p>
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
