'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Plus,
  ChevronDown,
  Check,
  Download,
  Copy,
  X,
  Layers,
  Ratio,
  Maximize2,
  Shuffle,
  ImagePlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  IMAGE_MODELS,
  ASPECT_RATIOS,
  type ImageConfig,
} from './ImageConfigPopover';
import {
  appendToImageLibrary,
  readImageLibrary,
  type GeneratedImage,
} from './ImageResultCard';

export default function ImageCanvas() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [genError, setGenError] = useState<string | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [ratioMenuOpen, setRatioMenuOpen] = useState(false);
  const [referenceImage, setReferenceImage] = useState<{ url: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [config, setConfig] = useState<ImageConfig>({
    model: 'flux-1-pro',
    ratio: '1:1',
    count: 1,
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const ratioMenuRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setGeneratedImages(readImageLibrary());
  }, []);

  useEffect(() => {
    if (!isGenerating) {
      setProgress(0);
      return;
    }
    setProgress(18);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 94) return prev;
        const step = Math.floor(Math.random() * 14) + 6;
        return Math.min(prev + step, 94);
      });
    }, 450);
    return () => clearInterval(interval);
  }, [isGenerating]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModelMenuOpen(false);
        setRatioMenuOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
      if (ratioMenuRef.current && !ratioMenuRef.current.contains(e.target as Node)) {
        setRatioMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
  };

  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setReferenceImage({ url, name: file.name });
    e.target.value = '';
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    setProgress(0);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    const usedPrompt = prompt.trim();
    setIsGenerating(true);
    setGenError(null);
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
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

      setGeneratedImages((prev) => [...fresh, ...prev]);
      appendToImageLibrary(fresh);
      setProgress(100);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setGenError(err instanceof Error ? err.message : 'Generation failed');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const latestImage = generatedImages[0];

  const handleDownload = async () => {
    if (!latestImage?.url) return;
    try {
      const res = await fetch(latestImage.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vantra-image-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(latestImage.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyPrompt = async () => {
    if (!latestImage?.prompt) return;
    await navigator.clipboard.writeText(latestImage.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0A0A0B] overflow-hidden">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
        <div className="relative flex flex-col items-center justify-center aspect-square w-full max-w-[min(60vh,680px)] rounded-xl border border-white/[0.06] bg-white/[0.015] shadow-2xl overflow-hidden group">
          {latestImage && !isGenerating ? (
            <div className="relative w-full h-full flex items-center justify-center bg-black/40">
              <img
                src={latestImage.url}
                alt={latestImage.prompt || 'Generated canvas visual'}
                className="w-full h-full object-contain"
              />

              <div className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5 p-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 shadow-2xl z-20">
                <button
                  type="button"
                  onClick={handleDownload}
                  title="Download Image"
                  className="size-8 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 hover:bg-black/70 text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  title="Upscale"
                  className="size-8 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 hover:bg-black/70 text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  title="Make Variant"
                  className="size-8 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 hover:bg-black/70 text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (latestImage) {
                      setReferenceImage({ url: latestImage.url, name: 'Canvas-Output.jpg' });
                    }
                  }}
                  title="Use as Ref"
                  className="size-8 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 hover:bg-black/70 text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  title="Copy Prompt"
                  className="size-8 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 hover:bg-black/70 text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ) : isGenerating ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center animate-pulse bg-white/[0.03]">
              <div className="flex flex-col items-center text-center p-6 z-10">
                <p className="text-sm font-medium text-white/90 mb-1 font-mono tracking-wide">
                  Generating... {progress}%
                </p>
                <p className="text-xs text-white/40 font-mono">
                  {IMAGE_MODELS.find((m) => m.id === config.model)?.name} · {config.ratio}
                </p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-white/[0.02] to-transparent pointer-events-none" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <Sparkles className="h-8 w-8 text-white/20 mb-3 stroke-[1.5]" />
              <p className="text-sm font-medium text-white/40">Create your first image</p>
              <p className="text-xs text-white/20 mt-1 max-w-xs">
                Describe an image below, configure your ratio and model, then press Generate.
              </p>
            </div>
          )}

          <AnimatePresence>
            {isGenerating && (
              <motion.div
                initial={{ y: '-100%', opacity: 0 }}
                animate={{ y: '100%', opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.2, ease: 'linear', repeat: Infinity }}
                className="absolute left-0 right-0 h-[2px] pointer-events-none z-20"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.8) 50%, transparent 100%)',
                  filter: 'blur(1px)',
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="sticky bottom-0 w-full bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B] to-transparent pt-4 pb-6 z-20">
        <div className="mx-auto w-full max-w-4xl px-6">
          {genError && (
            <p className="mb-2 px-1 text-[11.5px] text-red-400/90" role="alert">
              {genError}
            </p>
          )}

          <div className="w-full border border-white/[0.08] bg-[#111216]/90 shadow-2xl backdrop-blur-xl transition-all duration-200 focus-within:border-white/[0.25] focus-within:bg-[#15161A]/90 rounded-2xl flex flex-col justify-between overflow-hidden">
            <div className="p-3">
              {referenceImage && (
                <div className="flex items-center gap-2 mb-2 p-1.5 bg-white/[0.04] rounded-lg border border-white/[0.08] w-fit">
                  <img src={referenceImage.url} alt="Reference" className="size-7 object-cover rounded-md" />
                  <span className="text-xs text-white/70 truncate max-w-[160px]">{referenceImage.name}</span>
                  <button
                    type="button"
                    onClick={() => setReferenceImage(null)}
                    aria-label="Remove reference image"
                    className="text-white/40 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  autoGrow();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                placeholder="Describe the image you want to create in vivid detail…"
                dir="auto"
                rows={2}
                className="w-full bg-transparent border-0 outline-none text-white text-[15px] placeholder:text-white/30 resize-none overflow-y-auto leading-relaxed block antialiased font-sans px-1"
                style={{ minHeight: '3em', maxHeight: '140px' }}
                disabled={isGenerating}
              />
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.05] px-3 py-2.5 bg-white/[0.01]">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleRefUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 text-xs bg-white/[0.04] border border-white/[0.05] px-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.07] transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5 text-white/50" />
                  <span>Ref</span>
                </button>

                <div className="relative" ref={modelMenuRef}>
                  <button
                    type="button"
                    onClick={() => setModelMenuOpen((v) => !v)}
                    className="h-8 text-xs bg-white/[0.04] border border-white/[0.05] px-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.07] transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Layers className="h-3 w-3 text-white/50" />
                    <span>Model: {IMAGE_MODELS.find((m) => m.id === config.model)?.name || 'Flux.1 Pro'}</span>
                    <ChevronDown className="h-3 w-3 text-white/40" />
                  </button>

                  {modelMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-[#0F1012] border border-white/[0.08] shadow-2xl rounded-xl p-1.5 z-50 flex flex-col gap-0.5">
                      {IMAGE_MODELS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setConfig({ ...config, model: m.id });
                            setModelMenuOpen(false);
                          }}
                          className={cn(
                            'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left',
                            config.model === m.id
                              ? 'bg-white/10 text-white font-medium'
                              : 'text-white/70 hover:text-white hover:bg-white/[0.05]'
                          )}
                        >
                          <div>
                            <p className="font-medium">{m.name}</p>
                            <p className="text-[10px] text-white/40">{m.label}</p>
                          </div>
                          {config.model === m.id && <Check className="h-3.5 w-3.5 text-white" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative" ref={ratioMenuRef}>
                  <button
                    type="button"
                    onClick={() => setRatioMenuOpen((v) => !v)}
                    className="h-8 text-xs bg-white/[0.04] border border-white/[0.05] px-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.07] transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Ratio className="h-3 w-3 text-white/50" />
                    <span>Ratio: {config.ratio}</span>
                    <ChevronDown className="h-3 w-3 text-white/40" />
                  </button>

                  {ratioMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-32 bg-[#0F1012] border border-white/[0.08] shadow-2xl rounded-xl p-1.5 z-50 flex flex-col gap-0.5">
                      {ASPECT_RATIOS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            setConfig({ ...config, ratio: r });
                            setRatioMenuOpen(false);
                          }}
                          className={cn(
                            'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer',
                            config.ratio === r
                              ? 'bg-white/10 text-white font-medium'
                              : 'text-white/70 hover:text-white hover:bg-white/[0.05]'
                          )}
                        >
                          <span>{r}</span>
                          {config.ratio === r && <Check className="h-3.5 w-3.5 text-white" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {isGenerating ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="h-8.5 px-4 rounded-lg text-xs font-medium bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.08] transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span>Cancel</span>
                  <span className="text-[9px]">■</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!prompt.trim()}
                  className={cn(
                    'bg-white text-black px-4 py-1.5 rounded-lg text-sm font-medium transition-all active:scale-95 flex items-center gap-1.5 shadow-sm',
                    !prompt.trim()
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-white/90 cursor-pointer'
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5 text-black" />
                  <span>Generate · 1 credit</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
