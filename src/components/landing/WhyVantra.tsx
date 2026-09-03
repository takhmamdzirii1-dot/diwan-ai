'use client';

import React from 'react';
import { motion } from 'framer-motion';

const ADVANTAGES = [
  {
    number: '01',
    title: 'Pay locally',
    description: 'Pay locally in DA with payment options built for Algeria.',
  },
  {
    number: '02',
    title: 'One balance',
    description: 'Use one balance across Chat, Image and Video without managing separate accounts.',
  },
  {
    number: '03',
    title: 'Leading AI models',
    description: 'Access multiple high-quality AI models from one product.',
  },
  {
    number: '04',
    title: 'One workspace',
    description: 'Move between Chat, Image and Video creation in one unified workspace.',
  },
] as const;

function BenefitVisual({ number }: { number: (typeof ADVANTAGES)[number]['number'] }) {
  if (number === '01') {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[11px] font-medium tracking-[0.08em] text-white/75">
        DA
      </div>
    );
  }

  if (number === '02') {
    return (
      <div className="flex h-10 w-16 flex-col justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5">
        <span className="h-1 w-full rounded-full bg-white/70" />
        <span className="h-1 w-4/5 rounded-full bg-white/40" />
        <span className="h-1 w-3/5 rounded-full bg-white/20" />
      </div>
    );
  }

  if (number === '03') {
    return (
      <div className="grid h-10 w-20 grid-cols-2 gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
        {['Model 01', 'Model 02', 'Model 03', '+ more'].map((label) => (
          <span
            key={label}
            className="flex items-center justify-center rounded border border-white/[0.06] bg-white/[0.025] px-0.5 text-[5px] font-medium tracking-wide text-white/55"
          >
            {label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-10 w-20 items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1 text-[7px] text-white/35">
      <span className="flex h-full flex-1 items-center justify-center rounded bg-white/[0.12] text-white/85">Chat</span>
      <span className="flex h-full flex-1 items-center justify-center">Image</span>
      <span className="flex h-full flex-1 items-center justify-center">Video</span>
    </div>
  );
}

export default function WhyVantra() {
  return (
    <section id="why-vantra" className="relative overflow-hidden bg-[#050505] py-28 md:py-36">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-14 border-t border-white/[0.07] pt-10 md:grid-cols-[0.8fr_1.2fr] md:gap-20 md:pt-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
              Why VANTRA
            </p>
            <h2 className="mt-5 max-w-md text-3xl font-semibold tracking-tight text-white md:text-5xl">
              One place to create with AI.
            </h2>
            <p className="mt-6 max-w-sm text-[15px] leading-7 text-white/45">
              Local access, shared credit and capable models brought together in a single calm workspace.
            </p>
          </motion.div>

          <div className="border-b border-white/[0.07]">
            {ADVANTAGES.map((advantage, index) => (
              <motion.article
                key={advantage.number}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.06,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="grid grid-cols-[2.5rem_5rem_minmax(0,1fr)] gap-3 border-t border-white/[0.07] py-7 sm:grid-cols-[3rem_5rem_minmax(0,1fr)] sm:gap-6 md:py-8"
              >
                <span className="font-mono text-[11px] tracking-[0.2em] text-white/30">
                  {advantage.number}
                </span>
                <div aria-hidden="true" className="pt-0.5">
                  <BenefitVisual number={advantage.number} />
                </div>
                <div>
                  <h3 className="text-lg font-medium tracking-tight text-white">
                    {advantage.title}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
                    {advantage.description}
                  </p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
