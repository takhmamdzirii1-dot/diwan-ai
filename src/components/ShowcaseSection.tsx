'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Image as ImageIcon, Terminal, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SpotlightCard } from './landing/ui';


/* ── Live looping render progress (mockup life) ── */
function LiveProgressBar() {
  const [pct, setPct] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setPct((p) => (p >= 100 ? 0 : p + 2)), 90);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-white/70 rounded-full transition-all duration-100" style={{ width: pct + '%' }} />
      </div>
      <span className="text-[9px] font-mono text-white/45 w-8 text-end">{pct}%</span>
    </div>
  );
}

/* ── Massive App Preview — abstract studio mockup ────────── */

function StudioMockup() {
  return (
    <div className="relative mt-32">
      {/* Glow behind the frame */}
      <div
        className="absolute inset-0 before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)]"
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative max-w-6xl mx-auto rounded-2xl border border-white/10 bg-[#0A0A0B] shadow-2xl overflow-hidden"
      >
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-5 py-3.5 border-b border-white/[0.05] bg-white/[0.01]">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="mx-auto text-[10px] font-mono tracking-[0.2em] uppercase text-white/25">
            VANTRA Studio
          </span>
          <span className="w-12" />
        </div>

        {/* App body: chat left, canvas right */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.15fr] divide-y md:divide-y-0 md:divide-x divide-white/[0.05]">
          {/* Chat pane */}
          <div className="p-6 space-y-4 min-h-[380px]">
            <div className="flex items-center gap-2.5 pb-2">
              <MessageSquare className="h-3.5 w-3.5 text-white/30" />
              <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/30">Chat Studio</span>
            </div>

            {/* User bubble */}
            <div className="flex justify-end">
              <div className="max-w-[78%] rounded-2xl rounded-ee-sm bg-white/[0.07] px-4 py-2.5">
                <div className="h-2 rounded-full bg-white/25 w-36" />
                <div className="h-2 rounded-full bg-white/15 w-24 mt-1.5" />
              </div>
            </div>

            {/* Assistant bubble */}
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 space-y-2">
                <div className="h-2 rounded-full bg-white/20 w-44" />
                <div className="h-2 rounded-full bg-white/10 w-52" />
                <div className="h-2 rounded-full bg-white/10 w-32" />
              </div>
            </div>

            {/* Streaming bubble */}
            <div className="flex justify-start">
              <div className="max-w-[70%] rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 space-y-2">
                <div className="h-2 rounded-full bg-white/[0.08] w-40" />
                <div className="h-2 rounded-full bg-white/[0.05] w-28" />
                <div className="flex gap-1 pt-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-white/20 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>

            {/* Composer skeleton */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 flex items-center justify-between mt-auto">
              <div className="h-2 rounded-full bg-white/10 w-32" />
              <span className="h-8 w-8 rounded-lg bg-white flex items-center justify-center">
                <span className="block h-3 w-3" />
              </span>
            </div>
          </div>

          {/* Image canvas pane */}
          <div className="p-6 space-y-4 min-h-[380px] bg-white/[0.008]">
            <div className="flex items-center gap-2.5 pb-2">
              <ImageIcon className="h-3.5 w-3.5 text-white/30" />
              <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/30">Image Canvas</span>
              <span className="ms-auto text-[9.5px] font-mono px-2 py-0.5 rounded-full border border-white/10 text-white/40">
                16:9
              </span>
            </div>

            {/* Canvas frame with abstract "render" */}
            <div className="relative rounded-xl border border-white/[0.07] bg-[#0D0D0F] aspect-video overflow-hidden flex items-center justify-center">
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/[0.05] blur-3xl" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-white/[0.03] blur-3xl" />
              {/* Abstract composition */}
              <div className="relative w-3/5 h-3/5">
                <div className="absolute inset-x-0 top-1/4 h-px bg-white/15" />
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/10" />
                <div className="absolute left-1/3 top-1/4 h-16 w-16 rounded-full border border-white/25 bg-white/[0.06] blur-[1px]" />
                <div className="absolute right-[12%] bottom-[18%] h-10 w-10 rounded-md border border-white/15 rotate-12" />
              </div>
              <span className="absolute bottom-3 right-3 text-[9.5px] font-mono tracking-[0.16em] uppercase text-white/30">
                Flux.1 Pro · 4K
              </span>
              {/* Live render progress — loops forever */}
              <div className="absolute bottom-3 left-3 right-24">
                <LiveProgressBar />
              </div>
            </div>

            {/* Prompt bar skeleton */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 flex items-center gap-3">
              <div className="h-2 rounded-full bg-white/10 flex-1 max-w-[200px]" />
              <span className="h-7 px-3.5 rounded-full bg-white text-black text-[10px] font-bold flex items-center">
                Generate
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Bento Grid ──────────────────────────────────────────── */

const BENTO = [
  {
    icon: MessageSquare,
    title: 'Chat Studio',
    desc: 'Frontier reasoning models in one clean timeline — streaming answers, code blocks, and documents handled natively.',
    models: ['Claude 3.5', 'Nemotron 3 Ultra', 'GLM 5.2'],
  },
  {
    icon: ImageIcon,
    title: 'Image Canvas',
    desc: 'Cinematic stills from a single prompt. Pick a ratio, drop a reference, and render in seconds.',
    models: ['Flux.1 Pro', 'Midjourney v6.1'],
    visual: true,
  },
  {
    icon: Wallet,
    title: 'Local Payment & APIs',
    desc: 'Top up with Edahabia or CIB in seconds — no international cards. Full developer API for your own builds.',
    models: ['Edahabia', 'CIB', 'REST API'],
    api: true,
  },
] as const;

function BentoCard({
  icon: Icon,
  title,
  desc,
  models,
  visual,
  api,
  index,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  models: readonly string[];
  visual?: boolean;
  api?: boolean;
  index: number;
}) {
  return (
    <SpotlightCard
      className={cn(
        'bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 hover:bg-white/[0.04] transition-colors'
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.55, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.04] flex items-center justify-center mb-5">
          <Icon className="h-4.5 w-4.5 text-white/70" style={{ height: 18, width: 18 }} />
        </div>

        <h3 className="text-[16.5px] font-semibold text-white tracking-tight">{title}</h3>
        <p className="text-white/50 text-[13.5px] leading-relaxed mt-2.5">{desc}</p>

        {/* Image canvas abstract visual */}
        {visual && (
          <div className="mt-6 rounded-xl border border-white/[0.06] bg-[#0D0D0F] aspect-[16/10] overflow-hidden relative flex items-center justify-center">
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/[0.05] blur-3xl" />
            <div className="w-1/2 h-1/2 relative">
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/15" />
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 rounded-full border border-white/25 bg-white/[0.07] blur-[0.5px]" />
            </div>
            <span className="absolute bottom-2.5 right-3 text-[9px] font-mono tracking-[0.16em] uppercase text-white/25">
              Flux.1 Pro
            </span>
          </div>
        )}

        {/* API snippet visual */}
        {api && (
          <div className="mt-6 rounded-xl border border-white/[0.06] bg-[#0D0D0F] p-4 font-mono text-[11px] leading-relaxed" dir="ltr">
            <p className="text-white/30">
              <span className="text-white/55">POST</span> /api/generate/chat
            </p>
            <p className="text-white/45 mt-1.5">
              {'{'} <span className="text-white/70">"model"</span>: <span className="text-white">"claude-3.5"</span>,{' '}
              <span className="text-white/70">"prompt"</span>: <span className="text-white">"…"</span> {'}'}
            </p>
          </div>
        )}

        {/* Model tags */}
        <div className="flex flex-wrap gap-2 mt-6">
          {models.map((m) => (
            <span
              key={m}
              className="text-[10.5px] font-medium px-2.5 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/55"
            >
              {m}
            </span>
          ))}
        </div>
      </motion.div>
    </SpotlightCard>
  );
}

/* ── Section ─────────────────────────────────────────────── */

export default function ShowcaseSection() {
  return (
    <section id="showcase" className="relative bg-[#050505] overflow-hidden">
      {/* Section intro */}
      <div className="max-w-6xl mx-auto px-6 pt-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
        >
          One studio. Every medium.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-xl mx-auto text-white/50 text-lg mt-5"
        >
          Chat, render, and film — a single workspace engineered for speed, paid for in Dinar.
        </motion.p>
      </div>

      {/* App preview */}
      <div className="px-6">
        <StudioMockup />
      </div>

      {/* Bento grid */}
      <div id="models" className="max-w-6xl mx-auto px-6 mt-32 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {BENTO.map((card, i) => (
            <BentoCard key={card.title} {...card} index={i} />
          ))}
        </div>

        {/* Section tag */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center text-[11px] font-mono tracking-[0.24em] uppercase text-white/25 mt-20"
        >
          <Terminal className="inline h-3 w-3 me-2 -mt-0.5" />
          Built for creators who ship
        </motion.p>
      </div>
    </section>
  );
}
