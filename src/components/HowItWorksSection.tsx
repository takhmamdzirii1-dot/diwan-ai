'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Cpu, Rocket, ArrowRight, CheckCircle2 } from 'lucide-react';
import SpotlightCard from './SpotlightCard';

const STEPS = [
  {
    step: '01',
    title: 'Top Up in Algerian Dinar (DZD)',
    desc: 'Select your preferred point pack and pay securely via Edahabia or CIB Card with instant SATIM verification.',
    icon: CreditCard,
    details: ['1,500 DZD = 10,000 Points', 'No Visa or Mastercard required', 'Points never expire'],
  },
  {
    step: '02',
    title: 'Select Any AI Engine or API Key',
    desc: 'Switch effortlessly between Claude 3.5 Sonnet, GPT-4o, Flux 1 Pro, Kling Video, or DeepSeek R1 from a single dashboard.',
    icon: Cpu,
    details: ['Direct Playground interface', 'Standard OpenAI API compatibility', 'Instant model switching'],
  },
  {
    step: '03',
    title: 'Generate, Code & Scale Rapidly',
    desc: 'Pay strictly per query or per second of generation. Points are deducted atomically in real-time with zero hidden fees.',
    icon: Rocket,
    details: ['Live ledger balance tracking', 'Priority high-speed GPU queues', 'Download 4K artwork & 1080p video'],
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-28 px-4 md:px-8 border-t border-white/[0.06] relative">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.035] px-3.5 py-1 text-xs font-medium text-[#E6C27A]">
            <Rocket className="h-3.5 w-3.5" />
            <span>Seamless Workflow</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-heading">
            How VANTRA Works in 3 Simple Steps
          </h2>
          <p className="text-sm sm:text-base text-[rgba(245,246,248,0.6)]">
            From recharge to production in less than 60 seconds.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <SpotlightCard key={idx} className="p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-3xl font-bold text-[#E6C27A]/40">
                      {step.step}
                    </span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6C27A]/10 text-[#E6C27A]">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white font-heading">{step.title}</h3>
                    <p className="text-xs sm:text-sm text-[rgba(245,246,248,0.6)] leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-4 space-y-2">
                  {step.details.map((detail, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-[rgba(245,246,248,0.75)]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#E6C27A] shrink-0" />
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
