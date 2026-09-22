'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface GoFaqItem {
  question: string;
  answer: string;
}

/** Conversion-focused FAQ for paid traffic. Same accessible accordion pattern as the homepage. */
export default function GoFaq() {
  const t = useTranslations('go.faq');
  const items = t.raw('items') as GoFaqItem[];
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative scroll-mt-20">
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-10 px-6 py-10 md:grid-cols-[minmax(0,0.5fr)_minmax(0,1fr)] md:gap-14 md:py-14">
        <div className="self-start md:sticky md:top-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
            {t('label')}
          </p>
          <h2 className="mt-5 text-3xl font-bold leading-[1.06] tracking-[-0.035em] text-[#f5f5f5] md:text-[44px]">
            {t('title')}
          </h2>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/45">
            {t('subtitle')}
          </p>
        </div>
        <div className="divide-y divide-white/[0.075] border-y border-white/[0.075]">
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.question}>
                <button
                  type="button"
                  id={`go-faq-trigger-${i}`}
                  aria-expanded={isOpen}
                  aria-controls={`go-faq-panel-${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className={cn(
                    'group flex min-h-16 w-full cursor-pointer items-center justify-between gap-5 py-5 text-start text-[15px] font-semibold leading-snug transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
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
                {isOpen && (
                  <div
                    id={`go-faq-panel-${i}`}
                    role="region"
                    aria-labelledby={`go-faq-trigger-${i}`}
                  >
                    <p className="max-w-[62ch] pb-7 pe-4 text-[14px] leading-[1.75] text-white/50">
                      {item.answer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
