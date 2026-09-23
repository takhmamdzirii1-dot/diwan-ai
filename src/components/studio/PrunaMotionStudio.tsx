'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Clapperboard, Download, FolderOpen, ImagePlus, LoaderCircle, RotateCcw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  PRUNA_SOURCE_IMAGE_MAX_BYTES,
  PRUNA_SOURCE_IMAGE_TYPES,
  type PrunaVideoMode,
  type PrunaVideoResolution,
  type PrunaVideoSourceMode,
} from '@/lib/ai/pruna-video-request';
import type { ModelAspectRatio, ModelVideoDuration, VideoModelCapabilities } from '@/lib/models/capabilities';
import { isModelSelectable, type StudioRuntimeModelDefinition } from '@/src/config/studio-registry';
import { ModelSelector, type ChatModelOption } from '@/components/ui/claude-style-chat-input';
import { PrimaryButton, Segmented, StateBlock } from './AppShell';
import CreationWorkspace from './CreationWorkspace';
import { downloadPrivateMedia } from './media-repository';
import MediaResultRail, { type SessionResult } from './MediaResultRail';
import StudioVideoPlayer from './StudioVideoPlayer';

export type VideoRequestDraft = {
  prompt: string;
  modelId: string;
  sourceMode: PrunaVideoSourceMode;
  sourceImage?: File;
  endImage?: File;
  duration: ModelVideoDuration;
  aspectRatio?: ModelAspectRatio;
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

function ImageUploadField({
  label,
  inputRef,
  previewUrl,
  chooseLabel,
  selectedLabel,
  replaceLabel,
  removeLabel,
  addLabel,
  onChoose,
  onRemove,
}: {
  label: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  previewUrl: string | null;
  chooseLabel: string;
  selectedLabel: string;
  replaceLabel: string;
  removeLabel: string;
  addLabel: string;
  onChoose: (file?: File) => void;
  onRemove: () => void;
}) {
  return <div className="space-y-2">
    <FieldLabel>{label}</FieldLabel>
    <input
      ref={inputRef}
      type="file"
      accept={PRUNA_SOURCE_IMAGE_TYPES.join(',')}
      aria-label={chooseLabel}
      className="sr-only"
      onChange={(event) => {
        onChoose(event.target.files?.[0]);
        event.target.value = '';
      }}
    />
    {previewUrl ? <div className="flex items-center gap-3 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] p-2.5">
      <img src={previewUrl} alt={selectedLabel} className="h-14 w-14 rounded-lg object-cover" />
      <div className="min-w-0 flex-1"><button type="button" onClick={() => inputRef.current?.click()} className="text-[12.5px] font-medium text-white/85 hover:text-white">{replaceLabel}</button></div>
      <button type="button" onClick={onRemove} aria-label={removeLabel} className="flex h-9 w-9 items-center justify-center rounded-lg text-white/55 transition-[color,background-color] duration-150 hover:bg-[var(--studio-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 motion-reduce:transition-none"><X className="h-4 w-4" /></button>
    </div> : <button type="button" onClick={() => inputRef.current?.click()} className="studio-creation-reference flex min-h-20 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--studio-border)] bg-[var(--studio-recessed)] text-[12.5px] font-medium text-[var(--studio-text-secondary)] transition-[color,background-color,border-color] duration-150 hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)] motion-reduce:transition-none"><ImagePlus className="h-4 w-4" />{addLabel}</button>}
  </div>;
}

export default function PrunaMotionStudio({
  models,
  onGenerate,
  onOpenLibrary,
  onModelAccessRequest,
}: {
  models: StudioRuntimeModelDefinition[];
  onGenerate?: (draft: VideoRequestDraft) => Promise<VideoGenerationResult>;
  onOpenLibrary?: () => void;
  onModelAccessRequest?: (model: ChatModelOption) => void;
}) {
  const t = useTranslations('studio.video');
  const executionT = useTranslations('studio.videoExecution');
  const modelsT = useTranslations('studio.models');
  const libraryT = useTranslations('studio.library');
  const viewerT = useTranslations('studio.mediaViewer');
  const submitGuardRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endFileInputRef = useRef<HTMLInputElement>(null);
  const [sourceMode, setSourceMode] = useState<PrunaVideoSourceMode>('text');
  const [prompt, setPrompt] = useState('');
  const [modelId, setModelId] = useState(models.find(isModelSelectable)?.id ?? models[0]?.id ?? '');
  const [duration, setDuration] = useState<ModelVideoDuration | ''>('');
  const [aspectRatio, setAspectRatio] = useState<ModelAspectRatio | ''>('');
  const [resolution, setResolution] = useState<PrunaVideoResolution>('768p');
  const [generationMode, setGenerationMode] = useState<PrunaVideoMode>('speed');
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [endImage, setEndImage] = useState<File | null>(null);
  const [endImageUrl, setEndImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<VideoGenerationResult | null>(null);
  const [sessionResults, setSessionResults] = useState<(VideoGenerationResult & SessionResult)[]>([]);

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
    accessState: model.accessState,
    trialAllowance: model.trialAllowance,
  }));
  const selectedModel = models.find((model) => model.id === modelId);
  const capabilities = selectedModel?.capabilities as VideoModelCapabilities | undefined;
  const supportedSourceModes: PrunaVideoSourceMode[] = capabilities
    ? [capabilities.textToVideo ? 'text' : null, capabilities.imageToVideo ? 'image' : null]
      .filter((value): value is PrunaVideoSourceMode => Boolean(value))
    : [];
  const sourceModeSupported = sourceMode === 'text'
    ? capabilities?.textToVideo
    : capabilities?.imageToVideo;
  const configurationValid = Boolean(
    onGenerate
    && selectedModel
    && isModelSelectable(selectedModel)
    && sourceModeSupported
    && duration
    && capabilities.durations.includes(duration)
    && (sourceMode === 'image'
      || Boolean(aspectRatio && capabilities.aspectRatios.includes(aspectRatio)))
  );
  const generationAvailable = configurationValid
    && Boolean(prompt.trim())
    && (sourceMode !== 'image' || Boolean(sourceImage))
    && !isSubmitting;

  useEffect(() => () => {
    if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl);
  }, [sourceImageUrl]);

  useEffect(() => () => {
    if (endImageUrl) URL.revokeObjectURL(endImageUrl);
  }, [endImageUrl]);

  const clearSourceImage = () => {
    if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl);
    setSourceImage(null);
    setSourceImageUrl(null);
  };

  const clearEndImage = () => {
    if (endImageUrl) URL.revokeObjectURL(endImageUrl);
    setEndImage(null);
    setEndImageUrl(null);
  };

  const chooseSourceImage = (file?: File) => {
    if (!file) return;
    if (!PRUNA_SOURCE_IMAGE_TYPES.includes(file.type as (typeof PRUNA_SOURCE_IMAGE_TYPES)[number])
      || file.size === 0 || file.size > PRUNA_SOURCE_IMAGE_MAX_BYTES) {
      setError(t('errors.reference'));
      return;
    }
    if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl);
    setSourceImage(file);
    setSourceImageUrl(URL.createObjectURL(file));
    setError(null);
  };

  const chooseEndImage = (file?: File) => {
    if (!file) return;
    if (!PRUNA_SOURCE_IMAGE_TYPES.includes(file.type as (typeof PRUNA_SOURCE_IMAGE_TYPES)[number])
      || file.size === 0 || file.size > PRUNA_SOURCE_IMAGE_MAX_BYTES) {
      setError(t('errors.reference'));
      return;
    }
    if (endImageUrl) URL.revokeObjectURL(endImageUrl);
    setEndImage(file);
    setEndImageUrl(URL.createObjectURL(file));
    setError(null);
  };

  useEffect(() => {
    if (!capabilities) return;
    setSourceMode((current) => supportedSourceModes.includes(current)
      ? current
      : (supportedSourceModes[0] ?? 'text'));
    setDuration((current) => capabilities.durations.includes(current as ModelVideoDuration)
      ? current
      : (capabilities.durations[0] ?? ''));
    setAspectRatio((current) => capabilities.aspectRatios.includes(current as ModelAspectRatio)
      ? current
      : (capabilities.aspectRatios[0] ?? ''));
    if (!capabilities.imageToVideo) {
      clearSourceImage();
      clearEndImage();
    }
  }, [modelId, capabilities]);

  const buildDraft = () => {
    if (!prompt.trim()) {
      setError(t('errors.prompt'));
      return null;
    }
    if (!configurationValid || !duration) {
      setError(t('errors.model'));
      return null;
    }
    if (sourceMode === 'image' && !sourceImage) {
      setError(t('errors.referenceRequired'));
      return null;
    }
    const draft: VideoRequestDraft = {
      prompt: prompt.trim(), modelId, sourceMode, duration, resolution, mode: generationMode,
    };
    if (sourceMode === 'image' && sourceImage) draft.sourceImage = sourceImage;
    if (sourceMode === 'image' && endImage) draft.endImage = endImage;
    if (sourceMode === 'text' && aspectRatio) draft.aspectRatio = aspectRatio;
    return draft;
  };

  const generate = async (draft: VideoRequestDraft) => {
    if (!onGenerate || submitGuardRef.current) return;
    submitGuardRef.current = true;
    setError(null);
    setIsSubmitting(true);
    try {
      const completed = await onGenerate(draft);
      setResult(completed);
      setSessionResults((current) => [{ ...completed, thumbnail: null }, ...current.filter((item) => item.libraryAssetId !== completed.libraryAssetId)].slice(0, 12));
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'VIDEO_GENERATION_FAILED';
      if (code === 'ACCESS_PROMPTED') return;
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

  const downloadResult = () => {
    if (!result) return;
    downloadPrivateMedia(result.libraryAssetId);
  };

  const options = <T extends string>(values: readonly T[], selected: T, select: (value: T) => void, label: (value: T) => string) => (
    <div className="flex gap-2">{values.map((value) => <button key={value} type="button" aria-pressed={selected === value} onClick={() => select(value)} className={cn('min-h-9 flex-1 rounded-lg border px-3 text-[12px] font-semibold', selected === value ? 'border-[var(--studio-accent)] bg-[var(--studio-accent)] text-[var(--studio-accent-contrast)]' : 'border-[var(--studio-border)] text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-primary)]')}>{label(value)}</button>)}</div>
  );

  return <CreationWorkspace
    previewLabel={t('previewLabel')}
    controls={<>
      <div className="studio-creation-header mb-6"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{t('eyebrow')}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{t('title')}</h1><p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[var(--studio-text-secondary)]">{t('description')}</p></div>
      <form className="studio-creation-form space-y-5" onSubmit={submitDraft} noValidate>
        {supportedSourceModes.length > 1 && <Segmented
          value={sourceMode}
          onChange={(value) => {
            setSourceMode(value);
            if (value === 'text') {
              clearSourceImage();
              clearEndImage();
            }
            setError(null);
          }}
          layoutId="pruna-video-source-mode"
          label={t('modeLabel')}
          options={supportedSourceModes.map((value) => ({
            value,
            label: t(value === 'text' ? 'textToVideo' : 'imageToVideo'),
          }))}
          className="w-full [&>button]:flex-1"
        />}
        <div className="space-y-2"><div className="flex items-center justify-between gap-3"><FieldLabel htmlFor="video-prompt">{t('prompt')}</FieldLabel><span dir="ltr" aria-label={`${viewerT('characters')}: ${prompt.length} / 2000`} className={`text-[10px] tabular-nums ${prompt.length > 2000 ? 'text-red-300' : 'text-[var(--studio-text-muted)]'}`}>{prompt.length} / 2000</span></div><textarea id="video-prompt" value={prompt} onChange={(event) => { setPrompt(event.target.value); setError(null); }} rows={5} placeholder={t('promptPlaceholder')} className="studio-creation-prompt w-full resize-y rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3.5 py-3 text-[14px] leading-relaxed text-white outline-none transition-[border-color,background-color] duration-150 placeholder:text-white/40 hover:bg-[var(--studio-hover)] focus-visible:border-[var(--studio-border-strong)] focus-visible:ring-2 focus-visible:ring-white/40" /></div>
        {sourceMode === 'image' && capabilities?.imageToVideo && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ImageUploadField label={t('startImage')} inputRef={fileInputRef} previewUrl={sourceImageUrl} chooseLabel={t('chooseStartImage')} selectedLabel={t('selectedStartImage')} replaceLabel={t('replaceStartImage')} removeLabel={t('removeStartImage')} addLabel={t('addStartImage')} onChoose={chooseSourceImage} onRemove={clearSourceImage} />
          <ImageUploadField label={t('endImage')} inputRef={endFileInputRef} previewUrl={endImageUrl} chooseLabel={t('chooseEndImage')} selectedLabel={t('selectedEndImage')} replaceLabel={t('replaceEndImage')} removeLabel={t('removeEndImage')} addLabel={t('addEndImage')} onChoose={chooseEndImage} onRemove={clearEndImage} />
        </div>}
        <div className="space-y-2"><FieldLabel>{t('model')}</FieldLabel><ModelSelector models={modelOptions} selectedModel={modelId} onSelect={setModelId} onAccessRequest={onModelAccessRequest} dropdownPosition="top" wideTrigger menuLabel={modelsT('videoMenuLabel')} emptyLabel={modelsT('noModels')} modality="video" /></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {capabilities && capabilities.durations.length > 0 && <label className="space-y-2"><FieldLabel htmlFor="video-duration">{t('duration')}</FieldLabel><select id="video-duration" value={duration} onChange={(event) => setDuration(Number(event.target.value) as ModelVideoDuration)} className="h-10 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12.5px] text-white">{capabilities.durations.map((value) => <option key={value} value={value}>{t('durationSeconds', { value })}</option>)}</select></label>}
          {sourceMode === 'text' && capabilities && capabilities.aspectRatios.length > 0 && <label className="space-y-2"><FieldLabel htmlFor="video-aspect">{t('aspectRatio')}</FieldLabel><select id="video-aspect" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as ModelAspectRatio)} className="h-10 w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12.5px] text-white">{capabilities.aspectRatios.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>}
          <div className="space-y-2"><FieldLabel>{executionT('resolution')}</FieldLabel>{options(['480p', '768p'] as const, resolution, (value) => setResolution(value as PrunaVideoResolution), (value) => value)}</div>
          <div className="space-y-2" role="group" aria-label={t('modeLabel')}><FieldLabel>{t('modeShort')}</FieldLabel>{options(['speed', 'quality'] as const, generationMode, (value) => setGenerationMode(value as PrunaVideoMode), (value) => executionT(value))}</div>
        </div>
        {error && <p role="alert" className="text-[12px] text-red-300">{error}</p>}
        <div className="studio-creation-action space-y-2"><PrimaryButton type="submit" disabled={!generationAvailable} className="w-full">{isSubmitting ? t('generating') : t('generate')}</PrimaryButton>{!configurationValid && <p className="text-center text-[11.5px] font-medium text-white/60">{t('unavailableNote')}</p>}</div>
      </form>
    </>}
    preview={<div className="flex min-h-[320px] w-full flex-col gap-3 lg:h-full lg:min-h-0">
      <div className="flex min-h-[300px] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-[var(--studio-border-subtle)] bg-black">
        {isSubmitting ? <StateBlock icon={<LoaderCircle className="h-6 w-6 animate-spin motion-reduce:animate-none" />} title={executionT('generatingTitle')} description={executionT('generatingDescription')} />
          : result ? <StudioVideoPlayer key={result.libraryAssetId} src={result.src} label={executionT('resultAlt')}
            onThumbnail={(thumbnail) => { if (thumbnail) setSessionResults((current) => current.map((item) => item.libraryAssetId === result.libraryAssetId ? { ...item, thumbnail } : item)); }} />
            : error ? <StateBlock icon={<Clapperboard className="h-6 w-6" />} title={executionT('errorTitle')} description={error} />
              : <StateBlock icon={<Clapperboard className="h-6 w-6" />} title={t('emptyTitle')} description={t('emptyDescription')} />}
      </div>
      {result && !isSubmitting && <div className="flex flex-wrap items-center justify-end gap-2">
        {result.libraryAssetId && onOpenLibrary && <button type="button" onClick={onOpenLibrary} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--studio-border)] px-3 text-[12px] font-medium text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)]"><FolderOpen className="h-4 w-4" />{libraryT('openInLibrary')}</button>}
        <button type="button" onClick={downloadResult} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--studio-border)] px-3 text-[12px] font-medium text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)]"><Download className="h-4 w-4" />{executionT('download')}</button>
        <button type="button" onClick={() => { const draft = buildDraft(); if (draft) void generate(draft); }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--studio-border)] px-3 text-[12px] font-medium text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)]"><RotateCcw className="h-4 w-4" />{executionT('regenerate')}</button>
      </div>}
      <MediaResultRail items={sessionResults} selectedId={result?.libraryAssetId ?? ''} kind="video" onSelect={(id) => { const selected = sessionResults.find((item) => item.libraryAssetId === id); if (selected) setResult(selected); }} />
    </div>}
  />;
}
