'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SectionHeading } from './ui';

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: 'Which AI models can I use?',
    a: 'VANTRA brings multiple supported AI models into one workspace for Chat, Image and Video. The available choices are shown inside each creation mode.',
  },
  {
    q: 'How does the shared balance work?',
    a: 'Your VANTRA balance is shared across Chat, Image and Video. Usage across supported models comes from that same balance, so you do not manage a separate balance for each tool.',
  },
  {
    q: 'Does one plan cover Chat, Image and Video?',
    a: 'Yes. VANTRA is designed as one platform for all three creation modes, using one plan and shared balance instead of separate AI subscriptions.',
  },
  {
    q: 'How do payments work?',
    a: 'VANTRA supports local payments in DZD. Credits from a top-up are added to the shared balance used across the workspace.',
  },
  {
    q: 'What happens when my credits run out?',
    a: 'You can add credits to the same shared balance from VANTRA and continue using the workspace.',
  },
  {
    q: 'What can I do with generated content?',
    a: 'Generated images can be downloaded, and saved image generations can be revisited in the media library.',
  },
];

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
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative bg-[#050505] !py-24 md:!py-28">
      <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-[1fr_1.35fr] gap-10 md:gap-12">
        {/* Sticky heading */}
        <div className="md:sticky md:top-24 self-start">
          <SectionHeading
            align="start"
            label="FAQ"
            title="Questions, answered."
            sub="Everything else — the team reads every message."
          />
        </div>

        {/* Accordion */}
        <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
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
                  {item.q}
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
                      <p className="pb-5 pe-8 text-[13.5px] leading-relaxed text-white/50">{item.a}</p>
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
