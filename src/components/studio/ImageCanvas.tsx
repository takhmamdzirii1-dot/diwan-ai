'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wand2, Maximize2, Download, Loader2, Check, X, ChevronDown } from 'lucide-react';
import { LiquidMetalButton } from '@/components/ui/liquid-metal-button';
import { cn } from '@/lib/utils';
import { generateImageViaRouter, PROVIDER_REGISTRY } from '@/lib/ai/image-providers/router';

export default function ImageCanvas() {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'result'>('idle');
  const [progress, setProgress] = useState(0);
  
  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState<null | 'model' | 'ratio' | 'provider'>(null);
  const [selectedProvider, setSelectedProvider] = useState<'auto' | 'puter' | 'pollinations' | 'mock'>('auto');
  const [selectedModel, setSelectedModel] = useState('flux');
  const [selectedRatio, setSelectedRatio] = useState('1:1');
  const [refImage, setRefImage] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const [lastFunding, setLastFunding] = useState<string | null>(null);

  // Advanced controls
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [cfgScale, setCfgScale] = useState(7);
  const [seed, setSeed] = useState(12345);

  // Session history filmstrip
  const [resultImage, setResultImage] = useState(
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop'
  );
  const [sessionHistory, setSessionHistory] = useState<string[]>([
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop&h=200',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop&crop=entropy',
  ]);


  const providerModels = PROVIDER_REGISTRY[selectedProvider]?.models ?? [{ id: 'flux', name: 'Flux' }];
  const providerMeta = PROVIDER_REGISTRY[selectedProvider];
  const providerCostLabel =
    selectedProvider === 'puter'
      ? 'User-funded · free for VANTRA'
      : selectedProvider === 'pollinations'
        ? 'Free tier'
        : '1 credit';

  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim() || status === 'generating') return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setStatus('generating');
    setProgress(5);
    setGenError(null);

    intervalRef.current = setInterval(() => {
      setProgress((prev) => (prev < 95 ? prev + 4 : prev));
    }, 180);

    try {
      const dims = selectedRatio === '16:9'
        ? { width: 1344, height: 768 }
        : selectedRatio === '9:16'
          ? { width: 768, height: 1344 }
          : selectedRatio === '4:3'
            ? { width: 1152, height: 896 }
            : { width: 1024, height: 1024 };

      // Blob URLs are browser-local — Pollinations/server providers can't reach them
      const publicImageUrl = refImage && !refImage.startsWith('blob:') ? refImage : undefined;

      const result = await generateImageViaRouter({
        provider: selectedProvider,
        prompt: prompt.trim(),
        model: selectedModel,
        ...dims,
        imageUrl: publicImageUrl,
        count: 1,
      });

      const url = result.images[0]?.url;
      if (!url) throw new Error('No image returned');

      setProgress(100);
      setResultImage(url);
      setSessionHistory((prev) => [url, ...prev].slice(0, 12));
      setStatus('result');
      setLastProvider(result.provider);
      setLastFunding(result.userFunded ? 'user-funded' : 'platform');
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed');
      setStatus('idle');
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  };

  const handleCancel = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus('idle');
    setProgress(0);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = `vantra-artwork-${Date.now()}.jpg`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleUpscale = () => {
    handleGenerate();
  };

  // Dynamic canvas sizing based on the selected aspect ratio
  const getCanvasDimensions = () => {
    switch (selectedRatio) {
      case '16:9': return 'aspect-video w-full max-w-[800px] max-h-[60vh]';
      case '9:16': return 'aspect-[9/16] h-full max-h-[65vh] max-w-[400px]';
      case '1:1':
      default: return 'aspect-square w-full max-w-[550px] max-h-[60vh]';
    }
  };

  return (
    <div className="flex h-full w-full bg-[#0A0A0B] text-white overflow-hidden">
      {/* MAIN CONTENT AREA */}
      <main className="relative flex flex-col flex-1 min-w-0 h-full">
        {/* CENTRAL CANVAS FRAME */}
        <div className="relative flex-1 flex flex-col items-center justify-center p-6 xl:pe-28 overflow-hidden">
          <div className={`relative ${getCanvasDimensions()} rounded-2xl border border-white/[0.06] bg-white/[0.015] shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-500`}>
            {status === 'idle' && (
              <div className="flex flex-col items-center gap-4 text-center p-6">
                <Sparkles className="size-12 text-white/20 animate-pulse" />
                <h2 className="text-lg font-medium text-white/80">Create your first image</h2>
                <p className="text-xs text-white/40 max-w-xs">Describe what you want to imagine below, then press Generate.</p>
              </div>
            )}

            {status === 'generating' && (
              <div className="flex flex-col items-center gap-3 text-center animate-pulse">
                <div className="text-sm font-medium text-white/70">
                  Generating your masterpiece... {progress}%
                </div>
                <div className="w-36 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-100"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {status === 'result' && (
              <div className="relative w-full h-full group">
                <img
                  src={resultImage}
                  alt="Generated"
                  className="w-full h-full object-cover rounded-2xl transition-transform duration-500 hover:scale-[1.02]"
                />
                {/* Cinematic hover overlay — compact glass bar, bottom-center */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button
                    type="button"
                    onClick={() => alert('Downloading high-res image...')}
                    title="Download"
                    aria-label="Download image"
                    className="p-2 hover:bg-white/10 rounded-lg cursor-pointer transition-all active:scale-95 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <Download className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => alert('Upscaling image to 4K...')}
                    title="Upscale"
                    aria-label="Upscale image"
                    className="p-2 hover:bg-white/10 rounded-lg cursor-pointer transition-all active:scale-95 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <Maximize2 className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('idle')}
                    title="Variant"
                    aria-label="Generate variant"
                    className="p-2 hover:bg-white/10 rounded-lg cursor-pointer transition-all active:scale-95 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <Wand2 className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Session history filmstrip */}
        <aside
          aria-label="Session image history"
          className="hidden xl:flex flex-col w-20 absolute right-4 top-6 bottom-32 rounded-xl border border-white/[0.05] bg-[#0A0A0B]/80 backdrop-blur-md p-2 gap-2 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden z-20 pr-3"
        >
          {sessionHistory.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => {
                setResultImage(url);
                setStatus('result');
              }}
              aria-label={`View generation ${i + 1}`}
              className={cn(
                'shrink-0 size-16 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                url === resultImage
                  ? 'ring-2 ring-white/60'
                  : 'hover:ring-2 hover:ring-white/20 opacity-70 hover:opacity-100'
              )}
            >
              <img src={url} alt="" className="size-16 object-cover" loading="lazy" />
            </button>
          ))}
        </aside>

        {/* DOCKED COMPOSER (CLEAN & ISOLATED) */}
        <footer className="shrink-0 sticky bottom-0 bg-[#0A0A0B] pb-6 px-6 z-20">
          <div className="mx-auto w-full max-w-3xl border border-white/[0.08] bg-[#111216]/90 rounded-2xl shadow-2xl backdrop-blur-xl">
            {/* Reference thumbnail */}
            {refImage && (
              <div className="px-5 pt-4 pb-2">
                <div className="relative inline-block group">
                  <img src={refImage} alt="Reference" className="size-16 rounded-xl object-cover border border-white/10 shadow-lg" />
                  <button
                    type="button"
                    onClick={() => setRefImage(null)}
                    aria-label="Remove reference image"
                    className="absolute -top-2 -right-2 bg-[#111216] text-white/70 hover:text-white rounded-full p-1 border border-white/20 opacity-0 group-hover:opacity-100 transition-all shadow-xl cursor-pointer focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Textarea Input */}
            <div className="p-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                placeholder="Describe an imaginative scene..."
                className="w-full bg-transparent text-white placeholder:text-white/30 text-sm focus:outline-none resize-none"
                rows={2}
                disabled={status === 'generating'}
              />
            </div>

            {/* Advanced controls toggle */}
            <div className="px-4 pb-2">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-white/45 hover:text-white/80 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-md px-1.5 py-1"
              >
                Advanced
                <ChevronDown className={cn('size-3.5 transition-transform duration-200', showAdvanced && 'rotate-180')} />
              </button>
            </div>

            {/* Advanced controls panel */}
            <AnimatePresence initial={false}>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden border-t border-white/[0.05] bg-white/[0.01] p-4 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Negative prompt */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-white/40">
                        Negative Prompt
                      </label>
                      <input
                        type="text"
                        value={negativePrompt}
                        onChange={(e) => setNegativePrompt(e.target.value)}
                        placeholder="blurry, distorted, low quality…"
                        dir="auto"
                        className="w-full h-9 rounded-lg bg-white/[0.04] border border-white/10 px-3 text-[12.5px] text-white placeholder:text-white/25 outline-none focus:border-white/25 transition-colors"
                      />
                    </div>

                    {/* CFG scale */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="cfg-scale" className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-white/40">
                          Guidance / CFG
                        </label>
                        <span className="text-[11px] font-mono text-white/70">{cfgScale.toFixed(1)}</span>
                      </div>
                      <input
                        id="cfg-scale"
                        type="range"
                        min={1}
                        max={20}
                        step={0.5}
                        value={cfgScale}
                        onChange={(e) => setCfgScale(Number(e.target.value))}
                        className="w-full h-1.5 rounded-full bg-white/10 appearance-none cursor-pointer accent-white"
                      />
                    </div>

                    {/* Seed */}
                    <div className="space-y-1.5">
                      <label htmlFor="seed" className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-white/40">
                        Seed
                      </label>
                      <input
                        id="seed"
                        type="number"
                        value={seed}
                        onChange={(e) => setSeed(Number(e.target.value))}
                        className="w-full h-9 rounded-lg bg-white/[0.04] border border-white/10 px-3 text-[12.5px] text-white outline-none focus:border-white/25 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Toolbar Footer */}
            <div className="flex items-center justify-between border-t border-white/[0.05] px-4 py-3 relative" ref={dropdownRef}>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setRefImage(URL.createObjectURL(e.target.files[0]));
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 px-3 rounded-lg text-xs bg-white/[0.04] border border-white/[0.05] text-white/70 hover:bg-white/[0.08] cursor-pointer active:scale-95 transition-transform"
                >
                  + Ref
                </button>
                
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === 'provider' ? null : 'provider')}
                    className={`h-8 px-3 rounded-lg text-xs border cursor-pointer active:scale-95 transition-all ${
                      activeDropdown === 'provider'
                        ? 'bg-white/[0.1] border-white/[0.1] text-white'
                        : 'bg-white/[0.04] border-white/[0.05] text-white/70 hover:bg-white/[0.08]'
                    }`}
                  >
                    {PROVIDER_REGISTRY[selectedProvider]?.name ?? 'Auto'} ▾
                  </button>

                  {activeDropdown === 'provider' && (
                    <div className="absolute bottom-full left-0 mb-2 w-60 rounded-xl border border-white/[0.08] bg-[#111216]/95 backdrop-blur-xl shadow-2xl p-2 z-50">
                      {(['auto', 'puter', 'pollinations', 'mock'] as const).map((id) => {
                        const meta = PROVIDER_REGISTRY[id];
                        const active = selectedProvider === id;
                        return (
                          <div
                            key={id}
                            onClick={() => {
                              setSelectedProvider(id);
                              const first = meta?.models?.[0]?.id;
                              if (first) setSelectedModel(first);
                              setActiveDropdown(null);
                            }}
                            className="hover:bg-white/[0.05] p-2.5 rounded-lg cursor-pointer text-xs flex items-start justify-between gap-2 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className={active ? 'text-white font-medium' : 'text-white/80'}>{meta?.name ?? id}</p>
                              <p className="text-[10.5px] text-white/40 truncate">{meta?.note}</p>
                            </div>
                            {active && <Check className="size-3.5 text-white/70 mt-0.5 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === 'model' ? null : 'model')}
                    className={`h-8 px-3 rounded-lg text-xs border cursor-pointer active:scale-95 transition-all ${
                      activeDropdown === 'model'
                        ? 'bg-white/[0.1] border-white/[0.1] text-white'
                        : 'bg-white/[0.04] border-white/[0.05] text-white/70 hover:bg-white/[0.08]'
                    }`}
                  >
                    {selectedModel} ▾
                  </button>

                  {activeDropdown === 'model' && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl border border-white/[0.08] bg-[#111216]/95 backdrop-blur-xl shadow-2xl p-2 z-50">
                      {providerModels.map((model) => (
                        <div
                          key={model.id}
                          onClick={() => {
                            setSelectedModel(model.id);
                            setActiveDropdown(null);
                          }}
                          className="hover:bg-white/[0.05] p-2.5 rounded-lg cursor-pointer text-xs text-white/80 flex items-center justify-between group transition-colors"
                        >
                          <span className={selectedModel === model.id ? 'text-white font-medium' : ''}>{model.name}</span>
                          {selectedModel === model.id && <Check className="size-3.5 text-white/70" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveDropdown(activeDropdown === 'ratio' ? null : 'ratio')}
                    className={`h-8 px-3 rounded-lg text-xs border cursor-pointer active:scale-95 transition-all ${
                      activeDropdown === 'ratio' 
                        ? 'bg-white/[0.1] border-white/[0.1] text-white' 
                        : 'bg-white/[0.04] border-white/[0.05] text-white/70 hover:bg-white/[0.08]'
                    }`}
                  >
                    {selectedRatio} ▾
                  </button>
                  
                  {activeDropdown === 'ratio' && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 rounded-xl border border-white/[0.08] bg-[#111216]/95 backdrop-blur-xl shadow-2xl p-2 z-50">
                      {[
                        { id: '1:1', label: '1:1 (Square)' },
                        { id: '16:9', label: '16:9 (Landscape)' },
                        { id: '9:16', label: '9:16 (Portrait)' },
                      ].map((ratio) => (
                        <div 
                          key={ratio.id}
                          onClick={() => {
                            setSelectedRatio(ratio.id);
                            setActiveDropdown(null);
                          }}
                          className="hover:bg-white/[0.05] p-2.5 rounded-lg cursor-pointer text-xs text-white/80 flex items-center justify-between group transition-colors"
                        >
                          <span className={selectedRatio === ratio.id ? 'text-white font-medium' : ''}>{ratio.label}</span>
                          {selectedRatio === ratio.id && <Check className="size-3.5 text-white/70" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {status === 'generating' ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="bg-white/10 hover:bg-white/15 text-white border border-white/10 px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
                >
                  <Loader2 className="size-3.5 animate-spin text-white/70" />
                  <span>Generating {progress}% · Cancel ■</span>
                </button>
              ) : (
                <div className="flex items-center gap-2.5">
                  <LiquidMetalButton viewMode="icon" label="Generate" onClick={handleGenerate} />
                  <span className="text-xs text-white/30">1 credit</span>
                </div>
              )}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
