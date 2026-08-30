'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Terminal } from 'lucide-react';
import { SectionHeading } from './ui';

interface Line {
  text: string;
  tone: 'cmd' | 'flag' | 'json-key' | 'json-val' | 'dim';
}

const SCRIPT: Line[] = [
  { text: '$ curl -X POST https://api.vantra.ai/v1/generate \\', tone: 'cmd' },
  { text: '    -H "Authorization: Bearer sk-vantra-********" \\', tone: 'flag' },
  { text: '    -d \'{ "model": "flux-1-pro", "prompt": "Casbah at golden hour" }\'', tone: 'cmd' },
  { text: '', tone: 'dim' },
  { text: '{', tone: 'json-key' },
  { text: '  "status": "succeeded",', tone: 'json-key' },
  { text: '  "url": "https://cdn.vantra.ai/img/9f2c-4k.png",', tone: 'json-val' },
  { text: '  "credits_left": 499,', tone: 'json-key' },
  { text: '  "latency_ms": 812', tone: 'json-key' },
  { text: '}', tone: 'json-key' },
];

const TONE_CLASS: Record<Line['tone'], string> = {
  cmd: 'text-white/90',
  flag: 'text-white/55',
  'json-key': 'text-white/70',
  'json-val': 'text-white',
  dim: 'text-white/30',
};

export default function TerminalShowcase() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { once: true, margin: '-120px' });

  const [progress, setProgress] = useState(0); // total typed characters

  useEffect(() => {
    if (!inView) return;
    const total = SCRIPT.reduce((acc, l) => acc + l.text.length, 0);
    if (progress >= total) {
      const restart = setTimeout(() => setProgress(0), 6000);
      return () => clearTimeout(restart);
    }
    const t = setTimeout(() => setProgress((p) => p + 1), progress === 0 ? 500 : 16);
    return () => clearTimeout(t);
  }, [inView, progress]);

  // Render lines sliced by typed-character budget
  let budget = progress;
  const rendered = SCRIPT.map((line) => {
    const take = Math.max(0, Math.min(line.text.length, budget));
    budget -= take;
    return { ...line, visible: line.text.slice(0, take), done: take >= line.text.length };
  });
  const allDone = progress >= SCRIPT.reduce((acc, l) => acc + l.text.length, 0);

  return (
    <section id="developers" className="relative bg-[#050505] py-32 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_50%_40%_at_70%_50%,rgba(255,255,255,0.04),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-[1fr_1.25fr] gap-16 items-center">
        {/* Copy */}
        <div>
          <SectionHeading
            align="start"
            label="Developers"
            title={<>One endpoint.<br />Every model.</>}
            sub="Ship AI features without juggling six providers, four SDKs, and a spreadsheet of API keys. One key, one bill, streaming by default."
          />

          <motion.ul
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.15 }}
            className="mt-8 space-y-3.5"
          >
            {[
              'Streaming-first REST — tokens and frames as they render',
              'Automatic failover across engines, zero code changes',
              'Signed webhooks when long renders land',
            ].map((point) => (
              <li key={point} className="flex items-start gap-3 text-[13.5px] text-white/60">
                <span className="mt-[7px] h-1 w-1 rounded-full bg-white/50 shrink-0" />
                {point}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* Terminal */}
        <motion.div
          ref={wrapRef}
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-2xl border border-white/10 bg-[#0A0A0B] shadow-2xl overflow-hidden"
        >
          {/* Chrome */}
          <div className="flex items-center gap-1.5 px-5 py-3.5 border-b border-white/[0.05] bg-white/[0.01]">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="mx-auto inline-flex items-center gap-2 text-[10px] font-mono tracking-[0.2em] uppercase text-white/25">
              <Terminal className="h-3 w-3" />
              vantra — zsh
            </span>
            <span className="w-10" />
          </div>

          {/* Typed script */}
          <div className="p-6 font-mono text-[12.5px] leading-[1.9] min-h-[300px]" dir="ltr">
            {rendered.map((line, i) => (
              <div key={i} className={cn2(TONE_CLASS[line.tone], 'whitespace-pre-wrap break-all')}>
                {line.visible}
                {line.visible.length > 0 && line.visible.length < line.text.length && (
                  <span className="inline-block w-[7px] h-[14px] align-middle bg-white/80 animate-pulse rounded-[1px]" />
                )}
                {line.text === '' && <br />}
              </div>
            ))}

            {allDone && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 inline-flex items-center gap-2 text-[11px] font-mono text-white/35"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                499 credits remaining — reset monthly
              </motion.div>
            )}

            {!allDone && <span className="inline-block w-[7px] h-[14px] align-middle bg-white/80 animate-pulse rounded-[1px]" />}
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/[0.05] bg-white/[0.01]">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/25">POST /v1/generate</span>
            <span className="text-[10px] font-mono text-white/40">200 OK · 812ms</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* tiny cn to avoid circular import worries */
function cn2(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
