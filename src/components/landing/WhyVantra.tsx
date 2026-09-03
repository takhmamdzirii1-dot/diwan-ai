'use client';

import React from 'react';
import { motion } from 'framer-motion';

const ADVANTAGES = [
  {
    number: '01',
    title: 'Pay locally',
    description: 'Top up in DA with local payment support built for Algeria.',
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
                className="grid gap-4 border-t border-white/[0.07] py-7 sm:grid-cols-[3rem_1fr] sm:gap-6 md:py-8"
              >
                <span className="font-mono text-[11px] tracking-[0.2em] text-white/30">
                  {advantage.number}
                </span>
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
