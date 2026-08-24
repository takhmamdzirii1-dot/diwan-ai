'use client';

import React from 'react';
import { Gauge, Coins, Zap, Terminal, RotateCcw, Info } from 'lucide-react';

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
  stats: {
    totalTokens: number;
    lastLatencyMs: number | null;
    messageCount: number;
    model: string;
  };
}

const DEFAULT_PARAMS: GenerationParams = { temperature: 0.7, max_tokens: 2048, top_p: 0.95 };

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
  stats,
}: ControlDrawerProps) {
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
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/30">
              Model Parameters
            </p>
            <button
              type="button"
              onClick={() => onParamsChange(DEFAULT_PARAMS)}
              className="flex items-center gap-1 text-[10px] font-mono text-white/30 hover:text-[#00F5D4] transition-colors cursor-pointer"
              title="Reset to defaults"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
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
