'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Lock, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LiquidMetalButton } from '@/components/ui/liquid-metal-button';
import { HERO_STAT_VALUES } from '../content/marketingFacts';
import { Magnetic } from './landing/ui';

interface HeroSectionProps {
  user: { email?: string } | null;
  onEnterStudio: (prompt?: string) => void;
  onRequireAuth: () => void;
}

/* Three thin monochrome "paths" with slow traveling light dots */
const PATHS = [
  { left: '30%', rotate: -14, duration: 7, delay: 0 },
  { left: '50%', rotate: 0, duration: 9, delay: 1.4 },
  { left: '70%', rotate: 14, duration: 8, delay: 2.6 },
];

export default function HeroSection({ user, onEnterStudio, onRequireAuth }: HeroSectionProps) {
  const t = useTranslations('hero');
  const stats = (t.raw('stats') as { label: string }[]).map((stat, index) => ({
    ...stat,
    number: HERO_STAT_VALUES[index],
  }));
  const reduce = useReducedMotion();
  const [heroPrompt, setHeroPrompt] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [simDone, setSimDone] = useState(false);
  const [lastPrompt, setLastPrompt] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const seed = lastPrompt ? `hero-${hashSeed(lastPrompt)}` : 'vantra-hero';
  const simSrc = `https://picsum.photos/seed/vantra-${seed}/1024/576`;

  // Save the prompt so the Studio can prefill it after auth/navigation
  const stashPrompt = (p: string) => {
    try {
      sessionStorage.setItem('vantra_pending_prompt', p);
    } catch {}
  };

  const submit = () => {
    const p = heroPrompt.trim();
    if (!p || simulating) return;
    setLastPrompt(p);
    stashPrompt(p);

    if (user) {
      onEnterStudio(p); // signed in → cinematic jump straight into the Studio
      return;
    }
    // Guest lure: simulate the render, then ask for the account
    setSimulating(true);
    setSimDone(false);
    setSimProgress(0);
  };

  // Simulated render progress
  useEffect(() => {
    if (!simulating || reduce) {
      if (simulating && reduce) {
        setSimProgress(100);
        setSimDone(true);
        setSimulating(false);
      }
      return;
    }
    const t = setInterval(() => {
      setSimProgress((prev) => {
        const next = prev + 3 + Math.random() * 6;
        if (next >= 100) {
          clearInterval(t);
          setSimulating(false);
          setSimDone(true);
          return 100;
        }
        return next;
      });
    }, 70);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulating, reduce]);

  const handlePrimaryAction = () => {
    if (user) {
      onEnterStudio();
    } else {
      onRequireAuth();
    }
  };

  const claim = () => {
    onRequireAuth(); // auth modal — prompt already stashed, Studio prefills after
  };

  return (
    <section id="hero" className="relative min-h-screen bg-[#050505] overflow-hidden">
      {/* ── Canvas ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_50%_0%,rgba(255,255,255,0.07),transparent_70%)]" />
        <div className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,black,transparent)]" />

        {PATHS.map((p, i) => (
          <div
            key={i}
            className="absolute top-0 h-[75vh] w-px"
            style={{
              left: p.left,
              transform: `rotate(${p.rotate}deg)`,
              transformOrigin: 'top center',
              background:
                'linear-gradient(to bottom, transparent, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0.03) 80%, transparent)',
            }}
          >
            {!reduce && (
              <motion.span
                className="absolute -start-[2.5px] h-[5px] w-[5px] rounded-full bg-white"
                style={{ boxShadow: '0 0 10px 2px rgba(255,255,255,0.35)' }}
                animate={{ top: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
                transition={{ duration: p.duration, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
              />
            )}
          </div>
        ))}

        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#050505]" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col items-center text-center justify-center pt-36 md:pt-28 lg:pt-14 pb-20 px-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="border border-white/[0.12] bg-white/[0.04] backdrop-blur-md rounded-full px-4 py-1.5 text-xs font-medium text-white/75"
        >
          {t('badge')}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="mx-auto max-w-3xl leading-[1.08] text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 mt-8"
        >
          {t('title')}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.16 }}
          className="max-w-2xl text-white/55 text-lg mt-6 leading-relaxed"
        >
          {t('subtitle')}
        </motion.p>

        {/* ── THE HOOK: interactive prompt bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.24 }}
          className="w-full max-w-xl mt-10"
        >
          <AnimatePresence mode="wait">
            {!simDone ? (
              <motion.div
                key="prompt"
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-2 flex items-center gap-2 shadow-[0_8px_40px_-16px_rgba(255,255,255,0.12)] focus-within:border-white/25 transition-colors"
              >
                <Sparkles className="h-4 w-4 text-white/40 shrink-0 ms-2.5" aria-hidden="true" />
                <input
                  ref={inputRef}
                  type="text"
                  value={heroPrompt}
                  onChange={(e) => setHeroPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder={t('placeholder')}
                  dir="auto"
                  maxLength={300}
                  aria-label={t('inputLabel')}
                  className="flex-1 min-w-0 bg-transparent border-0 outline-none text-white text-[14px] placeholder:text-white/35 py-2.5"
                />
                <LiquidMetalButton viewMode="icon" label={t('generate')} onClick={submit} />
              </motion.div>
            ) : (
              <motion.div
                key="claim"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-xl p-3 shadow-[0_0_60px_-12px_rgba(255,255,255,0.25)]"
              >
                <div className="relative rounded-xl overflow-hidden aspect-video">
                  <img
                    src={simSrc}
                    alt={t('previewAlt')}
                    className="w-full h-full object-cover blur-lg scale-110"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45">
                    <Lock className="h-5 w-5 text-white/85" />
                    <p className="text-[13.5px] font-medium text-white">{t('ready')}</p>
                    <button
                      type="button"
                      onClick={claim}
                      className="h-10 px-6 rounded-xl bg-white text-black text-[13px] font-semibold hover:bg-gray-200 transition-colors cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    >
                      {t('reveal')}
                    </button>
                    <p className="text-[10.5px] text-white/45">
                      {t('promptSaved')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSimDone(false);
                    setSimulating(false);
                    setSimProgress(0);
                    inputRef.current?.focus();
                  }}
                  className="mt-2.5 text-[11px] text-white/40 hover:text-white/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded px-1"
                >
                  {t('tryAgain')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Simulating progress strip */}
          <AnimatePresence>
            {simulating && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 flex items-center gap-3">
                  <span className="text-[11px] font-mono text-white/50 shrink-0">
                    {t('rendering', { progress: Math.round(simProgress) })}
                  </span>
                  <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-white/80 rounded-full transition-all duration-100"
                      style={{ width: `${simProgress}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.34 }}
          className="flex flex-col sm:flex-row items-center gap-4 mt-10"
        >
          <Magnetic strength={0.18}>
            <LiquidMetalButton
              label={user ? t('openStudio') : t('start')}
              onClick={handlePrimaryAction}
            />
          </Magnetic>
          <a
            href="#pricing"
            className="h-[46px] px-7 inline-flex items-center rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-md text-[14.5px] font-medium text-white/60 hover:text-white/90 hover:bg-white/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {t('seePricing')}
          </a>
        </motion.div>

        {/* Local payment trust line */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.42 }}
          className="mt-8 text-[11px] tracking-[0.12em] text-white/55"
        >
          {t('trust')}
        </motion.p>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.44 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-[68px] border-t border-white/[0.06] pt-10 max-w-5xl mx-auto w-full"
        >
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-2">
              <span dir="ltr" className="text-3xl font-bold text-white">{s.number}</span>
              <span className="text-sm text-white/45">{s.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* Tiny deterministic seed from the prompt */
function hashSeed(input: string) {
  return input.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
}
