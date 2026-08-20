'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Download,
  Maximize2,
  Copy,
  Check,
  Wand2,
  RefreshCw,
  Loader2,
  Image as ImageIcon,
  Sliders,
  Layers,
  X,
} from 'lucide-react';
import { getModelCost } from '../../config/pricing';
import useUser from '../../hooks/useUser';
import { useModal } from '../../context/ModalContext';

const ASPECT_RATIOS = [
  { id: '1:1', label: 'Square (1:1)', icon: '▢' },
  { id: '16:9', label: 'Cinema (16:9)', icon: '▭' },
  { id: '9:16', label: 'Story (9:16)', icon: '▯' },
];

const STYLE_PRESETS = [
  'Photorealistic 8K',
  'Cinematic Concept Art',
  'Algerian Casbah Golden Hour',
  'Architectural 3D Render',
  'Anime Studio Ghibli',
  'Cyberpunk Neon Sahara',
];

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  aspectRatio: string;
  style: string;
  cost: number;
  timestamp: string;
}

export default function StudioImage() {
  const { user, balance, refreshBalance } = useUser();
  const { openTopUpModal } = useModal();

  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [selectedStyle, setSelectedStyle] = useState('Photorealistic 8K');
  const [model, setModel] = useState<'flux-1-pro' | 'midjourney-v6-1'>('flux-1-pro');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [gallery, setGallery] = useState<GeneratedImage[]>([]);

  const cost = getModelCost(model) || 65;

  const handleEnhancePrompt = () => {
    if (!prompt.trim()) {
      setPrompt(
        'Majestic ancient Algerian Casbah alleyway at sunset, ornate carved wooden doors, warm lantern light, photorealistic 8K, highly detailed cinematic lighting'
      );
      return;
    }
    setPrompt(
      `${prompt.trim()}, masterpiece, 8k resolution, cinematic lighting, photorealistic, intricate textures, volumetric fog, octane render`
    );
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);

    // Simulate high-tier AI Image generation & point deduction
    await new Promise((r) => setTimeout(r, 2200));

    const newImg: GeneratedImage = {
      id: `img-${Date.now()}`,
      url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
      prompt: prompt,
      aspectRatio: aspectRatio,
      style: selectedStyle,
      cost: cost,
      timestamp: 'Just now',
    };

    setGallery((prev) => [newImg, ...prev]);
    setIsGenerating(false);
    if (user) {
      refreshBalance();
    }
  };

  const handleCopyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050506] overflow-y-auto custom-scrollbar p-6 space-y-8 pb-32">
      {/* Studio Header */}
      <div className="max-w-4xl mx-auto w-full space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#1FD8B8]/15 border border-[#1FD8B8]/30 flex items-center justify-center text-[#1FD8B8]">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <h2
                className="text-xl font-bold text-white tracking-tight font-heading"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Flux.1 Pro & Midjourney Studio
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Generate hyper-detailed 4K commercial assets and concept art with local DZD credits.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModel('flux-1-pro')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                model === 'flux-1-pro'
                  ? 'bg-[#1FD8B8]/15 border-[#1FD8B8] text-[#1FD8B8] font-bold'
                  : 'bg-white/[0.03] border-white/[0.08] text-white/70'
              }`}
            >
              Flux.1 Pro (65 pts)
            </button>
            <button
              type="button"
              onClick={() => setModel('midjourney-v6-1')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                model === 'midjourney-v6-1'
                  ? 'bg-[#1FD8B8]/15 border-[#1FD8B8] text-[#1FD8B8] font-bold'
                  : 'bg-white/[0.03] border-white/[0.08] text-white/70'
              }`}
            >
              Midjourney v6.1 (80 pts)
            </button>
          </div>
        </div>
      </div>

      {/* Control Studio Card */}
      <div className="max-w-4xl mx-auto w-full rounded-3xl border border-white/[0.1] bg-[#0E1016] p-6 space-y-6 shadow-2xl">
        {/* Prompt Input Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-white">Visual Prompt</label>
            <button
              type="button"
              onClick={handleEnhancePrompt}
              className="flex items-center gap-1 text-[11px] text-[#1FD8B8] hover:underline cursor-pointer"
            >
              <Wand2 className="h-3 w-3" />
              <span>Auto-Enhance Prompt</span>
            </button>
          </div>

          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your scene in detail (e.g., Ultra-photorealistic 4K portrait of an Algerian artisan crafting traditional jewelry in Ghardaïa, cinematic warm rim lighting...)"
            className="w-full rounded-2xl border border-white/[0.1] bg-[#050608] p-4 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#1FD8B8] focus:ring-1 focus:ring-[#1FD8B8]"
          />
        </div>

        {/* Configurations Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Aspect Ratio */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#CBD5E1]">Aspect Ratio</label>
            <div className="grid grid-cols-3 gap-2">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio.id}
                  type="button"
                  onClick={() => setAspectRatio(ratio.id)}
                  className={`py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    aspectRatio === ratio.id
                      ? 'border-[#1FD8B8] bg-[#1FD8B8]/10 text-[#1FD8B8]'
                      : 'border-white/[0.08] bg-[#050608] text-[#94A3B8] hover:bg-white/[0.04]'
                  }`}
                >
                  <span>{ratio.icon}</span>
                  <span>{ratio.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Style Presets */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#CBD5E1]">Style Presets</label>
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              className="w-full h-10 rounded-xl border border-white/[0.08] bg-[#050608] px-3 text-xs text-white outline-none focus:border-[#1FD8B8]"
            >
              {STYLE_PRESETS.map((style) => (
                <option key={style} value={style} className="bg-[#0E1016]">
                  {style}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
          <div className="text-xs text-[#64748B]">
            Cost:{' '}
            <span className="font-mono font-bold text-[#1FD8B8]">{cost} Points / Render</span>
          </div>

          <button
            type="button"
            disabled={!prompt.trim() || isGenerating}
            onClick={handleGenerate}
            className="flex items-center gap-2 px-6 h-11 rounded-2xl bg-[#1FD8B8] hover:bg-[#34e2c2] text-[#050506] font-bold text-sm shadow-[0_4px_20px_rgba(31,216,184,0.35)] transition cursor-pointer disabled:opacity-40"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[#050506]" />
                <span>Rendering High-Res...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-[#050506]" />
                <span>Generate Image ({cost} pts)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Generated Gallery Showcase */}
      <div className="max-w-4xl mx-auto w-full space-y-4">
        <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
          Generation Gallery
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {gallery.length === 0 ? (
            <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center py-20 border border-white/5 bg-white/[0.02] rounded-3xl border-dashed">
              <div className="w-12 h-12 rounded-full bg-white/[0.05] flex items-center justify-center mb-4">
                <ImageIcon className="w-6 h-6 text-white/30" />
              </div>
              <p className="text-sm font-medium text-white/70">No images generated yet</p>
              <p className="text-xs text-white/40 mt-1">Your generated images will appear here.</p>
            </div>
          ) : (
            gallery.map((img) => (
            <div
              key={img.id}
              className="group relative rounded-3xl overflow-hidden border border-white/[0.1] bg-[#0E1016] shadow-xl space-y-3"
            >
              <div className="relative aspect-video overflow-hidden bg-black/40">
                <img
                  src={img.url}
                  alt={img.prompt}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                  <a
                    href={img.url}
                    target="_blank"
                    rel="noreferrer"
                    className="h-8 w-8 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-[#1FD8B8] hover:text-[#050506] transition"
                    title="Open Full Image"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </a>
                  <a
                    href={img.url}
                    download="vantra-render.jpg"
                    className="h-8 w-8 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-[#1FD8B8] hover:text-[#050506] transition"
                    title="Download Render"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="p-4 space-y-2">
                <p className="text-xs text-white/90 line-clamp-2 leading-relaxed">
                  "{img.prompt}"
                </p>

                <div className="flex items-center justify-between text-[10px] text-[#64748B] pt-2 border-t border-white/[0.04]">
                  <span>{img.style} • {img.aspectRatio}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyPrompt(img.id, img.prompt)}
                    className="flex items-center gap-1 text-[#1FD8B8] hover:underline cursor-pointer"
                  >
                    {copiedId === img.id ? (
                      <>
                        <Check className="h-3 w-3" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Prompt</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )))}
        </div>
      </div>
    </div>
  );
}
