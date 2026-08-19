'use client';

import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Layers, Lock, MessageSquare, Image as ImageIcon, Video, CheckCircle2 } from 'lucide-react';
import LiveLedgerCard from './LiveLedgerCard';
import ShimmerButton from './ShimmerButton';

// Staggered motion container variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const floatingCardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
};

export default function HeroSection() {
  return (
    <section className="relative min-h-[92vh] flex items-center justify-center pt-24 pb-16 px-4 md:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto w-full">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center"
        >
          {/* Left Column: Hero Copy & Actions */}
          <div className="lg:col-span-7 space-y-7 text-left">
            {/* 1. Animated Badge */}
            <motion.div variants={itemVariants} className="inline-flex items-center">
              <div className="group relative flex items-center gap-2.5 rounded-full border border-white/[0.12] bg-[#0E1017]/80 px-4 py-1.5 backdrop-blur-xl shadow-[0_0_20px_rgba(31,216,184,0.1)] transition-all hover:border-[#1FD8B8]/40">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1FD8B8] opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#1FD8B8]" />
                </span>
                <span className="text-xs md:text-sm font-semibold text-white/90">
                  100% Algerian Platform — Pay directly in DZD
                </span>
                <Sparkles className="h-3.5 w-3.5 text-[#1FD8B8]" />
              </div>
            </motion.div>

            {/* 2. Hero Main Title */}
            <motion.h1
              variants={itemVariants}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]"
            >
              One unified gateway for all AI models,{' '}
              <span className="bg-gradient-to-r from-[#1FD8B8] via-[#8583FF] to-[#1FD8B8] bg-[length:200%_auto] animate-gradient bg-clip-text text-transparent">
                and pay in Algerian Dinar.
              </span>
            </motion.h1>

            {/* 3. Subtitle */}
            <motion.p
              variants={itemVariants}
              className="text-base sm:text-lg text-white/70 max-w-2xl leading-relaxed"
            >
              No need for international cards or multiple subscriptions. VANTRA unifies the world's
              most powerful chat, image, and video generation models in a single credit balance via
              <strong className="text-[#1FD8B8] font-semibold"> EDAHABIA & CIB</strong>.
            </motion.p>

            {/* 4. CTA Button Group */}
            <motion.div
              variants={itemVariants}
              className="flex flex-wrap items-center gap-4 pt-1"
            >
              <ShimmerButton
                text="Get Started & Top Up"
                onClick={() => {
                  const pricingElem = document.getElementById('pricing');
                  if (pricingElem) pricingElem.scrollIntoView({ behavior: 'smooth' });
                  else if (window.location) window.location.href = '#pricing';
                }}
                className="w-full sm:w-auto"
              />

              <motion.a
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                href="#cost-table"
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-[#0E1017]/80 px-6 py-3 text-sm font-semibold text-white/90 backdrop-blur-md transition-all hover:bg-white/[0.06] hover:border-white/[0.2]"
              >
                <Layers className="h-4 w-4 text-[#1FD8B8]" />
                <span>Explore Cost Table</span>
                <ArrowRight className="h-4 w-4 text-white/40" />
              </motion.a>
            </motion.div>

            {/* 5. Floating Interactive AI Badges */}
            <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3 pt-2">
              <motion.div
                variants={floatingCardVariants}
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0E1017]/70 px-3.5 py-2 backdrop-blur-md shadow-sm"
              >
                <MessageSquare className="h-4 w-4 text-[#1FD8B8]" />
                <span className="text-xs font-semibold text-white/90">Claude 3.5 Sonnet</span>
              </motion.div>

              <motion.div
                variants={floatingCardVariants}
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
                className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0E1017]/70 px-3.5 py-2 backdrop-blur-md shadow-sm"
              >
                <ImageIcon className="h-4 w-4 text-[#6E6BFF]" />
                <span className="text-xs font-semibold text-white/90">Flux.1 Pro</span>
              </motion.div>

              <motion.div
                variants={floatingCardVariants}
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
                className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0E1017]/70 px-3.5 py-2 backdrop-blur-md shadow-sm"
              >
                <Video className="h-4 w-4 text-[#F5B942]" />
                <span className="text-xs font-semibold text-white/90">Kling AI 1.5 HD</span>
              </motion.div>
            </motion.div>

            {/* 6. Trust Guarantees */}
            <motion.div
              variants={itemVariants}
              className="flex flex-wrap items-center gap-y-2 gap-x-6 pt-3 text-xs text-white/55"
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#1FD8B8]" />
                <span>Edahabia & CIB Accepted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#6E6BFF]" />
                <span>Non-expiring Credit Points</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-[#F5B942]" />
                <span>Zero Monthly Commitment</span>
              </div>
            </motion.div>

            {/* 7. Key Stats Row */}
            <motion.div
              variants={itemVariants}
              className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-white/[0.08] pt-6"
            >
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">12+</div>
                <div className="text-xs text-white/50">Global Models</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#1FD8B8] font-mono">100%</div>
                <div className="text-xs text-white/50">Local Payment (DZD)</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">0s</div>
                <div className="text-xs text-white/50">Instant Activation</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#F5B942] font-mono">99.9%</div>
                <div className="text-xs text-white/50">High Uptime SLA</div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Live Interactive Ledger Card */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-5 flex justify-center lg:justify-end"
          >
            <LiveLedgerCard />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

export { HeroSection };
