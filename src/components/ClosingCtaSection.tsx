'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, CreditCard, Building2, Smartphone, ShieldCheck } from 'lucide-react';
import { useModal } from '../context/ModalContext';
import ShimmerButton from './ShimmerButton';

export default function ClosingCtaSection() {
  const { openAuthModal } = useModal();

  return (
    <section className="py-24 px-4 md:px-8 relative overflow-hidden">
      {/* Background Accent Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#E6C27A]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="rounded-3xl border border-white/[0.08] bg-[#0A0B0D]/90 p-8 sm:p-14 text-center space-y-8 shadow-[0_24px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.035] px-4 py-1.5 text-xs font-medium text-[#E6C27A]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Start Building Today</span>
          </div>

          {/* Heading */}
          <div className="space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white font-heading leading-tight">
              Ready to unleash the power of global AI in DZD?
            </h2>
            <p className="text-sm sm:text-base text-[rgba(245,246,248,0.6)]">
              Join thousands of Algerian developers, designers, agencies, and university students accelerating their workflows with VANTRA.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <ShimmerButton
              text="Get Started & Top Up in DZD"
              onClick={() => openAuthModal('signup')}
              className="text-sm px-8 py-3.5"
            />
            <a
              href="#cost-table"
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.035] px-6 py-3 text-sm font-medium text-white transition hover:bg-white/[0.065]"
            >
              <span>Compare Model Pricing</span>
              <ArrowRight className="h-4 w-4 text-[#E6C27A]" />
            </a>
          </div>

          {/* Payment Badges */}
          <div className="border-t border-white/[0.06] pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-[rgba(245,246,248,0.6)]">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[#E6C27A]" />
              <span>Edahabia Card (Algérie Poste)</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#E6C27A]" />
              <span>CIB Bank Cards (SATIM)</span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-[#E6C27A]" />
              <span>BaridiMob Fast Confirmation</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
