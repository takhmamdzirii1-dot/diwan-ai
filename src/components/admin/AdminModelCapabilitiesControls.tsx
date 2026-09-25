'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AdminModelRow } from '@/lib/admin/types';
import { CHAT_NATIVE_CAPABILITIES, resolveRouteCapabilities, type CapabilityOverride } from '@/lib/models/capability-v2';
import {
  MODEL_ASPECT_RATIOS,
  MODEL_CAMERA_MOTIONS,
  MODEL_VIDEO_DURATIONS,
  MODEL_VIDEO_GENERATION_MODES,
  MODEL_VIDEO_RESOLUTIONS,
  type ImageModelCapabilities,
  type ModelCapabilities,
  type VideoModelCapabilities,
} from '@/lib/models/capabilities';

const CHAT_CAPABILITY_LABELS = {
  streaming: 'Streaming', visionInput: 'Vision / image input', fileInput: 'Native file input',
  structuredOutput: 'Structured output', tools: 'Tool calling', parallelTools: 'Parallel tool calls',
} as const;

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
  model: Pick<AdminModelRow, 'key' | 'modality' | 'capabilities' | 'surfaceVisibility' | 'capabilitySourceType' | 'capabilityConfidence' | 'capabilitySyncStatus' | 'capabilitySyncError' | 'capabilityLastSyncedAt'> & Partial<Pick<AdminModelRow, 'routes' | 'routeCapabilitiesV2'>>;
  onSaved: (patch: Partial<AdminModelRow>) => void;
}) {
  const t = useTranslations('Admin.models.capabilities');
  const [value, setValue] = useState<ModelCapabilities>(model.capabilities);
  const [visibility, setVisibility] = useState(model.surfaceVisibility);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [syncDiagnostics, setSyncDiagnostics] = useState<{
    provider: string; route: string; backendModelId: string; canonicalLookupId: string;
    modelsDevMatch: boolean; providerMetadataMatch: boolean; finalSources: string[]; categories: string[];
  } | null>(null);
  const activeRoute = (model.routes ?? []).filter((route) => route.enabled && route.providerEnabled && route.configured)
    .sort((a, b) => a.priority - b.priority)[0];
  const routeCapabilities = activeRoute ? resolveRouteCapabilities({ route: activeRoute, stored: model.routeCapabilitiesV2 }).resolved : null;
  const sourceName = (source: string) => ({ provider_metadata: 'Provider route', models_dev: 'Models.dev', vantra_catalog: 'VANTRA Catalog', route_probe: 'Route verification', manual_override: 'Manual Override', unknown: 'No verified evidence' })[source as 'provider_metadata'] ?? 'No verified evidence';
  const routeSources = routeCapabilities ? [...new Set(Object.values(routeCapabilities).filter((item) => item.state !== 'unknown').map((item) => sourceName(item.source)))] : [];
  const setRouteOverride = async (capability: typeof CHAT_NATIVE_CAPABILITIES[number], override: CapabilityOverride) => {
    if (!activeRoute) return;
    setSaving(true); setFeedback(null);
    try {
      const response = await fetch('/api/admin/model-capabilities', { method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ modelKey: model.key, routeId: activeRoute.id, capability, override }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.config) throw new Error('Unable to save route override.');
      onSaved({ routeCapabilitiesV2: body.config.routeCapabilitiesV2 });
      setFeedback({ tone: 'success', text: 'Route override saved.' });
    } catch { setFeedback({ tone: 'error', text: 'Unable to save route override.' }); }
    finally { setSaving(false); }
  };
  useEffect(() => { setValue(model.capabilities); setVisibility(model.surfaceVisibility); setFeedback(null); }, [model]);
  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(model.capabilities)
    || JSON.stringify(visibility) !== JSON.stringify(model.surfaceVisibility),
    [value, model.capabilities, visibility, model.surfaceVisibility]);
  const patch = (next: Partial<ModelCapabilities>) => { setValue((current) => ({ ...current, ...next } as ModelCapabilities)); setFeedback(null); };

  const save = async () => {
    setSaving(true); setFeedback(null);
    try {
      const response = await fetch('/api/admin/model-capabilities', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ modelKey: model.key, capabilities: value, surfaceVisibility: visibility }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.config) throw new Error(body.error ?? 'MODEL_CAPABILITIES_UPDATE_FAILED');
      onSaved({ capabilities: body.config.capabilities, surfaceVisibility: body.config.surfaceVisibility,
        capabilitySourceType: body.config.sourceType, capabilityConfidence: body.config.confidence,
        capabilitySyncStatus: body.config.syncStatus,
        capabilitySyncError: body.config.syncStatus === 'ok' ? null : model.capabilitySyncError,
        updatedAt: body.config.updatedAt });
      setFeedback({ tone: 'success', text: t('saved') });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'MODEL_CAPABILITIES_UPDATE_FAILED';
      setFeedback({ tone: 'error', text: t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.MODEL_CAPABILITIES_UPDATE_FAILED') });
    } finally { setSaving(false); }
  };

  const syncNow = async (useDetected = false) => {
    setSyncing(true); setFeedback(null);
    try {
      const response = await fetch('/api/admin/model-capabilities', {
        method: useDetected ? 'DELETE' : 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ modelKey: model.key }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.config) throw new Error(body.error ?? 'MODEL_CAPABILITY_SYNC_FAILED');
      onSaved({ capabilities: body.config.capabilities,
        capabilitySourceType: body.config.sourceType, capabilityConfidence: body.config.confidence,
        capabilitySyncStatus: body.config.syncStatus, capabilitySyncError: body.config.syncError,
        capabilityLastSyncedAt: body.config.lastSyncedAt, updatedAt: body.config.updatedAt });
      if (body.config.routeCapabilitiesV2) onSaved({ routeCapabilitiesV2: body.config.routeCapabilitiesV2 });
      setSyncDiagnostics(body.config.diagnostics ?? null);
      setFeedback({ tone: body.config.syncStatus === 'failed' ? 'error' : 'success',
        text: body.config.syncError ?? 'Capability sync complete.' });
    } catch {
      setFeedback({ tone: 'error', text: 'Capability sync failed. Saved capabilities were preserved.' });
    } finally { setSyncing(false); }
  };

  return <section className="space-y-3 rounded-lg border border-[var(--studio-border-subtle)] bg-black/20 p-3 text-start">
    <p className="text-[11px] leading-relaxed text-[var(--studio-text-secondary)]">{t('description')}</p>
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--studio-border-subtle)] px-3 py-2 text-[11px] text-[var(--studio-text-secondary)]">
      <div><span className="font-semibold text-white">Capability status</span><p>Source: {routeSources.length ? routeSources.join(' + ') : model.capabilitySourceType === 'admin_override' ? 'Manual Override' : model.capabilitySourceType === 'provider_metadata' ? 'Provider Metadata' : model.capabilitySourceType === 'adapter_inferred' ? 'VANTRA Catalog' : 'No verified source yet'}</p><p>Verification: {model.capabilitySyncStatus === 'failed' ? 'Error' : routeSources.length ? 'Partial' : model.capabilityConfidence === 'verified' ? 'Verified' : model.capabilityConfidence === 'partial' ? 'Partial' : model.capabilityConfidence === 'manual' ? 'Manual override' : 'Unknown'}</p><p>Last checked: {model.capabilityLastSyncedAt ? new Date(model.capabilityLastSyncedAt).toLocaleString('en') : 'Never'}</p>{model.capabilitySyncError && <p className={model.capabilitySyncStatus === 'failed' ? 'text-amber-200' : 'text-white/65'}>{model.capabilitySyncError}</p>}</div>
      <div className="flex gap-2"><button type="button" onClick={() => void syncNow()} disabled={syncing || saving || dirty} className="h-8 rounded-lg border border-[var(--studio-border)] px-3 font-semibold text-white disabled:opacity-45">{syncing ? 'Syncing…' : 'Sync now'}</button>{model.modality !== 'chat' && model.capabilitySourceType === 'admin_override' && <button type="button" onClick={() => void syncNow(true)} disabled={syncing || saving || dirty} className="h-8 rounded-lg border border-[var(--studio-border)] px-3 font-semibold text-white disabled:opacity-45">Use detected</button>}</div>
    </div>
    {model.modality === 'chat' && <div className="space-y-3 rounded-lg border border-[var(--studio-border-subtle)] p-3 text-xs text-white/75">
      <div><h3 className="font-semibold text-white">Model capabilities · active route</h3><p className="mt-1">{activeRoute ? `${activeRoute.providerId} / ${activeRoute.providerModelId}` : 'No active configured route'}</p></div>
      <div className="grid gap-1.5 sm:grid-cols-2">{CHAT_NATIVE_CAPABILITIES.map((key) => {
        const state = routeCapabilities?.[key];
        const label = CHAT_CAPABILITY_LABELS[key];
        return <div key={key} className="flex items-center justify-between gap-2 rounded-md border border-white/10 px-2.5 py-2"><span>{label}</span><span className="text-end text-white">{state?.state === 'supported' ? 'Supported' : state?.state === 'unsupported' ? 'Unsupported' : 'Unknown'}<span className="block text-[10px] font-normal text-white/50">Source: {sourceName(state?.source ?? 'unknown')}</span></span></div>;
      })}</div>
      <div><h3 className="font-semibold text-white">VANTRA capabilities</h3><p className="mt-1">Document upload: unavailable · Document extraction: unavailable · File generation/export: available in browser</p></div>
      <details className="rounded-md border border-white/10 p-2.5"><summary className="cursor-pointer font-semibold text-white">Advanced overrides and technical details</summary>
        <p className="my-2">Provider: {activeRoute?.providerId ?? 'None'} · Backend model: {activeRoute?.providerModelId ?? 'None'}. Sync refreshes available metadata; no live probe runs automatically.</p>
        {syncDiagnostics && activeRoute?.id === syncDiagnostics.route && <div className="my-2 space-y-1 rounded-md border border-white/10 p-2 text-[11px] text-white/65">
          <p>Provider: {syncDiagnostics.provider} · Route: {syncDiagnostics.route}</p>
          <p>Backend model ID: {syncDiagnostics.backendModelId} · Canonical lookup ID: {syncDiagnostics.canonicalLookupId}</p>
          <p>Models.dev match: {syncDiagnostics.modelsDevMatch ? 'Yes' : 'No'} · Provider metadata match: {syncDiagnostics.providerMetadataMatch ? 'Yes' : 'No'}</p>
          <p>Final source: {syncDiagnostics.finalSources.length ? syncDiagnostics.finalSources.map(sourceName).join(' + ') : 'Unknown'}</p>
          <p>Sync details: {syncDiagnostics.categories.join(', ')}</p>
        </div>}
        {model.capabilitySourceType === 'admin_override' && <button type="button" onClick={() => void syncNow(true)} disabled={syncing || saving || dirty} className="my-2 rounded-md border border-white/15 px-2.5 py-1.5 text-white disabled:opacity-45">Clear legacy model override</button>}
        {activeRoute && CHAT_NATIVE_CAPABILITIES.map((key) => <label key={key} className="flex items-center justify-between gap-3 py-1.5"><span>{CHAT_CAPABILITY_LABELS[key]}</span><select value={routeCapabilities?.[key].override ?? 'auto'} disabled={saving} onChange={(event) => void setRouteOverride(key, event.target.value as CapabilityOverride)} className="rounded-md border border-white/15 bg-neutral-950 px-2 py-1 text-white"><option value="auto">Auto</option><option value="force_enabled">Force enabled</option><option value="force_disabled">Force disabled</option></select></label>)}
      </details>
    </div>}
    {model.modality === 'image' && (() => { const caps = value as ImageModelCapabilities; return <div className="grid gap-3 sm:grid-cols-2">
      <Toggle checked={caps.textToImage} label={t('textToImage')} onChange={(textToImage) => patch({ textToImage })} />
      <Toggle checked={caps.referenceImage} label={t('referenceImage')} onChange={(referenceImage) => patch({ referenceImage })} />
      <Toggle checked={caps.negativePrompt} label={t('negativePrompt')} onChange={(negativePrompt) => patch({ negativePrompt })} />
      <Toggle checked={Boolean(caps.editing)} label="Editing" onChange={(editing) => patch({ editing })} />
      <Toggle checked={Boolean(caps.inpainting)} label="Inpainting" onChange={(inpainting) => patch({ inpainting })} />
      <Toggle checked={Boolean(caps.seed)} label="Seed" onChange={(seed) => patch({ seed })} />
      <Toggle checked={Boolean(caps.upscale)} label="Upscale" onChange={(upscale) => patch({ upscale })} />
      <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('maxOutputs')}<select value={caps.maxOutputs} onChange={(event) => patch({ maxOutputs: Number(event.target.value) })} className="h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white">{[1, 2, 3, 4].map((count) => <option key={count}>{count}</option>)}</select></label>
      <div className="sm:col-span-2"><Choices label={t('aspectRatios')} options={MODEL_ASPECT_RATIOS} selected={caps.aspectRatios} onChange={(aspectRatios) => patch({ aspectRatios })} /></div>
    </div>; })()}
    {model.modality === 'video' && (() => { const caps = value as VideoModelCapabilities; return <div className="grid gap-3 sm:grid-cols-2">
      <Toggle checked={caps.textToVideo} label={t('textToVideo')} onChange={(textToVideo) => patch({ textToVideo })} />
      <Toggle checked={caps.imageToVideo} label={t('imageToVideo')} onChange={(imageToVideo) => patch({ imageToVideo })} />
      <Toggle checked={Boolean(caps.videoToVideo)} label="Video to video" onChange={(videoToVideo) => patch({ videoToVideo })} />
      <Toggle checked={Boolean(caps.endImage)} label="End image" onChange={(endImage) => patch({ endImage })} />
      <Toggle checked={caps.generatedAudio} label={t('generatedAudio')} onChange={(generatedAudio) => patch({ generatedAudio })} />
      <Toggle checked={caps.negativePrompt} label={t('negativePrompt')} onChange={(negativePrompt) => patch({ negativePrompt })} />
      <div className="sm:col-span-2"><Choices label={t('durations')} options={MODEL_VIDEO_DURATIONS} selected={caps.durations} onChange={(durations) => patch({ durations })} format={(value) => `${value}s`} /></div>
      <div className="sm:col-span-2"><Choices label={t('aspectRatios')} options={MODEL_ASPECT_RATIOS} selected={caps.aspectRatios} onChange={(aspectRatios) => patch({ aspectRatios })} /></div>
      <div className="sm:col-span-2"><Choices label="Text to video resolutions" options={MODEL_VIDEO_RESOLUTIONS} selected={caps.resolutions ?? []} onChange={(resolutions) => patch({ resolutions })} /></div>
      <div className="sm:col-span-2"><Choices label="Text to video modes" options={MODEL_VIDEO_GENERATION_MODES} selected={caps.generationModes ?? []} onChange={(generationModes) => patch({ generationModes })} /></div>
      <div className="sm:col-span-2"><Choices label="Image to video aspect ratios" options={MODEL_ASPECT_RATIOS} selected={caps.imageToVideoAspectRatios ?? []} onChange={(imageToVideoAspectRatios) => patch({ imageToVideoAspectRatios })} /></div>
      <div className="sm:col-span-2"><Choices label="Image to video resolutions" options={MODEL_VIDEO_RESOLUTIONS} selected={caps.imageToVideoResolutions ?? []} onChange={(imageToVideoResolutions) => patch({ imageToVideoResolutions })} /></div>
      <div className="sm:col-span-2"><Choices label="Image to video modes" options={MODEL_VIDEO_GENERATION_MODES} selected={caps.imageToVideoGenerationModes ?? []} onChange={(imageToVideoGenerationModes) => patch({ imageToVideoGenerationModes })} /></div>
      <div className="sm:col-span-2"><Choices label={t('cameraMotion')} options={MODEL_CAMERA_MOTIONS} selected={caps.cameraMotions} onChange={(cameraMotions) => patch({ cameraMotions })} format={(value) => t(`camera.${value}`)} /></div>
    </div>; })()}
    <fieldset className="space-y-2 rounded-lg border border-[var(--studio-border-subtle)] p-3"><legend className="px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--studio-text-muted)]">Studio visibility · independent of plan access</legend>
      <div className="grid gap-2 sm:grid-cols-2">{(model.modality === 'video'
        ? [['video', 'Show in Video'], ['textToVideo', 'Show in Text to Video'], ['imageToVideo', 'Show in Image to Video'], ['videoToVideo', 'Show in Video to Video']]
        : model.modality === 'image' ? [['image', 'Show in Image']] : [['chat', 'Show in Chat']]
      ).map(([key, label]) => <Toggle key={key} checked={visibility[key as keyof typeof visibility]} label={label} onChange={(checked) => setVisibility((current) => ({ ...current, [key]: checked }))} />)}</div>
    </fieldset>
    <div className="flex items-center justify-end gap-3">
      {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`me-auto text-[10.5px] ${feedback.tone === 'error' ? 'text-red-200' : 'text-emerald-200'}`}>{feedback.text}</p>}
      <button type="button" disabled={saving || !dirty} onClick={save} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-4 text-[12px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-45">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />}{saving ? t('saving') : t('save')}</button>
    </div>
  </section>;
}
