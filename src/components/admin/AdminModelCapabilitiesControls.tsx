'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AdminModelRow } from '@/lib/admin/types';
import {
  MODEL_ASPECT_RATIOS,
  MODEL_CAMERA_MOTIONS,
  MODEL_VIDEO_DURATIONS,
  type ChatModelCapabilities,
  type ImageModelCapabilities,
  type ModelCapabilities,
  type VideoModelCapabilities,
} from '@/lib/models/capabilities';

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-9 items-center gap-2.5 rounded-lg border border-[var(--studio-border)] px-3 text-[12px] font-semibold text-white">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-white" />
    {label}
  </label>;
}

function Choices<T extends string | number>({ label, options, selected, onChange, format = String }: {
  label: string; options: readonly T[]; selected: readonly T[]; onChange: (value: T[]) => void; format?: (value: T) => string;
}) {
  return <fieldset className="rounded-lg border border-[var(--studio-border-subtle)] p-3">
    <legend className="px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{label}</legend>
    <div className="flex flex-wrap gap-1.5">{options.map((option) => {
      const active = selected.includes(option);
      return <button key={String(option)} type="button" aria-pressed={active} onClick={() => onChange(active ? selected.filter((item) => item !== option) : [...selected, option])} className={`min-h-8 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors duration-150 motion-reduce:transition-none ${active ? 'border-white bg-white text-black' : 'border-[var(--studio-border)] text-[var(--studio-text-secondary)] hover:text-white'}`}>{format(option)}</button>;
    })}</div>
  </fieldset>;
}

export default function AdminModelCapabilitiesControls({ model, onSaved }: {
  model: Pick<AdminModelRow, 'key' | 'modality' | 'capabilities'>;
  onSaved: (capabilities: ModelCapabilities, updatedAt: string) => void;
}) {
  const t = useTranslations('Admin.models.capabilities');
  const [value, setValue] = useState<ModelCapabilities>(model.capabilities);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  useEffect(() => { setValue(model.capabilities); setFeedback(null); }, [model]);
  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(model.capabilities), [value, model.capabilities]);
  const patch = (next: Partial<ModelCapabilities>) => { setValue((current) => ({ ...current, ...next } as ModelCapabilities)); setFeedback(null); };

  const save = async () => {
    setSaving(true); setFeedback(null);
    try {
      const response = await fetch('/api/admin/model-capabilities', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ modelKey: model.key, capabilities: value }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.config) throw new Error(body.error ?? 'MODEL_CAPABILITIES_UPDATE_FAILED');
      onSaved(body.config.capabilities, body.config.updatedAt);
      setFeedback({ tone: 'success', text: t('saved') });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'MODEL_CAPABILITIES_UPDATE_FAILED';
      setFeedback({ tone: 'error', text: t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.MODEL_CAPABILITIES_UPDATE_FAILED') });
    } finally { setSaving(false); }
  };

  return <section className="space-y-3 rounded-lg border border-[var(--studio-border-subtle)] bg-black/20 p-3 text-start">
    <p className="text-[11px] leading-relaxed text-[var(--studio-text-secondary)]">{t('description')}</p>
    {model.modality === 'chat' && (() => { const caps = value as ChatModelCapabilities; return <div className="grid gap-2 sm:grid-cols-2">
      <Toggle checked={caps.streaming} label={t('streaming')} onChange={(streaming) => patch({ streaming })} />
      <Toggle checked={caps.visionInput} label={t('visionInput')} onChange={(visionInput) => patch({ visionInput })} />
      <Toggle checked={caps.fileInput} label={t('fileInput')} onChange={(fileInput) => patch({ fileInput })} />
      <Toggle checked={caps.tools} label={t('tools')} onChange={(tools) => patch({ tools })} />
    </div>; })()}
    {model.modality === 'image' && (() => { const caps = value as ImageModelCapabilities; return <div className="grid gap-3 sm:grid-cols-2">
      <Toggle checked={caps.textToImage} label={t('textToImage')} onChange={(textToImage) => patch({ textToImage })} />
      <Toggle checked={caps.referenceImage} label={t('referenceImage')} onChange={(referenceImage) => patch({ referenceImage })} />
      <Toggle checked={caps.negativePrompt} label={t('negativePrompt')} onChange={(negativePrompt) => patch({ negativePrompt })} />
      <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('maxOutputs')}<select value={caps.maxOutputs} onChange={(event) => patch({ maxOutputs: Number(event.target.value) })} className="h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white">{[1, 2, 3, 4].map((count) => <option key={count}>{count}</option>)}</select></label>
      <div className="sm:col-span-2"><Choices label={t('aspectRatios')} options={MODEL_ASPECT_RATIOS} selected={caps.aspectRatios} onChange={(aspectRatios) => patch({ aspectRatios })} /></div>
    </div>; })()}
    {model.modality === 'video' && (() => { const caps = value as VideoModelCapabilities; return <div className="grid gap-3 sm:grid-cols-2">
      <Toggle checked={caps.textToVideo} label={t('textToVideo')} onChange={(textToVideo) => patch({ textToVideo })} />
      <Toggle checked={caps.imageToVideo} label={t('imageToVideo')} onChange={(imageToVideo) => patch({ imageToVideo })} />
      <Toggle checked={caps.generatedAudio} label={t('generatedAudio')} onChange={(generatedAudio) => patch({ generatedAudio })} />
      <Toggle checked={caps.negativePrompt} label={t('negativePrompt')} onChange={(negativePrompt) => patch({ negativePrompt })} />
      <div className="sm:col-span-2"><Choices label={t('durations')} options={MODEL_VIDEO_DURATIONS} selected={caps.durations} onChange={(durations) => patch({ durations })} format={(value) => `${value}s`} /></div>
      <div className="sm:col-span-2"><Choices label={t('aspectRatios')} options={MODEL_ASPECT_RATIOS} selected={caps.aspectRatios} onChange={(aspectRatios) => patch({ aspectRatios })} /></div>
      <div className="sm:col-span-2"><Choices label={t('cameraMotion')} options={MODEL_CAMERA_MOTIONS} selected={caps.cameraMotions} onChange={(cameraMotions) => patch({ cameraMotions })} format={(value) => t(`camera.${value}`)} /></div>
    </div>; })()}
    <div className="flex items-center justify-end gap-3">
      {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`me-auto text-[10.5px] ${feedback.tone === 'error' ? 'text-red-200' : 'text-emerald-200'}`}>{feedback.text}</p>}
      <button type="button" disabled={saving || !dirty} onClick={save} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-4 text-[12px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-45">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />}{saving ? t('saving') : t('save')}</button>
    </div>
  </section>;
}
