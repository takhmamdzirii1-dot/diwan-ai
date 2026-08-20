'use client';

import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Layers, MessageSquare, Image as ImageIcon, Video, CheckCircle2 } from 'lucide-react';
import LiveLedgerCard from './LiveLedgerCard';
import ShimmerButton from './ShimmerButton';
import HeroCinematicBackground from './HeroCinematicBackground';
import { useModal } from '../context/ModalContext';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.07,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(3px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const floatingCardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export interface HeroSectionProps {
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
}

export default function HeroSection({ onOpenAuth }: HeroSectionProps) {
  const { openAuthModal } = useModal();

  const handleGetStarted = () => {
    if (onOpenAuth) {
      onOpenAuth('signup');
    } else {
      openAuthModal('signup');
    }
  };

  return (
    <section className="relative min-h-[92vh] flex items-center justify-center pt-32 pb-20 px-4 md:px-8 overflow-hidden">
      {/* Dynamic Cinematic Canvas & Quantum Beam Shader */}
      <HeroCinematicBackground speed={1.0} beamIntensity={0.95} />

      <div className="max-w-7xl mx-auto w-full relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center"
        >
          {/* Left Column: Hero Copy & Actions */}
          <div className="lg:col-span-7 space-y-7 text-left">
            {/* 1. Animated Badge */}
            <motion.div variants={itemVariants} className="inline-flex items-center">
              <div className="group relative flex items-center gap-2.5 rounded-full border border-white/[0.06] bg-white/[0.035] px-4 py-1.5 backdrop-blur-xl transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-white/[0.12]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1FD8B8] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1FD8B8]" />
                </span>
                <span className="text-xs md:text-sm font-medium text-[#F5F6F8]">
                  100% Algerian Platform — Pay directly in DZD
                </span>
                <Sparkles className="h-3.5 w-3.5 text-[#1FD8B8]" />
              </div>
            </motion.div>

            {/* 2. Hero Main Title (6: 700 font weight) */}
            <motion.h1
              variants={itemVariants}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-[#F5F6F8] leading-[1.15]"
            >
              One unified gateway for all AI models,{' '}
              <span className="bg-gradient-to-r from-[#1FD8B8] via-[#8583FF] to-[#1FD8B8] bg-[length:200%_auto] animate-gradient bg-clip-text text-transparent">
                and pay in Algerian Dinar.
              </span>
            </motion.h1>

            {/* 3. Subtitle (Muted text) */}
            <motion.p
              variants={itemVariants}
              className="text-base sm:text-lg text-[rgba(245,246,248,0.6)] max-w-2xl leading-relaxed font-sans font-normal"
            >
              No need for international cards or multiple subscriptions. VANTRA unifies the world's
              most powerful chat, image, and video generation models in a single credit balance via
              <strong className="text-[#1FD8B8] font-medium"> EDAHABIA & CIB</strong>.
            </motion.p>

            {/* 4. CTA Button Group */}
            <motion.div
              variants={itemVariants}
              className="flex flex-wrap items-center gap-4 pt-1"
            >
              <ShimmerButton
                text="Get Started & Top Up"
                onClick={handleGetStarted}
                className="w-full sm:w-auto"
              />

              <motion.a
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                href="#cost-table"
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.035] px-6 py-3 text-sm font-medium text-[#F5F6F8] backdrop-blur-xl transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/[0.065] hover:border-white/[0.12]"
              >
                <Layers className="h-4 w-4 text-[#1FD8B8]" />
                <span>Explore Cost Table</span>
                <ArrowRight className="h-4 w-4 text-[rgba(245,246,248,0.4)]" />
              </motion.a>
            </motion.div>

            {/* 5. Floating Interactive AI Badges */}
            <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3 pt-2">
              <motion.div
                variants={floatingCardVariants}
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.035] px-4 py-2 backdrop-blur-xl"
              >
                <MessageSquare className="h-3.5 w-3.5 text-[#1FD8B8]" />
                <span className="text-xs font-medium text-[#F5F6F8]">Claude 3.5 Sonnet</span>
              </motion.div>

              <motion.div
                variants={floatingCardVariants}
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
                className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.035] px-4 py-2 backdrop-blur-xl"
              >
                <ImageIcon className="h-3.5 w-3.5 text-[#1FD8B8]" />
                <span className="text-xs font-medium text-[#F5F6F8]">Flux.1 Pro</span>
              </motion.div>

              <motion.div
                variants={floatingCardVariants}
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
                className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.035] px-4 py-2 backdrop-blur-xl"
              >
                <Video className="h-3.5 w-3.5 text-[#1FD8B8]" />
                <span className="text-xs font-medium text-[#F5F6F8]">Kling AI 1.5 HD</span>
              </motion.div>
            </motion.div>

            {/* 6. Trust Guarantees */}
            <motion.div
              variants={itemVariants}
              className="flex flex-wrap items-center gap-y-2 gap-x-6 pt-3 text-xs text-[rgba(245,246,248,0.6)]"
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#1FD8B8]" />
                <span>Edahabia & CIB Accepted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#1FD8B8]" />
                <span>Non-expiring Credit Points</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-[#1FD8B8]" />
                <span>Zero Monthly Commitment</span>
              </div>
            </motion.div>

            {/* 7. Key Stats Row */}
            <motion.div
              variants={itemVariants}
              className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-white/[0.06] pt-6"
            >
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-[#F5F6F8] font-mono">12+</div>
                <div className="text-xs text-[rgba(245,246,248,0.6)]">Global Models</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-[#1FD8B8] font-mono">100%</div>
                <div className="text-xs text-[rgba(245,246,248,0.6)]">Local Payment (DZD)</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-[#F5F6F8] font-mono">0s</div>
                <div className="text-xs text-[rgba(245,246,248,0.6)]">Instant Activation</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-[#F5F6F8] font-mono">99.9%</div>
                <div className="text-xs text-[rgba(245,246,248,0.6)]">High Uptime SLA</div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Live Interactive Ledger Card */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-5 flex justify-center lg:justify-end"
          >
            <LiveLedgerCard onOpenAuth={onOpenAuth} />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

export { HeroSection };
