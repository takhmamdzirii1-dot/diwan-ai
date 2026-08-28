'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ImageConfigPopover, {
  ImageConfigPill,
  type ImageConfig,
} from './ImageConfigPopover';
import ImageResultCard, {
  appendToImageLibrary,
  readImageLibrary,
  type GeneratedImage,
} from './ImageResultCard';

export default function ImageCanvas() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [genError, setGenError] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState<ImageConfig>({
    model: 'flux-1-pro',
    ratio: '1:1',
    count: 1,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restore the persisted library on mount
  useEffect(() => {
    setGeneratedImages(readImageLibrary());
  }, []);

  // Auto-grow textarea (capped at max-h-32 = 128px, then scrolls invisibly)
  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    const usedPrompt = prompt.trim();
    setIsGenerating(true);
    setGenError(null);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: usedPrompt,
          model: config.model,
          ratio: config.ratio,
          count: config.count,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      const fresh: GeneratedImage[] = (Array.isArray(data.images) ? data.images : []).map(
        (im: { url: string; width?: number; height?: number }) => ({
          ...im,
          prompt: usedPrompt,
          ratio: config.ratio,
          model: data.model || config.model,
          createdAt: Date.now(),
        })
      );

      // Newest first — Google Flow style feed
      setGeneratedImages((prev) => [...fresh, ...prev]);
      appendToImageLibrary(fresh);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* â”€â”€ Canvas Area â”€â”€ */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {/* Dot Grid Background */}
        <div 
          className="absolute inset-0 fixed"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2720%27%20height%3D%2720%27%20viewBox%3D%270%200%2020%2020%27%3E%3Ccircle%20cx%3D%2710%27%20cy%3D%2710%27%20r%3D%270.5%27%20fill%3D%27white%27%20opacity%3D%270.03%27%2F%3E%3C%2Fsvg%27")',
            opacity: 0.03,
          }}
          aria-hidden="true"
        />
        
        {/* Subtle corner glows */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />

        {/* Canvas Viewport */}
        {/* Result Feed — scrollable, hidden scrollbar */}
        <div className="absolute inset-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {generatedImages.length > 0 ? (
            <div className="max-w-3xl mx-auto w-full px-4 pt-6 pb-4 space-y-4">
              <AnimatePresence initial={false}>
                {generatedImages.map((img, i) => (
                  <motion.div
                    key={img.url}
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 30, delay: i * 0.05 }}
                  >
                    <ImageResultCard image={img} />
                  </motion.div>
                ))}
              </AnimatePresence>

              {isGenerating && (
                <div className="rounded-xl border border-white/10 bg-[#1A1C20] h-64 relative overflow-hidden">
                  <div className="absolute inset-0 bg-white/[0.02] animate-pulse" />
                </div>
              )}
            </div>
          ) : (
            <div className="min-h-full flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center"
              >
                <motion.div
                  animate={{ scale: [0.98, 1.02, 0.98] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="h-20 w-20 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center mb-6"
                >
                  <svg viewBox="0 0 100 100" width="48" height="48">
                    <path
                      d="M 50 12 L 53.5 35 L 76 38.5 L 53.5 42 L 50 65 L 46.5 42 L 24 38.5 L 46.5 35 Z"
                      fill="white"
                      opacity={0.8}
                    />
                  </svg>
                </motion.div>
                <p className="text-[15px] font-medium text-white/70 mb-1.5">Canvas is ready</p>
                <p className="text-xs text-white/30 max-w-xs text-center">
                  Describe an image below, pick your settings, and press Generate.
                </p>
              </motion.div>
            </div>
          )}
        </div>

        {/* Scanning Laser Line (while generating) */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ y: '-100%', opacity: 0 }}
              animate={{ y: '100%', opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5, ease: 'linear', repeat: Infinity }}
              className="absolute left-0 right-0 h-[2px] pointer-events-none z-20"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, white 50%, transparent 100%)',
                filter: 'blur(1px)',
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── Command Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative shrink-0"
      >
        {/* Command Bar */}
        <div className="max-w-3xl mx-auto px-4 pb-4 pt-2">
          <div className="relative backdrop-blur-xl bg-black/60 border border-white/10 rounded-[26px] shadow-[0_0_40px_rgba(255,255,255,0.03)]">
            <div className="p-4 space-y-3">
              {/* Prompt Input */}
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => { setPrompt(e.target.value); autoGrow(); }}
                    placeholder="Describe the image you want to createâ€¦"
                    dir="auto"
                    rows={2}
                    className="w-full max-h-32 bg-transparent border-0 outline-none text-white text-[15px] placeholder:text-white/30 resize-none overflow-y-auto leading-relaxed block antialiased font-sans [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    style={{ minHeight: '3em', padding: '8px 8px 4px 4px' }}
                    disabled={isGenerating}
                  />
                </div>

                {/* Google Flow-style settings pill + popover */}
                <div className="relative shrink-0 pt-1">
                  <ImageConfigPill
                    config={config}
                    open={configOpen}
                    onToggle={() => setConfigOpen((v) => !v)}
                  />
                  <ImageConfigPopover
                    open={configOpen}
                    onClose={() => setConfigOpen(false)}
                    config={config}
                    onChange={setConfig}
                  />
                </div>
              </div>

              {genError && (
                <p className="px-1 text-[11.5px] text-red-400/90">{genError}</p>
              )}

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className={cn(
                  'w-full h-11 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]',
                  isGenerating || !prompt.trim()
                    ? 'bg-white/10 text-white/60 border border-white/10 cursor-default'
                    : 'bg-white text-black font-semibold hover:bg-gray-200 hover:scale-105 transition-transform duration-200 shadow-[0_0_20px_-4px_rgba(255,255,255,0.3)]'
                )}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Generatingâ€¦</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4.5 w-4.5" />
                    <span className="font-semibold">Generate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
