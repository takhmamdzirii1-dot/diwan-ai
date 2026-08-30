'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { SectionHeading } from './ui';

interface Quote {
  quote: string;
  name: string;
  role: string;
}

const ROW_ONE: Quote[] = [
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
  {
    quote: 'The API is what Supabase did for databases, but for generative AI. One key. Done.',
    name: 'Marc D.',
    role: 'Staff Engineer — fintech, Paris',
  },
];

const ROW_TWO: Quote[] = [
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
];

function MarqueeRow({
  items,
  reverse = false,
}: {
  items: Quote[];
  reverse?: boolean;
}) {
  const reduce = useReducedMotion();
  const doubled = [...items, ...items, ...items];

  return (
    <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <motion.div
        className="flex gap-4 w-max py-2"
        animate={reduce ? undefined : { x: reverse ? ['-66.66%', '0%'] : ['0%', '-66.66%'] }}
        transition={{ duration: reverse ? 46 : 52, repeat: Infinity, ease: 'linear' }}
      >
        {doubled.map((q, i) => (
          <figure
            key={`${q.name}-${i}`}
            aria-hidden={i >= items.length}
            className="w-[340px] shrink-0 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-6 backdrop-blur-sm"
          >
            <blockquote className="text-[13px] leading-relaxed text-white/70">"{q.quote}"</blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
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
    <section id="signals" className="relative bg-[#050505] py-32 overflow-hidden">
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
        className="mt-16 space-y-4"
      >
        <MarqueeRow items={ROW_ONE} />
        <MarqueeRow items={ROW_TWO} reverse />
      </motion.div>
    </section>
  );
}
