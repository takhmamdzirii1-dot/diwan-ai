'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { PenLine, Sparkles, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';

const STEP_ICONS = [PenLine, Sparkles, Save];

export default function HowItWorks() {
  const t = useTranslations('workflow');
  const steps = t.raw('steps') as { title: string; description: string }[];
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 85%', 'end 55%'],
  });
  const lineScale = useSpring(scrollYProgress, { stiffness: 90, damping: 26 });
  const stepOneOpacity = useTransform(scrollYProgress, [0, 0.08], [0.58, 1]);
  const stepTwoOpacity = useTransform(scrollYProgress, [0.34, 0.52], [0.42, 1]);
  const stepThreeOpacity = useTransform(scrollYProgress, [0.72, 0.9], [0.42, 1]);
  const stepOpacities = [stepOneOpacity, stepTwoOpacity, stepThreeOpacity];

  return (
    <section id="how" className="relative overflow-hidden bg-[#050505]" style={{ paddingTop: 104, paddingBottom: 140 }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:40px_40px]" />
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[920px] max-w-full -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(255,255,255,0.055)_0%,rgba(255,255,255,0.014)_46%,transparent_74%)] blur-3xl" />

      <div className="relative mx-auto max-w-[1450px] px-6 sm:px-8">
        <header className="mx-auto max-w-[1240px] text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.34em] text-white/45">{t('label')}</p>
          <h2 className="mt-7 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-[#f5f5f5] sm:text-5xl lg:text-[58px]">
            {t('title')}
          </h2>
          <p className="mx-auto mt-7 max-w-[900px] text-base leading-relaxed text-white/48 sm:text-xl lg:text-[21px]">
            {t('subtitle')}
          </p>
        </header>

        <div ref={ref} className="relative mt-20 md:mt-[92px]">
          {/* Existing scroll-linked progress, restyled to span the three centered nodes. */}
          <div
            className="absolute left-[16.666%] right-[16.666%] top-[39px] hidden h-px bg-white/[0.12] md:block"
            aria-hidden="true"
          >
            <motion.div
              style={{ scaleX: lineScale }}
              className="relative h-full origin-left bg-white/85 shadow-[0_0_9px_rgba(255,255,255,0.5)] after:absolute after:right-0 after:top-1/2 after:h-[5px] after:w-20 after:-translate-y-1/2 after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.75))] after:blur-[3px]"
            />
          </div>

          <div aria-hidden="true" className="absolute bottom-0 left-[39px] top-[39px] w-px bg-white/[0.1] md:hidden">
            <motion.div style={{ scaleY: lineScale }} className="h-full origin-top bg-white/85 shadow-[0_0_8px_rgba(255,255,255,0.45)]" />
          </div>

          <div className="grid grid-cols-1 gap-14 md:grid-cols-3 md:gap-10">
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
                  className="relative flex min-h-[250px] flex-col items-start ps-[104px] md:items-center md:px-5 md:ps-5 md:text-center"
                >
                  {/* Node */}
                  <motion.div
                    style={{ opacity: stepOpacities[i] }}
                    className="absolute left-0 top-0 z-10 flex h-20 w-20 items-center justify-center rounded-full border border-white/45 bg-[#111113] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_0_0_5px_rgba(255,255,255,0.025),0_0_20px_rgba(255,255,255,0.16)] md:relative md:left-auto md:top-auto"
                  >
                    {Icon && <Icon strokeWidth={1.55} className="h-7 w-7 text-white" />}
                  </motion.div>

                  <motion.div style={{ opacity: stepOpacities[i] }} className="flex flex-col items-start md:items-center">
                    <span dir="ltr" className="mt-4 font-mono text-[13px] tracking-[0.25em] text-white/55">{number}</span>
                    <h3 className="mt-4 text-[22px] font-semibold tracking-[-0.025em] text-[#f5f5f5]">{step.title}</h3>
                    <p className="mt-4 max-w-[330px] text-[15px] leading-[1.65] text-white/52">{step.description}</p>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
