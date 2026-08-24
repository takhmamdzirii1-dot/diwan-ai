'use client';

import React, { useState } from 'react';
import { ChevronDown, Info, Gauge, Coins, Zap, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GenerationParams {
  temperature: number;
  max_tokens: number;
  top_p: number;
}

export interface ControlDrawerProps {
  open: boolean;
  onClose: () => void;
  params: GenerationParams;
  onParamsChange: (p: GenerationParams) => void;
  systemPreset: string;
  onSystemPresetChange: (id: string) => void;
  stats: {
    totalTokens: number;
    lastLatencyMs: number | null;
    messageCount: number;
    model: string;
  };
}

export const SYSTEM_PRESETS: { id: string; label: string; prompt: string }[] = [
  { id: 'default', label: 'Default', prompt: '' },
  {
    id: 'developer',
    label: 'Senior Developer',
    prompt:
      'You are a senior software architect. Give production-grade code with brief explanations, edge cases, and performance notes. Prefer TypeScript.',
  },
  {
    id: 'marketer',
    label: 'Growth Marketer',
    prompt:
      'You are a world-class growth marketer. Write persuasive, high-converting copy adapted to Algerian and MENA audiences.',
  },
  {
    id: 'darja',
    label: 'Darja Tutor',
    prompt:
      'You are a patient Algerian Darja tutor. Reply bilingually: first in Algerian Darja (Latin or Arabic script), then a clear English explanation.',
  },
  {
    id: 'custom',
    label: 'Custom',
    prompt: '',
  },
];

function Slider({
  label,
  hint,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="lux-tip text-[11.5px] font-medium text-white/65 flex items-center gap-1.5" data-tip={hint}>
          {label}
          <Info className="h-3 w-3 text-white/25" />
        </span>
        <span className="text-[11px] font-mono text-[#00E5FF]/90">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="lux-slider"
        aria-label={label}
      />
    </div>
  );
}

export default function ControlDrawer({
  open,
  onClose,
  params,
  onParamsChange,
  systemPreset,
  onSystemPresetChange,
  stats,
}: ControlDrawerProps) {
  const [presetsOpen, setPresetsOpen] = useState(true);
  const [customPrompt, setCustomPrompt] = useState('');

  const preset = SYSTEM_PRESETS.find((p) => p.id === systemPreset) || SYSTEM_PRESETS[0];

  const body = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-[60px] shrink-0 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <Gauge className="h-4 w-4 text-[#9D4EDD]" />
          <span className="text-[13px] font-semibold text-white/90 tracking-wide">Control Room</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="xl:hidden p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          aria-label="Close drawer"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar-thin px-5 py-5 space-y-7">
        {/* ── Model Parameters ── */}
        <section className="space-y-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/30">
            Model Parameters
          </p>
          <Slider
            label="Temperature"
            hint="Higher = more creative, lower = more precise"
            min={0}
            max={2}
            step={0.1}
            value={params.temperature}
            onChange={(v) => onParamsChange({ ...params, temperature: v })}
            format={(v) => v.toFixed(1)}
          />
          <Slider
            label="Max Tokens"
            hint="Maximum length of the AI response"
            min={256}
            max={8192}
            step={128}
            value={params.max_tokens}
            onChange={(v) => onParamsChange({ ...params, max_tokens: v })}
            format={(v) => `${(v / 1024).toFixed(1)}K`}
          />
          <Slider
            label="Top-P"
            hint="Nucleus sampling — vocabulary diversity"
            min={0.05}
            max={1}
            step={0.05}
            value={params.top_p}
            onChange={(v) => onParamsChange({ ...params, top_p: v })}
            format={(v) => v.toFixed(2)}
          />
        </section>

        {/* ── System Instructions ── */}
        <section className="space-y-2.5">
          <button
            type="button"
            onClick={() => setPresetsOpen((o) => !o)}
            className="w-full flex items-center justify-between group cursor-pointer"
          >
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/30 group-hover:text-white/50 transition-colors">
              System Instructions
            </span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-white/30 transition-transform duration-300',
                presetsOpen && 'rotate-180'
              )}
            />
          </button>

          {presetsOpen && (
            <div className="space-y-1.5 animate-fade-in">
              {SYSTEM_PRESETS.map((p) => {
                const active = systemPreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSystemPresetChange(p.id)}
                    className={cn(
                      'w-full text-start px-3 py-2 rounded-xl text-[12px] font-medium transition-all duration-200 cursor-pointer active:scale-[0.98]',
                      active
                        ? 'nav-pill-active text-white'
                        : 'text-white/45 hover:text-white/85 hover:bg-white/[0.04] border border-transparent'
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}

              {systemPreset === 'custom' && (
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  onBlur={() => {
                    const evt = new CustomEvent('vantra-custom-system', { detail: customPrompt });
                    window.dispatchEvent(evt);
                  }}
                  placeholder="Write your custom system instruction..."
                  rows={4}
                  className="w-full mt-1 rounded-xl bg-white/[0.03] border border-white/[0.08] focus:border-[#00F5D4]/40 p-3 text-[12px] text-white placeholder-white/25 outline-none resize-none transition-colors"
                />
              )}

              {preset.prompt && systemPreset !== 'custom' && (
                <p className="text-[10.5px] leading-relaxed text-white/30 bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 line-clamp-3">
                  {preset.prompt}
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── Real-time stats ── */}
        <section className="space-y-2.5">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/30">
            Live Telemetry
          </p>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.05] overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-3">
              <span className="flex items-center gap-2 text-[11.5px] text-white/50">
                <Coins className="h-3.5 w-3.5 text-[#00F5D4]/70" /> Tokens used
              </span>
              <span className="text-[12px] font-mono text-white/90">
                {stats.totalTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-3">
              <span className="flex items-center gap-2 text-[11.5px] text-white/50">
                <Zap className="h-3.5 w-3.5 text-[#E8C87A]/70" /> Latency
              </span>
              <span className="text-[12px] font-mono text-white/90">
                {stats.lastLatencyMs ? `${(stats.lastLatencyMs / 1000).toFixed(2)}s` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-3">
              <span className="flex items-center gap-2 text-[11.5px] text-white/50">
                <Terminal className="h-3.5 w-3.5 text-[#9D4EDD]/70" /> Messages
              </span>
              <span className="text-[12px] font-mono text-white/90">{stats.messageCount}</span>
            </div>
          </div>

          <p className="text-[10px] text-white/25 leading-relaxed px-1">
            Active model: <span className="text-[#00E5FF]/70 font-mono">{stats.model}</span>
          </p>
        </section>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed drawer */}
      <aside className="hidden xl:flex w-[300px] shrink-0 h-full bronze-border rounded-none border-y-0 border-r-0 flex-col relative z-10">
        {body}
      </aside>

      {/* Mobile/tablet slide-over */}
      {open && (
        <div className="xl:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute top-0 bottom-0 right-0 w-[320px] max-w-[88vw] bronze-border rounded-none flex flex-col shadow-2xl animate-fade-in">
            {body}
          </aside>
        </div>
      )}
    </>
  );
}
