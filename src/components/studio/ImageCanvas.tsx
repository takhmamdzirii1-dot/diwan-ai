'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, ImageIcon, Paperclip, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { IMAGE_MODELS, isModelSelectable } from '@/src/config/studio-registry';
import { PrimaryButton, StateBlock } from './AppShell';
import CreationWorkspace from './CreationWorkspace';
import { addDemoMedia, runDemoGeneration, type DemoMediaItem } from './demo-media';

const ASPECT_RATIOS = ['1:1', '4:3', '16:9', '9:16'] as const;
const OUTPUT_COUNTS = [1, 2, 3, 4] as const;

export type ImageRequestDraft = {
  prompt: string;
  referenceFile: File | null;
  modelId: string;
  aspectRatio: (typeof ASPECT_RATIOS)[number];
  outputCount: (typeof OUTPUT_COUNTS)[number];
  negativePrompt: string;
  seed: string;
};

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{children}</label>;
}

export default function ImageCanvas({ onGenerate }: { onGenerate?: (draft: ImageRequestDraft) => void | Promise<void> }) {
  const t = useTranslations('studio.image');
  const reduceMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState('');
  const [modelId, setModelId] = useState(IMAGE_MODELS[0]?.id ?? '');
  const [aspectRatio, setAspectRatio] = useState<(typeof ASPECT_RATIOS)[number]>('1:1');
  const [outputCount, setOutputCount] = useState<(typeof OUTPUT_COUNTS)[number]>(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [seed, setSeed] = useState('');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readyDraft, setReadyDraft] = useState<ImageRequestDraft | null>(null);
  const [demoResult, setDemoResult] = useState<DemoMediaItem | null>(null);
  const [demoStatus, setDemoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);

  useEffect(() => () => {
    if (referenceUrl) URL.revokeObjectURL(referenceUrl);
  }, [referenceUrl]);

  const chooseReference = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('errors.reference'));
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
      setError(t('errors.prompt'));
      setDemoStatus('error');
      return;
    }
    const selectedModel = IMAGE_MODELS.find((model) => model.id === modelId);
    if (!selectedModel || !isModelSelectable(selectedModel)) {
      setError(t('errors.model'));
      setDemoStatus('error');
      return;
    }
    const draft: ImageRequestDraft = {
      prompt: prompt.trim(), referenceFile, modelId, aspectRatio, outputCount,
      negativePrompt: negativePrompt.trim(), seed: seed.trim(),
    };
    setError(null);
    setReadyDraft(draft);
    setProgress(0);
    setDemoStatus('loading');
    try {
      await runDemoGeneration(setProgress, draft.prompt === 'demo:error');
      let result: DemoMediaItem | null = null;
      for (let index = 0; index < outputCount; index += 1) {
        result = addDemoMedia({ kind: 'image', prompt: draft.prompt, model: selectedModel.displayName, aspectRatio });
      }
      setDemoResult(result);
      setDemoStatus('success');
    } catch {
      setError(t('errors.demo'));
      setDemoStatus('error');
    }
  };

  return (
    <CreationWorkspace
      previewLabel={t('resultsLabel')}
      controls={<>
          <div className="studio-creation-header mb-7">
            <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">{t('eyebrow')}</p><span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">{t('demoMode')}</span></div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{t('title')}</h1>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[var(--studio-text-secondary)]">{t('description')}</p>
          </div>

          <form className="studio-creation-form space-y-5" onSubmit={submitDraft} noValidate>
            <div className="space-y-2">
              <FieldLabel htmlFor="image-prompt">{t('prompt')}</FieldLabel>
              <textarea id="image-prompt" value={prompt} onChange={(event) => { setPrompt(event.target.value); setError(null); }} rows={5} placeholder={t('promptPlaceholder')} className="studio-creation-prompt w-full resize-y rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3.5 py-3 text-[14px] leading-relaxed text-white outline-none transition-[border-color,background-color] duration-150 placeholder:text-white/40 hover:bg-[var(--studio-hover)] focus-visible:border-[var(--studio-border-strong)] focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none" />
            </div>

            <div className="space-y-2">
              <FieldLabel>{t('reference')}</FieldLabel>
              <input ref={fileInputRef} type="file" accept="image/*" aria-label={t('chooseReference')} className="sr-only" onChange={(event) => { chooseReference(event.target.files?.[0]); event.target.value = ''; }} />
              {referenceUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] p-2.5">
                  <img src={referenceUrl} alt={t('selectedReference')} className="h-14 w-14 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-medium text-white/85">{referenceFile?.name}</p><p className="mt-0.5 text-[11px] text-white/55">{t('localPreview')}</p></div>
                  <button type="button" onClick={clearReference} aria-label={t('removeReference')} className="flex h-9 w-9 items-center justify-center rounded-lg text-white/45 transition-[color,background-color] duration-150 hover:bg-[var(--studio-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="studio-creation-reference flex min-h-20 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] text-[12.5px] font-medium text-white/55 transition-[color,background-color,border-color] duration-150 hover:border-white/25 hover:bg-[var(--studio-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none"><Paperclip className="h-4 w-4" />{t('addReference')}</button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <FieldLabel htmlFor="image-model">{t('model')}</FieldLabel>
                <div className="relative"><select id="image-model" value={modelId} onChange={(event) => setModelId(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] ps-3.5 pe-10 text-[13px] text-white outline-none transition-[border-color,background-color] duration-150 hover:bg-[var(--studio-hover)] focus-visible:border-[var(--studio-border-strong)] focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none">{IMAGE_MODELS.map((model) => <option key={model.id} value={model.id} disabled={!isModelSelectable(model)}>{model.displayName} · {model.provider} · {model.availability === 'beta' ? 'Beta' : model.availability}</option>)}</select><ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" /></div>
              </div>
              <div className="space-y-2"><FieldLabel htmlFor="image-ratio">{t('aspectRatio')}</FieldLabel><select id="image-ratio" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as typeof aspectRatio)} className="h-11 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[13px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40">{ASPECT_RATIOS.map((ratio) => <option key={ratio}>{ratio}</option>)}</select></div>
              <div className="space-y-2"><FieldLabel htmlFor="image-count">{t('outputs')}</FieldLabel><select id="image-count" value={outputCount} onChange={(event) => setOutputCount(Number(event.target.value) as typeof outputCount)} className="h-11 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[13px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40">{OUTPUT_COUNTS.map((count) => <option key={count} value={count}>{count}</option>)}</select></div>
            </div>

            <div className="rounded-xl border border-[var(--studio-border-subtle)] bg-white/[0.015]">
              <button type="button" onClick={() => setAdvancedOpen((open) => !open)} aria-expanded={advancedOpen} aria-controls="image-advanced" className="flex h-11 w-full items-center justify-between px-3.5 text-[12.5px] font-medium text-white/65 transition-[color,background-color] duration-150 hover:bg-[var(--studio-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none"><span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />{t('advanced')}</span><ChevronDown className={cn('h-4 w-4 transition-transform duration-150 motion-reduce:transition-none', advancedOpen && 'rotate-180')} /></button>
              <AnimatePresence initial={false}>{advancedOpen && <motion.div id="image-advanced" initial={reduceMotion ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18 }} className="overflow-hidden"><div className="grid grid-cols-1 gap-3 border-t border-[var(--studio-border-subtle)] p-3 sm:grid-cols-2"><div className="space-y-1.5 sm:col-span-2"><FieldLabel htmlFor="negative-prompt">{t('negativePrompt')}</FieldLabel><input id="negative-prompt" value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} placeholder={t('negativePlaceholder')} className="h-10 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12.5px] text-white outline-none placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-white/40" /></div><div className="space-y-1.5"><FieldLabel htmlFor="image-seed">{t('seed')}</FieldLabel><input id="image-seed" inputMode="numeric" value={seed} onChange={(event) => setSeed(event.target.value.replace(/\D/g, ''))} placeholder={t('random')} className="h-10 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12.5px] text-white outline-none placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-white/40" /></div><p className="self-end pb-1 text-[11px] leading-relaxed text-white/50">{t('advancedNote')}</p></div></motion.div>}</AnimatePresence>
            </div>

            {error && <p role="alert" className="text-[12px] text-red-300">{error}</p>}
            <div className="studio-creation-action space-y-2"><PrimaryButton type="submit" disabled={demoStatus === 'loading'} className="w-full">{demoStatus === 'loading' ? t('generating', { progress }) : t('generateDemo')}</PrimaryButton><p className="text-center text-[11px] text-white/60">{t('demoNote')}</p></div>
          </form>
        </>}
      preview={<div className="flex min-h-[300px] w-full items-center justify-center lg:aspect-video lg:min-h-0">
          {demoStatus === 'loading' ? <StateBlock icon={<ImageIcon className="h-6 w-6 animate-pulse motion-reduce:animate-none" />} title={t('preparing')} description={t('progress', { progress })} /> : demoResult ? <div className="w-full"><img src={demoResult.assetUrl} alt={t('demoAssetAlt')} className="max-h-[70vh] w-full rounded-xl object-contain" /><p className="mt-3 text-center text-xs text-white/55">{t('demoAssetDisclosure')}</p></div> : readyDraft ? <StateBlock icon={<ImageIcon className="h-6 w-6" />} title={t('configurationReady')} description={t('configurationDescription', { ratio: readyDraft.aspectRatio, count: readyDraft.outputCount })} /> : <StateBlock icon={<ImageIcon className="h-6 w-6" />} title={t('emptyTitle')} description={t('emptyDescription')} />}
        </div>}
    />
  );
}
