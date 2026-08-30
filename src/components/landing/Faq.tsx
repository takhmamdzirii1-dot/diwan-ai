'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SectionHeading } from './ui';

const FAQS = [
  {
    q: 'What models do you support?',
    a: 'Frontier engines across every medium — Claude 3.5 and Nemotron for reasoning, Flux.1 Pro and Midjourney for imagery, Runway Gen-3 and Kling for film. The catalog grows weekly, and your balance works across all of it.',
  },
  {
    q: 'How does local payment actually work?',
    a: 'Top up with an Edahabia card, CIB, or BaridiMob — in Dinar, at local rates. No international card, no foreign exchange fees, no subscription trap. Points never expire.',
  },
  {
    q: 'Do I own what I generate?',
    a: 'Yes — full commercial rights on every output, on every plan. No watermarks, no revenue share, no strings. What you create is yours.',
  },
  {
    q: 'What happens when I run out of credits?',
    a: 'Nothing dramatic. Your history stays, your workspace stays. You top up when you need to — or upgrade to a plan with a larger monthly allowance.',
  },
  {
    q: 'Can I build on VANTRA with my team?',
    a: 'The Studio plan includes shared workspaces, pooled credits, and full REST API access with streaming webhooks — everything an agency or product team needs to ship.',
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative bg-[#050505] py-32">
      <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-[1fr_1.35fr] gap-12">
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
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className={cn(
                    'w-full flex items-center justify-between gap-6 py-5 text-start text-[15px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-lg px-2 -mx-2',
                    isOpen ? 'text-white' : 'text-white/60 hover:text-white/90'
                  )}
                >
                  {item.q}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'shrink-0 h-7 w-7 rounded-full border flex items-center justify-center text-[13px] leading-none transition-all duration-300',
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
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-6 pe-8 text-[13.5px] leading-relaxed text-white/50">{item.a}</p>
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
