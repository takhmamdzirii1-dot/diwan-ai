'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const IMAGE_MODELS = [
  { id: 'flux-1-pro', name: 'Flux.1 Pro', label: 'Ultra Realism — Default' },
  { id: 'flux-realism-v2', name: 'Flux Realism v2', label: 'Cinematic Lighting' },
  { id: 'sdxl-turbo', name: 'SDXL Turbo', label: 'Lightning Fast' },
] as const;

export const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3'] as const;
export const GEN_COUNTS = [1, 2, 4] as const;

export type ImageModelId = (typeof IMAGE_MODELS)[number]['id'];
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export type GenCount = (typeof GEN_COUNTS)[number];

export type ImageProviderId = 'auto' | 'puter' | 'pollinations' | 'mock';

export interface ImageConfig {
  model: string;
  ratio: AspectRatio;
  count: GenCount;
  provider: ImageProviderId;
}

/** Provider metadata — mirrors lib/ai/image-providers capabilities. */
export const PROVIDERS: {
  id: ImageProviderId;
  name: string;
  note: string;
  models: { id: string; name: string }[];
}[] = [
  {
    id: 'auto',
    name: 'Automatic',
    note: 'Free tier with automatic fallback',
    models: [
      { id: 'flux', name: 'Flux' },
      { id: 'turbo', name: 'Turbo' },
    ],
  },
  {
    id: 'puter',
    name: 'Puter',
    note: 'Uses your own Puter account — free for VANTRA',
    models: [
      { id: 'gpt-image-2', name: 'GPT Image 2' },
      { id: 'gpt-image-1.5', name: 'GPT Image 1.5' },
      { id: 'gpt-image-1-mini', name: 'GPT Image 1 Mini' },
    ],
  },
  {
    id: 'pollinations',
    name: 'Pollinations',
    note: 'Free public tier — 1 render / 15s',
    models: [
      { id: 'flux', name: 'Flux' },
      { id: 'turbo', name: 'Turbo' },
      { id: 'kontext', name: 'Kontext (img2img)' },
    ],
  },
  {
    id: 'mock',
    name: 'Preview (offline)',
    note: 'Placeholder renders, zero cost',
    models: [{ id: 'placeholder', name: 'Placeholder' }],
  },
];

export function modelsForProvider(provider: ImageProviderId) {
  return PROVIDERS.find((p) => p.id === provider)?.models ?? PROVIDERS[0].models;
}

export function providerLabel(provider: ImageProviderId) {
  if (provider === 'auto') return 'Auto';
  return PROVIDERS.find((p) => p.id === provider)?.name ?? 'Auto';
}

interface ImageConfigPopoverProps {
  open: boolean;
  onClose: () => void;
  config: ImageConfig;
  onChange: (next: ImageConfig) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 mb-2 text-[11px] font-sans font-semibold tracking-widest uppercase text-white/40">
      {children}
    </p>
  );
}

export default function ImageConfigPopover({
  open,
  onClose,
  config,
  onChange,
}: ImageConfigPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss on outside click + Escape
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
          aria-label="Image generation settings"
        >
          {/* Provider */}
          <div>
            <SectionLabel>Provider</SectionLabel>
            <div className="space-y-1">
              {PROVIDERS.map((pr) => {
                const active = config.provider === pr.id;
                return (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...config,
                        provider: pr.id,
                        // Reset model when the provider changes — model ids differ
                        model: modelsForProvider(pr.id)[0].id,
                      })
                    }
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer',
                      active ? 'bg-white/10' : 'hover:bg-white/5'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-[12.5px] truncate', active ? 'text-white font-medium' : 'text-white/70')}>
                        {pr.name}
                      </p>
                      <p className="text-[10.5px] text-white/40 truncate">{pr.note}</p>
                    </div>
                    {active && <Check className="h-4 w-4 shrink-0 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model — scoped to the selected provider */}
          <div>
            <SectionLabel>Model</SectionLabel>
            <div className="space-y-1">
              {modelsForProvider(config.provider).map((m) => {
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
                    <p className={cn('min-w-0 flex-1 text-[13px] truncate', active ? 'text-white font-medium' : 'text-white/70')}>
                      {m.name}
                    </p>
                    {active && <Check className="h-4 w-4 shrink-0 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aspect ratio */}
          <div>
            <SectionLabel>Aspect Ratio</SectionLabel>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5">
              {ASPECT_RATIOS.map((r) => {
                const active = config.ratio === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onChange({ ...config, ratio: r })}
                    aria-pressed={active}
                    className={cn(
                      'relative flex-1 h-8 rounded-full text-[12px] font-medium cursor-pointer transition-colors duration-200',
                      active ? 'text-black' : 'text-white/50 hover:text-white/80'
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="popover-ratio-indicator"
                        className="absolute inset-0 z-0 bg-white rounded-full"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative z-10">{r}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generation count */}
          <div>
            <SectionLabel>Images</SectionLabel>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5">
              {GEN_COUNTS.map((c) => {
                const active = config.count === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChange({ ...config, count: c })}
                    aria-pressed={active}
                    className={cn(
                      'relative flex-1 h-8 rounded-full text-[12px] font-medium cursor-pointer transition-colors duration-200',
                      active ? 'text-black' : 'text-white/50 hover:text-white/80'
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="popover-count-indicator"
                        className="absolute inset-0 z-0 bg-white rounded-full"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative z-10">x{c}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cost */}
          <div className="pt-1 border-t border-white/[0.07]">
            <span className="text-white/40 text-xs">
              Cost: {config.count} Image Credit{config.count > 1 ? 's' : ''}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Trigger pill that mirrors the current config, Google Flow style. */
export function ImageConfigPill({
  config,
  open,
  onToggle,
}: {
  config: ImageConfig;
  open: boolean;
  onToggle: () => void;
}) {
  const modelName =
    modelsForProvider(config.provider).find((m) => m.id === config.model)?.name ??
    providerLabel(config.provider);
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
      <span className="truncate max-w-[190px]">
        {modelName} · {config.ratio} · x{config.count}
      </span>
      <ChevronDown
        className={cn('h-3.5 w-3.5 shrink-0 transition-transform duration-200', open && 'rotate-180')}
      />
    </button>
  );
}
