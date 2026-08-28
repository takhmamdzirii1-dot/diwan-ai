'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Palette, Sparkles, Wand2, Maximize2, Download, Loader2, Check } from 'lucide-react';

export default function ImageCanvas() {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'generating' | 'result'>('idle');
  const [progress, setProgress] = useState(0);
  
  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState<null | 'model' | 'ratio'>(null);
  const [selectedModel, setSelectedModel] = useState('Flux.1 Pro');
  const [selectedRatio, setSelectedRatio] = useState('1:1');
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

  const handleGenerate = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setStatus('generating');
    setProgress(0);

    intervalRef.current = setInterval(() => {
      setProgress((prev) => (prev < 95 ? prev + 5 : prev));
    }, 100);

    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(100);
      setStatus('result');
    }, 2500);
  };

  const handleCancel = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus('idle');
    setProgress(0);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop';
    a.download = `vantra-artwork-${Date.now()}.jpg`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleUpscale = () => {
    handleGenerate();
  };

  return (
    <div className="flex h-full w-full bg-[#0A0A0B] text-white overflow-hidden">
      {/* MAIN CONTENT AREA */}
      <main className="relative flex flex-col flex-1 min-w-0 h-full">
        {/* HEADER */}
        <header className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between border-b border-white/[0.05] px-6 bg-[#0A0A0B]/80 backdrop-blur-sm z-30">
          <div className="flex items-center gap-3">
            <Palette className="size-5 text-white/50" />
            <h1 className="text-sm font-medium text-white/90">Image Canvas</h1>
          </div>
        </header>

        {/* CENTRAL CANVAS FRAME */}
        <div className="relative flex-1 flex items-center justify-center p-10 pt-24 pb-32 overflow-hidden">
          <div className="relative aspect-square w-full max-w-[min(60vh,680px)] rounded-2xl border border-white/[0.06] bg-white/[0.015] shadow-2xl flex items-center justify-center overflow-hidden">
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
                  src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop"
                  alt="Generated"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-6">
                  <div className="flex gap-2 p-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
                    <button
                      type="button"
                      onClick={handleDownload}
                      title="Download"
                      className="p-2 hover:bg-white/10 rounded-lg cursor-pointer transition-all active:scale-95 text-white"
                    >
                      <Download className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleUpscale}
                      title="Upscale"
                      className="p-2 hover:bg-white/10 rounded-lg cursor-pointer transition-all active:scale-95 text-white"
                    >
                      <Maximize2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DOCKED COMPOSER (CLEAN & ISOLATED) */}
        <footer className="shrink-0 sticky bottom-0 bg-[#0A0A0B] pb-6 px-6 z-20">
          <div className="mx-auto w-full max-w-3xl border border-white/[0.08] bg-[#111216]/90 rounded-2xl shadow-2xl backdrop-blur-xl">
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

            {/* Toolbar Footer */}
            <div className="flex items-center justify-between border-t border-white/[0.05] px-4 py-3 relative" ref={dropdownRef}>
              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      alert(`Mock upload: ${e.target.files[0].name}`);
                    }
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
                      {['Flux.1 Pro', 'SDXL Turbo', 'Midjourney v6'].map((model) => (
                        <div 
                          key={model}
                          onClick={() => {
                            setSelectedModel(model);
                            setActiveDropdown(null);
                          }}
                          className="hover:bg-white/[0.05] p-2.5 rounded-lg cursor-pointer text-xs text-white/80 flex items-center justify-between group transition-colors"
                        >
                          <span className={selectedModel === model ? 'text-white font-medium' : ''}>{model}</span>
                          {selectedModel === model && <Check className="size-3.5 text-white/70" />}
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
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="bg-white text-black px-4 py-2 rounded-xl text-xs font-medium hover:bg-white/90 flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
                >
                  <Wand2 className="size-3.5" />
                  <span>Generate · 1 credit</span>
                </button>
              )}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
