'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { PenLine, Sparkles, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SectionHeading } from './ui';

const STEP_ICONS = [PenLine, Sparkles, Download];

export default function HowItWorks() {
  const t = useTranslations('workflow');
  const steps = t.raw('steps') as { title: string; description: string }[];
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
            label={t('label')}
            title={t('title')}
            sub={t('subtitle')}
          />
        </div>

        <div ref={ref} className="relative mt-12 md:mt-14">
          {/* Scroll-linked progress line — spans from Step 1 icon center to Step 3 icon center */}
          <div
            className="absolute top-[18px] left-[18px] right-[calc(33.333%-39px)] hidden h-px bg-white/[0.07] md:block"
            aria-hidden="true"
          >
            <motion.div
              style={{ scaleX: lineScale }}
              className="h-full origin-left bg-white/70"
            />
          </div>

          <div className="grid grid-cols-1 divide-y divide-white/[0.07] md:grid-cols-3 md:gap-8 md:divide-y-0">
            {steps.map((step, i) => {
              const Icon = STEP_ICONS[i];
              const number = `0${i + 1}`;
              return (
                <motion.div
                  key={number}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.45, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="relative flex flex-col py-6 first:pt-0 last:pb-0 md:items-start md:py-0 md:text-start"
                >
                  {/* Node */}
                  <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#0A0A0B]">
                    {Icon && <Icon className="h-4 w-4 text-white/75" />}
                  </div>

                  <span dir="ltr" className="mt-4 font-mono text-[11px] tracking-[0.24em] text-white/30">{number}</span>
                  <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-white">{step.title}</h3>
                  <p className="mt-2 max-w-xs text-[13.5px] leading-6 text-white/45">{step.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
