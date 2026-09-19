'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Download, FolderOpen, ImageIcon, LoaderCircle, Paperclip, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { isModelSelectable, type StudioRuntimeModelDefinition } from '@/src/config/studio-registry';
import { PrimaryButton, StateBlock } from './AppShell';
import CreationWorkspace from './CreationWorkspace';
import { ModelSelector, type ChatModelOption } from '@/components/ui/claude-style-chat-input';
import type { ImageModelCapabilities, ModelAspectRatio } from '@/lib/models/capabilities';

export type ImageRequestDraft = {
  prompt: string;
  modelId: string;
  referenceFile?: File;
  aspectRatio?: ModelAspectRatio;
  outputCount?: number;
  negativePrompt?: string;
};

export type ImageGenerationResult = {
  src: string;
  mimeType: string;
  creditsCharged: number;
  libraryAssetId: string;
};

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{children}</label>;
}

export default function ImageCanvas({ models, onGenerate, onOpenLibrary }: { models: StudioRuntimeModelDefinition[]; onGenerate?: (draft: ImageRequestDraft) => Promise<ImageGenerationResult>; onOpenLibrary?: () => void }) {
  const t = useTranslations('studio.image');
  const modelsT = useTranslations('studio.models');
  const libraryT = useTranslations('studio.library');
  const reduceMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState('');
  const [modelId, setModelId] = useState(models.find(isModelSelectable)?.id ?? models[0]?.id ?? '');
  const [aspectRatio, setAspectRatio] = useState<ModelAspectRatio | ''>('');
  const [outputCount, setOutputCount] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ImageGenerationResult | null>(null);

  const modelOptions: ChatModelOption[] = models.map((model) => ({
    id: model.id,
    name: model.displayName,
    availability: model.availability,
    enabled: model.enabled,
    iconUrl: model.iconUrl,
  }));
  const selectedModel = models.find((model) => model.id === modelId);
  const capabilities = selectedModel?.capabilities as ImageModelCapabilities | undefined;
  const hasAdvanced = Boolean(capabilities && (capabilities.maxOutputs > 1 || capabilities.negativePrompt));
  const generationAvailable = Boolean(onGenerate && selectedModel && isModelSelectable(selectedModel) && capabilities?.textToImage);

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

  useEffect(() => {
    if (!capabilities) return;
    setAspectRatio((current) => capabilities.aspectRatios.includes(current as ModelAspectRatio) ? current : (capabilities.aspectRatios[0] ?? ''));
    setOutputCount((current) => Math.min(Math.max(current, 1), capabilities.maxOutputs));
    if (!capabilities.referenceImage) clearReference();
    if (!capabilities.negativePrompt) setNegativePrompt('');
  }, [modelId]);

  const buildDraft = () => {
    if (!prompt.trim()) {
      setError(t('errors.prompt'));
      return null;
    }
    const selectedModel = models.find((model) => model.id === modelId);
    if (!selectedModel || !isModelSelectable(selectedModel)) {
      setError(t('errors.model'));
      return null;
    }
    if (!capabilities?.textToImage) { setError(t('errors.model')); return null; }
    const draft: ImageRequestDraft = { prompt: prompt.trim(), modelId };
    if (capabilities.referenceImage && referenceFile) draft.referenceFile = referenceFile;
    if (aspectRatio && capabilities.aspectRatios.includes(aspectRatio)) draft.aspectRatio = aspectRatio;
    if (capabilities.maxOutputs > 1) draft.outputCount = outputCount;
    if (capabilities.negativePrompt && negativePrompt.trim()) draft.negativePrompt = negativePrompt.trim();
    return draft;
  };

  const generate = async (draft: ImageRequestDraft) => {
    setError(null);
    if (!onGenerate) return;
    setIsSubmitting(true);
    setResult(null);
    try {
      setResult(await onGenerate(draft));
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'IMAGE_GENERATION_FAILED';
      setError(code === 'INSUFFICIENT_CREDITS'
        ? t('errors.insufficientCredits')
        : code === 'AUTHENTICATION_REQUIRED'
          ? t('errors.signIn')
          : code === 'IMAGE_GENERATION_UNAVAILABLE'
            ? t('errors.unavailable')
            : t('errors.generation'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    const draft = buildDraft();
    if (draft) await generate(draft);
  };

  const regenerate = async () => {
    const draft = buildDraft();
    if (draft) await generate(draft);
  };

  const downloadResult = async () => {
    if (!result) return;
    try {
      const response = await fetch(result.src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vantra-image.${result.mimeType === 'image/jpeg' ? 'jpg' : 'png'}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setError(t('errors.download'));
    }
  };

  return (
    <CreationWorkspace
      previewLabel={t('resultsLabel')}
      controls={<>
          <div className="studio-creation-header mb-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{t('eyebrow')}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{t('title')}</h1>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[var(--studio-text-secondary)]">{t('description')}</p>
          </div>

          <form className="studio-creation-form space-y-5" onSubmit={submitDraft} noValidate>
            <div className="space-y-2">
              <FieldLabel htmlFor="image-prompt">{t('prompt')}</FieldLabel>
              <textarea id="image-prompt" value={prompt} onChange={(event) => { setPrompt(event.target.value); setError(null); }} rows={5} placeholder={t('promptPlaceholder')} className="studio-creation-prompt w-full resize-y rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3.5 py-3 text-[14px] leading-relaxed text-white outline-none transition-[border-color,background-color] duration-150 placeholder:text-white/40 hover:bg-[var(--studio-hover)] focus-visible:border-[var(--studio-border-strong)] focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none" />
            </div>

            {capabilities?.referenceImage && <div className="space-y-2">
              <FieldLabel>{t('reference')}</FieldLabel>
              <input ref={fileInputRef} type="file" accept="image/*" aria-label={t('chooseReference')} className="sr-only" onChange={(event) => { chooseReference(event.target.files?.[0]); event.target.value = ''; }} />
              {referenceUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] p-2.5">
                  <img src={referenceUrl} alt={t('selectedReference')} className="h-14 w-14 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1"><button type="button" onClick={() => fileInputRef.current?.click()} className="text-[12.5px] font-medium text-white/85 hover:text-white">{t('replaceReference')}</button></div>
                  <button type="button" onClick={clearReference} aria-label={t('removeReference')} className="flex h-9 w-9 items-center justify-center rounded-lg text-white/45 transition-[color,background-color] duration-150 hover:bg-[var(--studio-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="studio-creation-reference flex min-h-20 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--studio-border)] bg-[var(--studio-recessed)] text-[12.5px] font-medium text-[var(--studio-text-secondary)] transition-[color,background-color,border-color] duration-150 hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)] motion-reduce:transition-none"><Paperclip className="h-4 w-4" />{t('addReference')}</button>
              )}
            </div>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <FieldLabel>{t('model')}</FieldLabel>
                <ModelSelector models={modelOptions} selectedModel={modelId} onSelect={setModelId} dropdownPosition="bottom" menuLabel={modelsT('imageMenuLabel')} emptyLabel={modelsT('noModels')} />
              </div>
              {capabilities && capabilities.aspectRatios.length > 0 && <div className="space-y-2 sm:col-span-2"><FieldLabel>{t('aspectRatio')}</FieldLabel><div className="flex flex-wrap gap-2">{capabilities.aspectRatios.map((ratio) => <button key={ratio} type="button" aria-pressed={aspectRatio === ratio} onClick={() => setAspectRatio(ratio)} className={cn('min-h-9 rounded-lg border px-3 text-[12px] font-semibold transition-colors duration-150 motion-reduce:transition-none', aspectRatio === ratio ? 'border-[var(--studio-accent)] bg-[var(--studio-accent)] text-[var(--studio-accent-contrast)]' : 'border-[var(--studio-border)] text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-primary)]')}>{ratio}</button>)}</div></div>}
            </div>

            {hasAdvanced && <div className="rounded-xl border border-[var(--studio-border-subtle)] bg-[var(--studio-recessed)]">
              <button type="button" onClick={() => setAdvancedOpen((open) => !open)} aria-expanded={advancedOpen} aria-controls="image-advanced" className="flex h-11 w-full items-center justify-between px-3.5 text-[12.5px] font-medium text-white/65 transition-[color,background-color] duration-150 hover:bg-[var(--studio-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none"><span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />{t('advanced')}</span><ChevronDown className={cn('h-4 w-4 transition-transform duration-150 motion-reduce:transition-none', advancedOpen && 'rotate-180')} /></button>
              <AnimatePresence initial={false}>{advancedOpen && <motion.div id="image-advanced" initial={reduceMotion ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18 }} className="overflow-hidden"><div className="grid grid-cols-1 gap-3 border-t border-[var(--studio-border-subtle)] p-3 sm:grid-cols-2">{capabilities && capabilities.maxOutputs > 1 && <div className="space-y-1.5"><FieldLabel htmlFor="image-count">{t('outputs')}</FieldLabel><select id="image-count" value={outputCount} onChange={(event) => setOutputCount(Number(event.target.value))} className="h-10 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12.5px] text-white">{Array.from({ length: capabilities.maxOutputs }, (_, index) => index + 1).map((count) => <option key={count}>{count}</option>)}</select></div>}{capabilities?.negativePrompt && <div className="space-y-1.5 sm:col-span-2"><FieldLabel htmlFor="negative-prompt">{t('negativePrompt')}</FieldLabel><input id="negative-prompt" value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} placeholder={t('negativePlaceholder')} className="h-10 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12.5px] text-white outline-none placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-white/40" /></div>}</div></motion.div>}</AnimatePresence>
            </div>}

            {error && <p role="alert" className="text-[12px] text-red-300">{error}</p>}
            <div className="studio-creation-action space-y-2"><PrimaryButton type="submit" disabled={!generationAvailable || isSubmitting} className="w-full">{isSubmitting ? t('generating') : t('generate')}</PrimaryButton>{!generationAvailable && <p className="text-center text-[11.5px] font-medium text-white/60">{t('unavailableNote')}</p>}</div>
          </form>
        </>}
      preview={<div className="flex min-h-[300px] w-full items-center justify-center lg:min-h-0">
          {isSubmitting ? (
            <StateBlock icon={<LoaderCircle className="h-6 w-6 animate-spin motion-reduce:animate-none" />} title={t('generatingTitle')} description={t('generatingDescription')} />
          ) : result ? (
            <div className="flex w-full flex-col gap-3">
              <div className="flex min-h-[300px] items-center justify-center overflow-hidden rounded-xl border border-[var(--studio-border-subtle)] bg-[var(--studio-recessed)]">
                <img src={result.src} alt={t('resultAlt')} className="max-h-[min(68vh,760px)] w-full object-contain" />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {result.libraryAssetId && onOpenLibrary && <button type="button" onClick={onOpenLibrary} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] font-medium text-[var(--studio-text-secondary)] transition-colors duration-150 hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)] motion-reduce:transition-none"><FolderOpen className="h-4 w-4" />{libraryT('openInLibrary')}</button>}
                <button type="button" onClick={downloadResult} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] font-medium text-[var(--studio-text-secondary)] transition-colors duration-150 hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)] motion-reduce:transition-none"><Download className="h-4 w-4" />{t('download')}</button>
                <button type="button" onClick={regenerate} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] font-medium text-[var(--studio-text-secondary)] transition-colors duration-150 hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)] motion-reduce:transition-none"><RotateCcw className="h-4 w-4" />{t('regenerate')}</button>
              </div>
            </div>
          ) : error ? (
            <StateBlock icon={<ImageIcon className="h-6 w-6" />} title={t('errorTitle')} description={error} />
          ) : (
            <StateBlock icon={<ImageIcon className="h-6 w-6" />} title={t('emptyTitle')} description={t('emptyDescription')} />
          )}
        </div>}
    />
  );
}
