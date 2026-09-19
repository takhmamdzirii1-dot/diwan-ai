'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Clapperboard, Download, FolderOpen, LoaderCircle, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { PrunaVideoMode, PrunaVideoResolution } from '@/lib/ai/pruna-video-request';
import type { ModelAspectRatio, ModelVideoDuration, VideoModelCapabilities } from '@/lib/models/capabilities';
import { isModelSelectable, type StudioRuntimeModelDefinition } from '@/src/config/studio-registry';
import { ModelSelector, type ChatModelOption } from '@/components/ui/claude-style-chat-input';
import { PrimaryButton, StateBlock } from './AppShell';
import CreationWorkspace from './CreationWorkspace';

export type VideoRequestDraft = {
  prompt: string;
  modelId: string;
  duration: ModelVideoDuration;
  aspectRatio: ModelAspectRatio;
  resolution: PrunaVideoResolution;
  mode: PrunaVideoMode;
};

export type VideoGenerationResult = {
  src: string;
  mimeType: string;
  creditsCharged: number;
  libraryAssetId: string;
};

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{children}</label>;
}

export default function PrunaMotionStudio({
  models,
  onGenerate,
  onOpenLibrary,
}: {
  models: StudioRuntimeModelDefinition[];
  onGenerate?: (draft: VideoRequestDraft) => Promise<VideoGenerationResult>;
  onOpenLibrary?: () => void;
}) {
  const t = useTranslations('studio.video');
  const executionT = useTranslations('studio.videoExecution');
  const modelsT = useTranslations('studio.models');
  const libraryT = useTranslations('studio.library');
  const submitGuardRef = useRef(false);
  const [prompt, setPrompt] = useState('');
  const [modelId, setModelId] = useState(models.find(isModelSelectable)?.id ?? models[0]?.id ?? '');
  const [duration, setDuration] = useState<ModelVideoDuration | ''>('');
  const [aspectRatio, setAspectRatio] = useState<ModelAspectRatio | ''>('');
  const [resolution, setResolution] = useState<PrunaVideoResolution>('768p');
  const [generationMode, setGenerationMode] = useState<PrunaVideoMode>('speed');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<VideoGenerationResult | null>(null);

  const modelOptions: ChatModelOption[] = models.map((model) => ({
    id: model.id,
    name: model.displayName,
    availability: model.availability,
    enabled: model.enabled,
    iconUrl: model.iconUrl,
  }));
  const selectedModel = models.find((model) => model.id === modelId);
  const capabilities = selectedModel?.capabilities as VideoModelCapabilities | undefined;
  const configurationValid = Boolean(
    onGenerate
    && selectedModel
    && isModelSelectable(selectedModel)
    && capabilities?.textToVideo
    && duration
    && capabilities.durations.includes(duration)
    && aspectRatio
    && capabilities.aspectRatios.includes(aspectRatio)
  );
  const generationAvailable = configurationValid && Boolean(prompt.trim()) && !isSubmitting;

  useEffect(() => {
    if (!capabilities) return;
    setDuration((current) => capabilities.durations.includes(current as ModelVideoDuration)
      ? current
      : (capabilities.durations[0] ?? ''));
    setAspectRatio((current) => capabilities.aspectRatios.includes(current as ModelAspectRatio)
      ? current
      : (capabilities.aspectRatios[0] ?? ''));
  }, [modelId, capabilities]);

  const buildDraft = () => {
    if (!prompt.trim()) {
      setError(t('errors.prompt'));
      return null;
    }
    if (!configurationValid || !duration || !aspectRatio) {
      setError(t('errors.model'));
      return null;
    }
    return {
      prompt: prompt.trim(), modelId, duration, aspectRatio, resolution, mode: generationMode,
    } satisfies VideoRequestDraft;
  };

  const generate = async (draft: VideoRequestDraft) => {
    if (!onGenerate || submitGuardRef.current) return;
    submitGuardRef.current = true;
    setError(null);
    setResult(null);
    setIsSubmitting(true);
    try {
      setResult(await onGenerate(draft));
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'VIDEO_GENERATION_FAILED';
      setError(code === 'INSUFFICIENT_CREDITS'
        ? executionT('insufficientCredits')
        : code === 'AUTHENTICATION_REQUIRED'
          ? executionT('signIn')
          : code === 'VIDEO_GENERATION_UNAVAILABLE'
            ? executionT('unavailable')
            : t('errors.generation'));
    } finally {
      submitGuardRef.current = false;
      setIsSubmitting(false);
    }
  };

  const submitDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    const draft = buildDraft();
    if (draft) await generate(draft);
  };

  const downloadResult = async () => {
    if (!result) return;
    try {
      const response = await fetch(result.src);
      if (!response.ok) throw new Error('DOWNLOAD_FAILED');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'vantra-video.mp4';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setError(executionT('downloadError'));
    }
  };

  const options = <T extends string>(values: readonly T[], selected: T, select: (value: T) => void, label: (value: T) => string) => (
    <div className="flex gap-2">{values.map((value) => <button key={value} type="button" aria-pressed={selected === value} onClick={() => select(value)} className={cn('min-h-9 flex-1 rounded-lg border px-3 text-[12px] font-semibold', selected === value ? 'border-[var(--studio-accent)] bg-[var(--studio-accent)] text-[var(--studio-accent-contrast)]' : 'border-[var(--studio-border)] text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-primary)]')}>{label(value)}</button>)}</div>
  );

  return <CreationWorkspace
    previewLabel={t('previewLabel')}
    controls={<>
      <div className="studio-creation-header mb-6"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{t('eyebrow')}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{t('title')}</h1><p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[var(--studio-text-secondary)]">{t('description')}</p></div>
      <form className="studio-creation-form space-y-5" onSubmit={submitDraft} noValidate>
        <div className="space-y-2"><FieldLabel htmlFor="video-prompt">{t('prompt')}</FieldLabel><textarea id="video-prompt" value={prompt} onChange={(event) => { setPrompt(event.target.value); setError(null); }} rows={5} placeholder={t('promptPlaceholder')} className="studio-creation-prompt w-full resize-y rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3.5 py-3 text-[14px] leading-relaxed text-white outline-none transition-[border-color,background-color] duration-150 placeholder:text-white/40 hover:bg-[var(--studio-hover)] focus-visible:border-[var(--studio-border-strong)] focus-visible:ring-2 focus-visible:ring-white/40" /></div>
        <div className="space-y-2"><FieldLabel>{t('model')}</FieldLabel><ModelSelector models={modelOptions} selectedModel={modelId} onSelect={setModelId} dropdownPosition="bottom" menuLabel={modelsT('videoMenuLabel')} emptyLabel={modelsT('noModels')} /></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {capabilities && capabilities.durations.length > 0 && <label className="space-y-2"><FieldLabel htmlFor="video-duration">{t('duration')}</FieldLabel><select id="video-duration" value={duration} onChange={(event) => setDuration(Number(event.target.value) as ModelVideoDuration)} className="h-10 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12.5px] text-white">{capabilities.durations.map((value) => <option key={value} value={value}>{t('durationSeconds', { value })}</option>)}</select></label>}
          {capabilities && capabilities.aspectRatios.length > 0 && <label className="space-y-2"><FieldLabel htmlFor="video-aspect">{t('aspectRatio')}</FieldLabel><select id="video-aspect" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as ModelAspectRatio)} className="h-10 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12.5px] text-white">{capabilities.aspectRatios.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>}
          <div className="space-y-2"><FieldLabel>{executionT('resolution')}</FieldLabel>{options(['480p', '768p'] as const, resolution, (value) => setResolution(value as PrunaVideoResolution), (value) => value)}</div>
          <div className="space-y-2"><FieldLabel>{t('modeLabel')}</FieldLabel>{options(['speed', 'quality'] as const, generationMode, (value) => setGenerationMode(value as PrunaVideoMode), (value) => executionT(value))}</div>
        </div>
        {error && <p role="alert" className="text-[12px] text-red-300">{error}</p>}
        <div className="studio-creation-action space-y-2"><PrimaryButton type="submit" disabled={!generationAvailable} className="w-full">{isSubmitting ? t('generating') : t('generate')}</PrimaryButton>{!configurationValid && <p className="text-center text-[11.5px] font-medium text-white/60">{t('unavailableNote')}</p>}</div>
      </form>
    </>}
    preview={<div className="flex min-h-[300px] w-full items-center justify-center lg:min-h-0">{isSubmitting
      ? <StateBlock icon={<LoaderCircle className="h-6 w-6 animate-spin motion-reduce:animate-none" />} title={executionT('generatingTitle')} description={executionT('generatingDescription')} />
      : result
        ? <div className="flex w-full flex-col gap-3"><div className="flex min-h-[300px] items-center justify-center overflow-hidden rounded-xl border border-[var(--studio-border-subtle)] bg-black"><video src={result.src} controls playsInline className="max-h-[min(68vh,760px)] w-full object-contain" aria-label={executionT('resultAlt')} /></div><div className="flex flex-wrap justify-end gap-2">{result.libraryAssetId && onOpenLibrary && <button type="button" onClick={onOpenLibrary} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] font-medium text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)]"><FolderOpen className="h-4 w-4" />{libraryT('openInLibrary')}</button>}<button type="button" onClick={downloadResult} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] font-medium text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)]"><Download className="h-4 w-4" />{executionT('download')}</button><button type="button" onClick={() => { const draft = buildDraft(); if (draft) void generate(draft); }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] font-medium text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)]"><RotateCcw className="h-4 w-4" />{executionT('regenerate')}</button></div></div>
        : error
          ? <StateBlock icon={<Clapperboard className="h-6 w-6" />} title={executionT('errorTitle')} description={error} />
          : <StateBlock icon={<Clapperboard className="h-6 w-6" />} title={t('emptyTitle')} description={t('emptyDescription')} />}</div>}
  />;
}
