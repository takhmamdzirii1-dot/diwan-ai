'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard,
  Zap,
  ShieldCheck,
  Code2,
  Globe2,
  Layers,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import SpotlightCard from './SpotlightCard';

const FEATURES = [
  {
    icon: Layers,
    title: 'One Unified DZD Balance',
    desc: 'Never juggle 5 different foreign AI subscriptions again. Top up your balance in Algerian Dinar and allocate points dynamically across chat, image, coding, and video models on demand.',
    badge: 'Core Feature',
  },
  {
    icon: CreditCard,
    title: 'Instant Local Payment',
    desc: 'Pay directly via EDAHABIA (Algérie Poste) and CIB Bank Cards with SATIM 256-bit encryption. Zero currency conversion fees, instant point delivery in under 5 seconds.',
    badge: '100% Algerian',
  },
  {
    icon: Zap,
    title: 'Ultra-Fast GPU Execution',
    desc: 'Direct priority inference routing through premium high-bandwidth clusters. Enjoy sub-50ms token latency for Claude 3.5 Sonnet, GPT-4o, and DeepSeek R1.',
    badge: 'Low Latency',
  },
  {
    icon: Code2,
    title: 'OpenAI-Compatible API',
    desc: 'Seamlessly plug VANTRA into your existing Cursor, Next.js, Python, or LangChain projects. Just set baseURL to https://api.vantra.dz/v1 and start building immediately.',
    badge: 'For Developers',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise Privacy & Zero Training',
    desc: 'Your proprietary code, business data, and creative prompts are never used to train foundation models. Strict zero-retention policies apply to all production endpoints.',
    badge: 'Confidential',
  },
  {
    icon: Globe2,
    title: 'Native Algerian Darja Optimization',
    desc: 'Optimized system prompts tuned specifically for Algerian Darja, French, and Modern Standard Arabic. Get precise, culturally contextualized outputs every time.',
    badge: 'Trilingual',
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-28 px-4 md:px-8 border-t border-white/[0.06] relative">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.035] px-3.5 py-1 text-xs font-medium text-[#1FD8B8]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Engineered for Algerian Creators</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-heading">
            Why Professionals & Teams Choose VANTRA
          </h2>
          <p className="text-sm sm:text-base text-[rgba(245,246,248,0.6)]">
            Built from the ground up to solve international payment barriers and provide frictionless access to frontier artificial intelligence.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <SpotlightCard key={idx} className="p-8 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1FD8B8]/10 border border-[#1FD8B8]/20 text-[#1FD8B8]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-white/[0.04] border border-white/[0.06] px-3 py-1 text-[11px] font-semibold text-[#1FD8B8]">
                    {feat.badge}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white font-heading">{feat.title}</h3>
                  <p className="text-xs sm:text-sm text-[rgba(245,246,248,0.6)] leading-relaxed">
                    {feat.desc}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/[0.06] flex items-center gap-2 text-xs text-[#1FD8B8] font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Available in all packs</span>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
