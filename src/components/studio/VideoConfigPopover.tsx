'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const VIDEO_MODELS = [
  { id: 'runway-gen-3', name: 'Runway Gen-3', label: 'Hyper-Realistic' },
  { id: 'kling-ai-1-5', name: 'Kling AI 1.5', label: 'Cinematic Motion' },
] as const;

export const DURATIONS = ['5s', '10s'] as const;

export const CAMERA_MOTIONS = [
  'Static Shot',
  'Cinematic Drone Flyover',
  'Slow Push In',
  'Orbit Around Subject',
  'Handheld Follow',
  'Crane Up Reveal',
] as const;

export type VideoModelId = (typeof VIDEO_MODELS)[number]['id'];
export type VideoDuration = (typeof DURATIONS)[number];
export type CameraMotion = (typeof CAMERA_MOTIONS)[number];

export interface VideoConfig {
  model: VideoModelId;
  duration: VideoDuration;
  camera: CameraMotion;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 mb-2 text-[11px] font-sans font-semibold tracking-widest uppercase text-white/40">
      {children}
    </p>
  );
}

export default function VideoConfigPopover({
  open,
  onClose,
  config,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  config: VideoConfig;
  onChange: (next: VideoConfig) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          style={{ transformOrigin: 'bottom right' }}
          className="absolute bottom-full end-0 mb-3 w-[300px] z-50 rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] p-4 space-y-5"
          role="dialog"
          aria-label="Video generation settings"
        >
          {/* Model */}
          <div>
            <SectionLabel>AI Model</SectionLabel>
            <div className="space-y-1">
              {VIDEO_MODELS.map((m) => {
                const active = config.model === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChange({ ...config, model: m.id })}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer',
                      active ? 'bg-white/10' : 'hover:bg-white/5'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-[13px] truncate', active ? 'text-white font-medium' : 'text-white/70')}>
                        {m.name}
                      </p>
                      <p className="text-[11px] text-white/40 truncate">{m.label}</p>
                    </div>
                    {active && <Check className="h-4 w-4 shrink-0 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration */}
          <div>
            <SectionLabel>Duration</SectionLabel>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5">
              {DURATIONS.map((d) => {
                const active = config.duration === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onChange({ ...config, duration: d })}
                    aria-pressed={active}
                    className={cn(
                      'relative flex-1 h-8 rounded-full text-[12px] font-medium cursor-pointer transition-colors duration-200',
                      active ? 'text-black' : 'text-white/50 hover:text-white/80'
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="video-duration-indicator"
                        className="absolute inset-0 z-0 bg-white rounded-full"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative z-10">{d}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Camera motion */}
          <div>
            <SectionLabel>Camera Motion</SectionLabel>
            <div className="relative">
              <select
                value={config.camera}
                onChange={(e) => onChange({ ...config, camera: e.target.value as CameraMotion })}
                aria-label="Camera motion"
                className="w-full appearance-none h-10 ps-3.5 pe-9 rounded-xl bg-white/[0.05] border border-white/10 text-[13px] font-medium text-white/90 outline-none cursor-pointer hover:bg-white/[0.07] transition-colors focus:border-white/30"
              >
                {CAMERA_MOTIONS.map((c) => (
                  <option key={c} value={c} className="bg-[#1A1C20] text-white">
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Trigger pill mirroring the current video config. */
export function VideoConfigPill({
  config,
  open,
  onToggle,
}: {
  config: VideoConfig;
  open: boolean;
  onToggle: () => void;
}) {
  const modelName = VIDEO_MODELS.find((m) => m.id === config.model)?.name ?? 'Model';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        'shrink-0 inline-flex items-center gap-2 h-8 ps-3 pe-2.5 rounded-full border text-[12px] font-medium transition-colors cursor-pointer',
        open
          ? 'border-white/25 bg-white/10 text-white'
          : 'border-white/10 bg-white/[0.04] text-white/70 hover:text-white hover:bg-white/[0.08]'
      )}
    >
      <span className="truncate max-w-[210px]">
        {modelName} · {config.duration}
      </span>
      <ChevronDown
        className={cn('h-3.5 w-3.5 shrink-0 transition-transform duration-200', open && 'rotate-180')}
      />
    </button>
  );
}
