'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, Clapperboard, ImagePlus, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_VIDEO_MODEL, isModelSelectable, VIDEO_MODELS } from '@/src/config/studio-registry';
import { PrimaryButton, Segmented, StateBlock } from './AppShell';

const DURATIONS = ['5 seconds', '10 seconds'] as const;
const ASPECT_RATIOS = ['16:9', '9:16', '1:1'] as const;
const CAMERA_PRESETS = ['Static', 'Push in', 'Pull out', 'Pan left', 'Pan right', 'Orbit'] as const;
type VideoMode = 'text' | 'image';

export type VideoRequestDraft = {
  mode: VideoMode;
  prompt: string;
  referenceFile: File | null;
  modelId: string;
  duration: (typeof DURATIONS)[number];
  aspectRatio: (typeof ASPECT_RATIOS)[number];
  cameraMotion: (typeof CAMERA_PRESETS)[number];
  negativePrompt: string;
};

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{children}</label>;
}

export default function MotionStudio({ onGenerate }: { onGenerate?: (draft: VideoRequestDraft) => void | Promise<void> }) {
  const reduceMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<VideoMode>('text');
  const [prompt, setPrompt] = useState('');
  const [modelId, setModelId] = useState(DEFAULT_VIDEO_MODEL?.id ?? '');
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>('5 seconds');
  const [aspectRatio, setAspectRatio] = useState<(typeof ASPECT_RATIOS)[number]>('16:9');
  const [cameraMotion, setCameraMotion] = useState<(typeof CAMERA_PRESETS)[number]>('Static');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (referenceUrl) URL.revokeObjectURL(referenceUrl);
  }, [referenceUrl]);

  const chooseReference = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file for the video reference.');
      return;
    }
    if (referenceUrl) URL.revokeObjectURL(referenceUrl);
    setReferenceFile(file);
    setReferenceUrl(URL.createObjectURL(file));
    setError(null);
  };

  const clearReference = () => {
    if (referenceUrl) URL.revokeObjectURL(referenceUrl);
    setReferenceFile(null);
    setReferenceUrl(null);
  };

  const submitDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt.trim()) {
      setError('Describe the scene you want to create.');
      return;
    }
    if (mode === 'image' && !referenceFile) {
      setError('Add a reference image for Image to Video.');
      return;
    }
    const selectedModel = VIDEO_MODELS.find((model) => model.id === modelId);
    if (!selectedModel || !isModelSelectable(selectedModel)) {
      setError('Video generation is not connected yet. Your configuration is preserved locally.');
      return;
    }
    setError(null);
    await onGenerate?.({ mode, prompt: prompt.trim(), referenceFile, modelId, duration, aspectRatio, cameraMotion, negativePrompt: negativePrompt.trim() });
  };

  return (
    <div className="custom-scrollbar h-full overflow-y-auto bg-[var(--studio-bg)] text-white">
      <div className="mx-auto grid min-h-full w-full max-w-[1440px] grid-cols-1 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <section className="border-b border-[var(--studio-border-subtle)] p-5 sm:p-6 lg:border-b-0 lg:border-e lg:p-8">
          <div className="mb-6">
            <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">Video Studio</p><span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/50">Preview</span></div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Direct the scene</h1>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[var(--studio-text-secondary)]">Shape a scene and prepare its settings. Video generation is coming soon.</p>
          </div>

          <form className="space-y-5" onSubmit={submitDraft} noValidate>
            <Segmented value={mode} onChange={(value) => { setMode(value); setError(null); }} layoutId="video-mode" label="Video generation mode" options={[{ value: 'text', label: 'Text to Video' }, { value: 'image', label: 'Image to Video' }]} className="w-full [&>button]:flex-1" />

            <div className="space-y-2"><FieldLabel htmlFor="video-prompt">Scene prompt</FieldLabel><textarea id="video-prompt" value={prompt} onChange={(event) => { setPrompt(event.target.value); setError(null); }} rows={5} placeholder="Describe the action, environment, lighting, and shot…" className="w-full resize-y rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3.5 py-3 text-[14px] leading-relaxed text-white outline-none transition-[border-color,background-color] duration-150 placeholder:text-white/40 hover:bg-[var(--studio-hover)] focus-visible:border-[var(--studio-border-strong)] focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none" /></div>

            <div className="space-y-2"><FieldLabel>Reference image {mode === 'image' ? '· Required' : '· Optional'}</FieldLabel><input ref={fileInputRef} type="file" accept="image/*" aria-label="Choose video reference image" className="sr-only" onChange={(event) => { chooseReference(event.target.files?.[0]); event.target.value = ''; }} />{referenceUrl ? <div className="flex items-center gap-3 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] p-2.5"><img src={referenceUrl} alt="Selected video reference" className="h-14 w-14 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-medium text-white/85">{referenceFile?.name}</p><p className="mt-0.5 text-[11px] text-white/55">Local preview · not uploaded</p></div><button type="button" onClick={clearReference} aria-label="Remove video reference" className="flex h-9 w-9 items-center justify-center rounded-lg text-white/55 transition-[color,background-color] duration-150 hover:bg-[var(--studio-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none"><X className="h-4 w-4" /></button></div> : <button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-20 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] text-[12.5px] font-medium text-white/65 transition-[color,background-color,border-color] duration-150 hover:border-white/25 hover:bg-[var(--studio-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none"><ImagePlus className="h-4 w-4" />Add reference image</button>}</div>

            <div className="space-y-2"><FieldLabel htmlFor="video-model">Model</FieldLabel><div className="relative"><select id="video-model" disabled={VIDEO_MODELS.length === 0} value={modelId || 'unavailable'} onChange={(event) => setModelId(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-white/[0.025] ps-3.5 pe-10 text-[13px] text-[var(--studio-text-disabled)] outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed">{VIDEO_MODELS.length === 0 ? <option value="unavailable">No connected video models</option> : VIDEO_MODELS.map((model) => <option key={model.id} value={model.id} disabled={!isModelSelectable(model)}>{model.displayName} · {model.provider}</option>)}</select><ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" /></div></div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><FieldLabel htmlFor="video-duration">Duration</FieldLabel><select id="video-duration" value={duration} onChange={(event) => setDuration(event.target.value as typeof duration)} className="h-11 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[13px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40">{DURATIONS.map((value) => <option key={value}>{value}</option>)}</select></div><div className="space-y-2"><FieldLabel htmlFor="video-ratio">Aspect ratio</FieldLabel><select id="video-ratio" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as typeof aspectRatio)} className="h-11 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[13px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40">{ASPECT_RATIOS.map((value) => <option key={value}>{value}</option>)}</select></div></div>

            <div className="space-y-2"><FieldLabel>Camera motion</FieldLabel><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{CAMERA_PRESETS.map((preset) => { const selected = cameraMotion === preset; return <button key={preset} type="button" aria-pressed={selected} onClick={() => setCameraMotion(preset)} className={cn('flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11.5px] font-medium transition-[color,background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none', selected ? 'border-white/30 bg-white text-black' : 'border-white/10 bg-white/[0.025] text-white/65 hover:border-white/20 hover:bg-[var(--studio-hover)] hover:text-white')}>{selected && <Check aria-hidden="true" className="h-3 w-3" />}{preset}</button>; })}</div></div>

            <div className="rounded-xl border border-[var(--studio-border-subtle)] bg-white/[0.015]"><button type="button" onClick={() => setAdvancedOpen((open) => !open)} aria-expanded={advancedOpen} aria-controls="video-advanced" className="flex h-11 w-full items-center justify-between px-3.5 text-[12.5px] font-medium text-white/70 transition-[color,background-color] duration-150 hover:bg-[var(--studio-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none"><span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />Advanced</span><ChevronDown className={cn('h-4 w-4 transition-transform duration-150 motion-reduce:transition-none', advancedOpen && 'rotate-180')} /></button><AnimatePresence initial={false}>{advancedOpen && <motion.div id="video-advanced" initial={reduceMotion ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18 }} className="overflow-hidden"><div className="space-y-1.5 border-t border-[var(--studio-border-subtle)] p-3"><FieldLabel htmlFor="video-negative">Negative prompt</FieldLabel><input id="video-negative" value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} placeholder="Used only when a connected model supports it" className="h-10 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12.5px] text-white outline-none placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-white/40" /></div></motion.div>}</AnimatePresence></div>

            {error && <p role="status" className="text-[12px] leading-relaxed text-white/55">{error}</p>}
            <div className="space-y-2"><PrimaryButton type="submit" disabled={!DEFAULT_VIDEO_MODEL} aria-describedby="video-generate-help" className="w-full">Generate</PrimaryButton><p id="video-generate-help" className="text-center text-[11.5px] font-medium leading-relaxed text-white/60">Not connected · Generation will be available soon</p></div>
          </form>
        </section>

        <section aria-label="Video preview" className="flex min-h-[420px] items-center justify-center p-5 sm:p-8 lg:min-h-full"><div className="mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-white/[0.015] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]"><div className="flex h-full min-h-0 items-center justify-center p-4 sm:p-8"><StateBlock icon={<Clapperboard className="h-6 w-6" />} title="Not connected" description="Video generation will be available soon. Your scene settings remain ready here." /></div></div></section>
      </div>
    </div>
  );
}
