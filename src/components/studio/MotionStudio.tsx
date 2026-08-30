'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clapperboard, Loader2 } from 'lucide-react';
import { LiquidMetalButton } from '@/components/ui/liquid-metal-button';
import { cn } from '@/lib/utils';
import { getModelCost } from '../../config/pricing';
import VideoConfigPopover, {
  VideoConfigPill,
  VIDEO_MODELS,
  type VideoConfig,
} from './VideoConfigPopover';

const DOT_GRID =
  'url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2720%27%20height%3D%2720%27%20viewBox%3D%270%200%2020%2020%27%3E%3Ccircle%20cx%3D%2710%27%20cy%3D%2710%27%20r%3D%270.5%27%20fill%3D%27white%27%2F%3E%3C%2Fsvg%27")';

export default function MotionStudio() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState<VideoConfig>({
    model: 'kling-ai-1-5',
    duration: '5s',
    camera: 'Cinematic Drone Flyover',
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const baseCost = getModelCost(config.model) || 240;
  const cost = baseCost * (config.duration === '10s' ? 2 : 1);
  const modelName = VIDEO_MODELS.find((m) => m.id === config.model)?.name ?? 'Model';

  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setGenError(null);
    try {
      // Placeholder render pipeline — wire the provider here.
      await new Promise((resolve) => setTimeout(resolve, 3200));
    } catch {
      setGenError('Rendering failed — please try again');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* ── Cinematic canvas ── */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: DOT_GRID, opacity: 0.03 }}
          aria-hidden="true"
        />
        {/* Corner glows */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />

        <div className="absolute inset-0 flex items-center justify-center p-4">
          <AnimatePresence mode="wait">
            {isGenerating ? (
              <motion.div
                key="rendering"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                className="w-full max-w-sm flex flex-col items-center text-center"
              >
                <motion.div
                  animate={{ opacity: [0.45, 1, 0.45] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="h-16 w-16 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center"
                >
                  <Clapperboard className="h-7 w-7 text-white/70" />
                </motion.div>

                <motion.p
                  animate={{ opacity: [0.55, 1, 0.55] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="mt-6 text-[15px] font-medium text-white"
                  style={{ textShadow: '0 0 24px rgba(255,255,255,0.35)' }}
                >
                  Rendering Cinematic Scene…
                </motion.p>
                <p className="mt-1.5 text-[11.5px] text-white/35">
                  {modelName} · {config.duration} · {config.camera}
                </p>

                {/* Progress bar */}
                <div className="mt-6 w-full h-[3px] rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    initial={{ x: '-40%' }}
                    animate={{ x: '140%' }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    className="h-full w-2/5 rounded-full bg-white/70"
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center text-center select-none"
              >
                {/* Film reel — subtle breathing glow */}
                <motion.div
                  animate={{ scale: [0.98, 1.02, 0.98] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="h-20 w-20 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center"
                  style={{ boxShadow: '0 0 60px -20px rgba(255,255,255,0.25)' }}
                >
                  <svg width="44" height="44" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                    <circle cx="24" cy="24" r="17" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" />
                    <circle cx="24" cy="24" r="4" fill="white" fillOpacity="0.55" />
                    <circle cx="24" cy="12" r="3" fill="white" fillOpacity="0.3" />
                    <circle cx="24" cy="36" r="3" fill="white" fillOpacity="0.3" />
                    <circle cx="12" cy="24" r="3" fill="white" fillOpacity="0.3" />
                    <circle cx="36" cy="24" r="3" fill="white" fillOpacity="0.3" />
                  </svg>
                </motion.div>

                <p className="mt-6 text-[15px] font-medium text-white/70">Motion Studio</p>
                <p className="mt-1.5 text-xs text-white/25 max-w-xs">
                  Describe a scene below, tune the shot, and render.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Floating command bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative shrink-0"
      >
        <div className="max-w-3xl mx-auto px-4 pb-4 pt-2">
          {/* Single-line glassmorphic command bar — VANTRA composer standard */}
          <div className="relative backdrop-blur-xl bg-[#0A0A0B]/90 border border-white/5 rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.03)]">
            <div className="flex flex-row items-center gap-2 px-3 py-2.5">
              {/* Text input — flex-1 */}
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isGenerating) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                placeholder="Describe the scene you want to film…"
                dir="auto"
                disabled={isGenerating}
                aria-label="Video prompt"
                className="flex-1 min-w-0 bg-transparent border-0 outline-none text-white text-[14px] placeholder:text-white/30 antialiased font-sans"
              />

              {/* Settings pill — subtle */}
              <div className="relative shrink-0">
                <VideoConfigPill
                  config={config}
                  open={configOpen}
                  onToggle={() => setConfigOpen((v) => !v)}
                />
                <VideoConfigPopover
                  open={configOpen}
                  onClose={() => setConfigOpen(false)}
                  config={config}
                  onChange={setConfig}
                />
              </div>

              {/* Liquid metal generate — right edge */}
              <div className="shrink-0">
                <LiquidMetalButton
                  viewMode="icon"
                  label="Generate"
                  onClick={handleGenerate}
                />
              </div>
            </div>

            {genError && <p className="px-4 pb-2.5 -mt-1 text-[11.5px] text-red-400/90">{genError}</p>}
          </div>

          {/* Cost — outside the bar, right-aligned, tiny */}
          <div className="flex justify-end px-2 pt-2">
            <span className="text-[10px] text-white/30 uppercase tracking-widest">
              {cost} pts
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
