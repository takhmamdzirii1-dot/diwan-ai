'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { SectionHeading } from './ui';

interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

// Launch placeholders: replace entries here with verified beta-user feedback.
const TESTIMONIAL_ROWS: Testimonial[][] = [
  [
    {
      quote: 'I cancelled three subscriptions the week I found VANTRA. One balance, every model I actually use.',
      name: 'Amina K.',
      role: 'Art Director — Casbah Creative',
    },
    {
      quote: 'The video renders are genuinely unreal. My clients think I hired a motion team in Eastern Europe.',
      name: 'Yacine B.',
      role: 'Indie Hacker — shipped 4 products',
    },
    {
      quote: 'Paying with Edahabia felt like a prank the first time. It just works. Every single time.',
      name: 'Lina H.',
      role: 'Founder — Dzair Labs',
    },
  ],
  [
    {
      quote: 'Our agency ships 40 client assets a week through VANTRA now. The queue priority alone pays for Pro.',
      name: 'Sofiane T.',
      role: 'Creative Lead — Studio 16',
    },
    {
      quote: 'Darja prompts understood better than any global platform. Finally, AI that speaks like my customers.',
      name: 'Nour E.',
      role: 'Social Media Manager',
    },
    {
      quote: 'Latency is a feature. Streaming responses at this speed changed how our support team operates.',
      name: 'Karim A.',
      role: 'CTO — logistics SaaS',
    },
    {
      quote: 'It is the calmest AI interface I have ever used. No dashboard spaghetti. Just the work.',
      name: 'Elena V.',
      role: 'Product Designer — remote',
    },
  ],
];

function MarqueeRow({
  items,
  reverse = false,
}: {
  items: Testimonial[];
  reverse?: boolean;
}) {
  const reduce = useReducedMotion();
  const doubled = [...items, ...items, ...items];

  return (
    <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <motion.div
        className="flex w-max gap-3 py-1.5 md:gap-4 md:py-2"
        animate={reduce ? undefined : { x: reverse ? ['-66.66%', '0%'] : ['0%', '-66.66%'] }}
        transition={{ duration: reverse ? 46 : 52, repeat: Infinity, ease: 'linear' }}
      >
        {doubled.map((q, i) => (
          <figure
            key={`${q.name}-${i}`}
            aria-hidden={i >= items.length}
            className="w-[min(82vw,360px)] shrink-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 md:p-6"
          >
            <blockquote className="text-sm leading-6 text-white/70">"{q.quote}"</blockquote>
            <figcaption className="mt-5 flex items-center gap-3">
              <span className="h-8 w-8 rounded-lg bg-white/[0.08] border border-white/10 flex items-center justify-center text-[11px] font-bold text-white/80">
                {q.name[0]}
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium text-white/90 truncate">{q.name}</span>
                <span className="block text-[11px] text-white/35 truncate">{q.role}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </motion.div>
    </div>
  );
}

export default function Testimonials() {
  return (
    <section id="signals" className="relative overflow-hidden bg-[#050505] !py-24 md:!py-28">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeading
          label="Signals"
          title="The word from Algiers to SF."
          sub="Creators, engineers, and studios running real work on VANTRA every day."
        />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="mt-12 space-y-3 md:mt-14 md:space-y-4"
      >
        {TESTIMONIAL_ROWS.map((items, index) => (
          <MarqueeRow key={index} items={items} reverse={index % 2 === 1} />
        ))}
      </motion.div>
    </section>
  );
}
