'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Clapperboard, ImagePlus, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isModelSelectable, type StudioRuntimeModelDefinition } from '@/src/config/studio-registry';
import { PrimaryButton, Segmented, StateBlock } from './AppShell';
import CreationWorkspace from './CreationWorkspace';
import { useTranslations } from 'next-intl';
import { ModelSelector, type ChatModelOption } from '@/components/ui/claude-style-chat-input';
import type { ModelAspectRatio, ModelCameraMotion, ModelVideoDuration, VideoModelCapabilities } from '@/lib/models/capabilities';

type VideoMode = 'text' | 'image';

export type VideoRequestDraft = {
  mode: VideoMode;
  prompt: string;
  modelId: string;
  referenceFile?: File;
  duration?: number;
  aspectRatio?: ModelAspectRatio;
  cameraMotion?: ModelCameraMotion;
  generatedAudio?: boolean;
  negativePrompt?: string;
};

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{children}</label>;
}

export default function MotionStudio({ models, onGenerate }: { models: StudioRuntimeModelDefinition[]; onGenerate?: (draft: VideoRequestDraft) => void | Promise<void> }) {
  const reduceMotion = useReducedMotion();
  const t = useTranslations('studio.video');
  const controlsT = useTranslations('studio.videoControls');
  const modelsT = useTranslations('studio.models');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<VideoMode>('text');
  const [prompt, setPrompt] = useState('');
  const [modelId, setModelId] = useState(models.find((model) => model.enabled)?.id ?? models[0]?.id ?? '');
  const [duration, setDuration] = useState<ModelVideoDuration | ''>('');
  const [aspectRatio, setAspectRatio] = useState<ModelAspectRatio | ''>('');
  const [cameraMotion, setCameraMotion] = useState<ModelCameraMotion | ''>('');
  const [generatedAudio, setGeneratedAudio] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modelOptions: ChatModelOption[] = models.map((model) => ({
    id: model.id,
    name: model.displayName,
    availability: model.availability,
    enabled: model.enabled,
    iconUrl: model.iconUrl,
    provider: model.provider,
    brand: model.brand,
    allowedPlans: model.allowedPlans,
    creditCost: model.verifiedCreditCost,
    requiredPlan: model.enabled && !model.planAccessible ? model.requiredPlan : null,
  }));
  const selectedModel = models.find((model) => model.id === modelId);
  const capabilities = selectedModel?.capabilities as VideoModelCapabilities | undefined;
  const supportedModes: VideoMode[] = capabilities ? [capabilities.textToVideo ? 'text' : null, capabilities.imageToVideo ? 'image' : null].filter((value): value is VideoMode => Boolean(value)) : [];
  const modeSupported = mode === 'text' ? capabilities?.textToVideo : capabilities?.imageToVideo;
  const hasAdvanced = Boolean(capabilities && (capabilities.cameraMotions.length || capabilities.generatedAudio || capabilities.negativePrompt));
  const generationAvailable = Boolean(onGenerate && selectedModel && isModelSelectable(selectedModel) && modeSupported && (mode !== 'image' || referenceFile));

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
    setMode((current) => supportedModes.includes(current) ? current : (supportedModes[0] ?? 'text'));
    setDuration((current) => capabilities.durations.includes(current as ModelVideoDuration) ? current : (capabilities.durations[0] ?? ''));
    setAspectRatio((current) => capabilities.aspectRatios.includes(current as ModelAspectRatio) ? current : (capabilities.aspectRatios[0] ?? ''));
    setCameraMotion((current) => capabilities.cameraMotions.includes(current as ModelCameraMotion) ? current : (capabilities.cameraMotions.includes('auto') ? 'auto' : (capabilities.cameraMotions[0] ?? '')));
    if (!capabilities.imageToVideo) clearReference();
    if (!capabilities.generatedAudio) setGeneratedAudio(false);
    if (!capabilities.negativePrompt) setNegativePrompt('');
  }, [modelId]);

  const submitDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt.trim()) {
      setError(t('errors.prompt'));
      return;
    }
    if (!modeSupported) { setError(t('errors.model')); return; }
    if (mode === 'image' && !referenceFile) {
      setError(t('errors.referenceRequired'));
      return;
    }
    if (!selectedModel || !isModelSelectable(selectedModel)) {
      setError(t('errors.model'));
      return;
    }
    if (!onGenerate) return;
    setError(null); setIsSubmitting(true);
    try {
      const draft: VideoRequestDraft = { mode, prompt: prompt.trim(), modelId };
      if (mode === 'image' && capabilities?.imageToVideo && referenceFile) draft.referenceFile = referenceFile;
      if (duration && capabilities?.durations.includes(duration)) draft.duration = duration;
      if (aspectRatio && capabilities?.aspectRatios.includes(aspectRatio)) draft.aspectRatio = aspectRatio;
      if (cameraMotion && capabilities?.cameraMotions.includes(cameraMotion)) draft.cameraMotion = cameraMotion;
      if (capabilities?.generatedAudio) draft.generatedAudio = generatedAudio;
      if (capabilities?.negativePrompt && negativePrompt.trim()) draft.negativePrompt = negativePrompt.trim();
      await onGenerate(draft);
    } catch { setError(t('errors.generation')); }
    finally { setIsSubmitting(false); }
  };

  return (
    <CreationWorkspace
      previewLabel={t('previewLabel')}
      controls={<>
          <div className="studio-creation-header mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{t('eyebrow')}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{t('title')}</h1>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[var(--studio-text-secondary)]">{t('description')}</p>
          </div>

          <form className="studio-creation-form space-y-5" onSubmit={submitDraft} noValidate>
            {supportedModes.length > 1 && <Segmented value={mode} onChange={(value) => { setMode(value); setError(null); }} layoutId="video-mode" label={t('modeLabel')} options={supportedModes.map((value) => ({ value, label: t(value === 'text' ? 'textToVideo' : 'imageToVideo') }))} className="w-full [&>button]:flex-1" />}

            <div className="space-y-2"><FieldLabel htmlFor="video-prompt">{t('prompt')}</FieldLabel><textarea id="video-prompt" value={prompt} onChange={(event) => { setPrompt(event.target.value); setError(null); }} rows={5} placeholder={t('promptPlaceholder')} className="studio-creation-prompt w-full resize-y rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3.5 py-3 text-[14px] leading-relaxed text-white outline-none transition-[border-color,background-color] duration-150 placeholder:text-white/40 hover:bg-[var(--studio-hover)] focus-visible:border-[var(--studio-border-strong)] focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none" /></div>

            <div className="studio-video-reference-model contents">
              {mode === 'image' && capabilities?.imageToVideo && <div className="min-w-0 space-y-2"><FieldLabel>{t('sourceImage')}</FieldLabel><input ref={fileInputRef} type="file" accept="image/*" aria-label={t('chooseReference')} className="sr-only" onChange={(event) => { chooseReference(event.target.files?.[0]); event.target.value = ''; }} />{referenceUrl ? <div className="flex items-center gap-3 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] p-2.5"><img src={referenceUrl} alt={t('selectedReference')} className="h-14 w-14 rounded-lg object-cover" /><div className="min-w-0 flex-1"><button type="button" onClick={() => fileInputRef.current?.click()} className="text-[12.5px] font-medium text-white/85 hover:text-white">{t('replaceReference')}</button></div><button type="button" onClick={clearReference} aria-label={t('removeReference')} className="flex h-9 w-9 items-center justify-center rounded-lg text-white/55 transition-[color,background-color] duration-150 hover:bg-[var(--studio-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none"><X className="h-4 w-4" /></button></div> : <button type="button" onClick={() => fileInputRef.current?.click()} className="studio-creation-reference flex min-h-20 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--studio-border)] bg-[var(--studio-recessed)] text-[12.5px] font-medium text-[var(--studio-text-secondary)] transition-[color,background-color,border-color] duration-150 hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)] motion-reduce:transition-none"><ImagePlus className="h-4 w-4" />{t('addSourceImage')}</button>}</div>}
              <div className="min-w-0 space-y-2"><FieldLabel>{t('model')}</FieldLabel><ModelSelector models={modelOptions} selectedModel={modelId} onSelect={setModelId} dropdownPosition="bottom" menuLabel={modelsT('videoMenuLabel')} emptyLabel={modelsT('noModels')} modality="video" /></div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{capabilities && capabilities.durations.length > 0 && <div className="space-y-2"><FieldLabel>{t('duration')}</FieldLabel><div className="flex flex-wrap gap-2">{capabilities.durations.map((value) => <button key={value} type="button" aria-pressed={duration === value} onClick={() => setDuration(value)} className={cn('min-h-9 rounded-lg border px-3 text-[12px] font-semibold', duration === value ? 'border-[var(--studio-accent)] bg-[var(--studio-accent)] text-[var(--studio-accent-contrast)]' : 'border-[var(--studio-border)] text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-primary)]')}>{t('durationSeconds', { value })}</button>)}</div></div>}{capabilities && capabilities.aspectRatios.length > 0 && <div className="space-y-2"><FieldLabel>{t('aspectRatio')}</FieldLabel><div className="flex flex-wrap gap-2">{capabilities.aspectRatios.map((value) => <button key={value} type="button" aria-pressed={aspectRatio === value} onClick={() => setAspectRatio(value)} className={cn('min-h-9 rounded-lg border px-3 text-[12px] font-semibold', aspectRatio === value ? 'border-[var(--studio-accent)] bg-[var(--studio-accent)] text-[var(--studio-accent-contrast)]' : 'border-[var(--studio-border)] text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-primary)]')}>{value}</button>)}</div></div>}</div>

            {hasAdvanced && <div className="rounded-xl border border-[var(--studio-border-subtle)] bg-[var(--studio-recessed)]"><button type="button" onClick={() => setAdvancedOpen((open) => !open)} aria-expanded={advancedOpen} aria-controls="video-advanced" className="flex h-11 w-full items-center justify-between px-3.5 text-[12.5px] font-medium text-white/70 transition-[color,background-color] duration-150 hover:bg-[var(--studio-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none"><span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />{controlsT('advanced')}</span><ChevronDown className={cn('h-4 w-4 transition-transform duration-150 motion-reduce:transition-none', advancedOpen && 'rotate-180')} /></button><AnimatePresence initial={false}>{advancedOpen && <motion.div id="video-advanced" initial={reduceMotion ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18 }} className="overflow-hidden"><div className="space-y-3 border-t border-[var(--studio-border-subtle)] p-3">{capabilities && capabilities.cameraMotions.length > 0 && <label className="grid gap-1.5"><FieldLabel htmlFor="camera-motion">{controlsT('cameraMotion')}</FieldLabel><select id="camera-motion" value={cameraMotion} onChange={(event) => setCameraMotion(event.target.value as ModelCameraMotion)} className="h-10 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12.5px] text-white">{capabilities.cameraMotions.map((value) => <option key={value} value={value}>{controlsT(`camera.${value.replaceAll('-', '')}`)}</option>)}</select></label>}{capabilities?.generatedAudio && <label className="flex min-h-10 items-center gap-2 rounded-xl border border-[var(--studio-border)] px-3 text-[12px] font-medium text-white"><input type="checkbox" checked={generatedAudio} onChange={(event) => setGeneratedAudio(event.target.checked)} className="h-4 w-4 accent-white" />{controlsT('generatedAudio')}</label>}{capabilities?.negativePrompt && <div className="space-y-1.5"><FieldLabel htmlFor="video-negative">{controlsT('negativePrompt')}</FieldLabel><input id="video-negative" value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} placeholder={controlsT('negativePlaceholder')} className="h-10 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12.5px] text-white outline-none placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-white/40" /></div>}</div></motion.div>}</AnimatePresence></div>}

            {error && <p role="status" className="text-[12px] leading-relaxed text-white/55">{error}</p>}
            <div className="studio-creation-action space-y-2"><PrimaryButton type="submit" disabled={!generationAvailable || isSubmitting} aria-describedby="video-generate-help" className="w-full">{isSubmitting ? t('generating') : t('generate')}</PrimaryButton>{!generationAvailable && <p id="video-generate-help" className="text-center text-[11.5px] font-medium leading-relaxed text-white/60">{t('unavailableNote')}</p>}</div>
          </form>
        </>}
      preview={<div className="mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--studio-border-subtle)] bg-[var(--studio-recessed)]"><div className="flex h-full min-h-0 items-center justify-center p-4 sm:p-8"><StateBlock icon={<Clapperboard className="h-6 w-6" />} title={t('emptyTitle')} description={t('emptyDescription')} /></div></div>}
    />
  );
}
