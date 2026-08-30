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
    desc: 'Write a prompt in plain language — Darja, French, or English. The router picks the strongest engine for the job automatically.',
  },
  {
    n: '02',
    icon: Sparkles,
    title: 'Generate',
    desc: 'Text, images, or film — rendered on priority GPUs and streamed live as the result forms, token by token.',
  },
  {
    n: '03',
    icon: Download,
    title: 'Own it',
    desc: 'Download in full resolution with commercial rights included. No watermarks. No strings. Your work is yours.',
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
    <section id="how" className="relative bg-[#050505] py-32 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeading
          label="Workflow"
          title="From thought to artifact in three moves."
          sub="No model directories. No GPU wrangling. VANTRA collapses the entire AI stack into one calm surface."
        />

        <div ref={ref} className="relative mt-24">
          {/* Scroll-linked progress line */}
          <div className="hidden md:block absolute top-[22px] inset-x-[16%] h-px bg-white/[0.07]" aria-hidden="true">
            <motion.div
              style={{ scaleX: lineScale }}
              className="h-full origin-left bg-white/70"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-14 md:gap-8">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, y: 26 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.55, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                  className="relative flex flex-col items-center text-center md:items-start md:text-start"
                >
                  {/* Node */}
                  <div className="relative z-10 h-11 w-11 rounded-full border border-white/15 bg-[#0A0A0B] flex items-center justify-center shadow-[0_0_30px_-6px_rgba(255,255,255,0.25)]">
                    <Icon className="h-4.5 w-4.5 text-white/80" style={{ height: 18, width: 18 }} />
                  </div>

                  <span className="mt-6 text-[11px] font-mono tracking-[0.24em] text-white/30">{step.n}</span>
                  <h3 className="mt-2 text-[19px] font-semibold text-white tracking-tight">{step.title}</h3>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-white/45 max-w-xs">{step.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
