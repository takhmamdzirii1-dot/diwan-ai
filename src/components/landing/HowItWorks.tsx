'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { PenLine, Sparkles, Download } from 'lucide-react';
import { SectionHeading } from './ui';

const STEPS = [
  {
    n: '01',
    icon: PenLine,
    title: 'Describe',
    desc: 'Write a prompt in plain language for the result you want.',
  },
  {
    n: '02',
    icon: Sparkles,
    title: 'Generate',
    desc: 'Create text, images, or video from the same workspace.',
  },
  {
    n: '03',
    icon: Download,
    title: 'Download',
    desc: 'Download generated images directly or revisit saved work in your media library.',
  },
];

export default function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 85%', 'end 55%'],
  });
  const lineScale = useSpring(scrollYProgress, { stiffness: 90, damping: 26 });

  return (
    <section id="how" className="relative overflow-hidden bg-[#050505] !py-14">
      <div className="max-w-6xl mx-auto px-6">
        <div className="[&_h2]:mt-3 [&_h2]:text-3xl md:[&_h2]:text-4xl [&_p:last-child]:mt-3 [&_p:last-child]:text-base">
          <SectionHeading
            label="Workflow"
            title="From thought to artifact in three moves."
            sub="Describe what you need, generate it, then take the result with you."
          />
        </div>

        <div ref={ref} className="relative mt-12 md:mt-14">
          {/* Scroll-linked progress line */}
          <div className="absolute top-[18px] inset-x-[16%] hidden h-px bg-white/[0.07] md:block" aria-hidden="true">
            <motion.div
              style={{ scaleX: lineScale }}
              className="h-full origin-left bg-white/70"
            />
          </div>

          <div className="grid grid-cols-1 divide-y divide-white/[0.07] md:grid-cols-3 md:gap-8 md:divide-y-0">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.45, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="relative flex flex-col py-6 first:pt-0 last:pb-0 md:items-start md:py-0 md:text-start"
                >
                  {/* Node */}
                  <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#0A0A0B]">
                    <Icon className="h-4 w-4 text-white/75" />
                  </div>

                  <span className="mt-4 font-mono text-[11px] tracking-[0.24em] text-white/30">{step.n}</span>
                  <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-white">{step.title}</h3>
                  <p className="mt-2 max-w-xs text-[13.5px] leading-6 text-white/45">{step.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
