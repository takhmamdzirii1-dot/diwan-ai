'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AdminModelProviderOption, AdminModelRoute } from '@/lib/admin/types';

function RouteControl({ route, onSaved }: {
  route: AdminModelRoute;
  onSaved: (route: Pick<AdminModelRoute, 'id' | 'providerModelId' | 'enabled' | 'priority' | 'fallback'>) => void;
}) {
  const t = useTranslations('Admin.models');
  const [enabled, setEnabled] = useState(route.enabled);
  const [fallback, setFallback] = useState(route.fallback);
  const [priority, setPriority] = useState(String(route.priority));
  const [providerModelId, setProviderModelId] = useState(route.providerModelId);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  useEffect(() => {
    setEnabled(route.enabled); setFallback(route.fallback); setPriority(String(route.priority)); setProviderModelId(route.providerModelId); setFeedback(null);
  }, [route]);
  const parsedPriority = useMemo(() => /^\d+$/.test(priority) ? Number(priority) : NaN, [priority]);
  const valid = Number.isInteger(parsedPriority) && parsedPriority >= 0 && parsedPriority <= 10_000;
  const routeIdValid = providerModelId.trim().length > 0 && providerModelId.trim().length <= 300;
  const dirty = valid && routeIdValid && (enabled !== route.enabled || fallback !== route.fallback || parsedPriority !== route.priority || providerModelId.trim() !== route.providerModelId);
  const save = async () => {
    if (!valid) return;
    setSaving(true); setFeedback(null);
    try {
      const response = await fetch('/api/admin/model-routes', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ routeId: route.id, providerModelId: providerModelId.trim(), enabled, fallback, priority: parsedPriority }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.route) throw new Error(body.error ?? 'PROVIDER_ROUTE_UPDATE_FAILED');
      onSaved(body.route);
      setFeedback({ tone: 'success', text: t('routeSaved') });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'PROVIDER_ROUTE_UPDATE_FAILED';
      setFeedback({ tone: 'error', text: t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.PROVIDER_ROUTE_UPDATE_FAILED') });
    } finally { setSaving(false); }
  };
  const canEnable = route.configured && route.providerEnabled;
  return <div className="rounded-lg border border-[var(--studio-border-subtle)] bg-black/20 p-3">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-[12px] font-semibold text-white">{route.providerId}</p><p className="mt-0.5 break-all text-[10.5px] text-[var(--studio-text-muted)]">{route.providerModelId}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${canEnable ? 'border-emerald-300/20 text-emerald-100' : 'border-amber-300/20 text-amber-100'}`}>{canEnable ? t('routeReady') : t('routeUnavailable')}</span></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:items-end"><label className="grid gap-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('providerModelId')}<input value={providerModelId} disabled={route.enabled} onChange={(event) => setProviderModelId(event.target.value)} className="h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50" /></label><label className="flex h-9 items-center gap-2 self-end rounded-lg border border-[var(--studio-border)] px-3 text-[11px] font-semibold text-white"><input type="checkbox" checked={enabled} disabled={!canEnable && !route.enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-4 w-4 accent-white" />{t('routeEnabled')}</label><label className="flex h-9 items-center gap-2 self-end rounded-lg border border-[var(--studio-border)] px-3 text-[11px] font-semibold text-white"><input type="checkbox" checked={fallback} onChange={(event) => setFallback(event.target.checked)} className="h-4 w-4 accent-white" />{t('routeFallback')}</label><label className="grid gap-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('routePriority')}<input value={priority} inputMode="numeric" onChange={(event) => setPriority(event.target.value)} className="h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40" /></label><button type="button" disabled={saving || !dirty} onClick={save} className="inline-flex h-9 items-center justify-center gap-2 self-end rounded-lg bg-white px-3 text-[11.5px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-45">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{saving ? t('saving') : t('save')}</button></div>
    {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`mt-2 text-[10.5px] ${feedback.tone === 'error' ? 'text-red-200' : 'text-emerald-200'}`}>{feedback.text}</p>}
  </div>;
}

function AddRouteControl({ modelKey, providers, onCreated }: {
  modelKey: string;
  providers: AdminModelProviderOption[];
  onCreated: (route: AdminModelRoute) => void;
}) {
  const t = useTranslations('Admin.models');
  const [providerId, setProviderId] = useState(providers[0]?.id ?? '');
  const [providerModelId, setProviderModelId] = useState('');
  const [priority, setPriority] = useState('100');
  const [fallback, setFallback] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const parsedPriority = /^\d+$/.test(priority) ? Number(priority) : NaN;
  const valid = Boolean(providerId && providerModelId.trim())
    && Number.isInteger(parsedPriority) && parsedPriority >= 0 && parsedPriority <= 10_000;
  const create = async () => {
    if (!valid) return;
    setSaving(true); setFeedback(null);
    try {
      const response = await fetch('/api/admin/model-routes', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ modelKey, providerId, providerModelId: providerModelId.trim(), priority: parsedPriority, fallback }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.route) throw new Error(body.error ?? 'PROVIDER_ROUTE_CREATE_FAILED');
      onCreated(body.route); setProviderModelId(''); setFeedback({ tone: 'success', text: t('routeCreated') });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'PROVIDER_ROUTE_CREATE_FAILED';
      setFeedback({ tone: 'error', text: t.has(`errors.${code}`) ? t(`errors.${code}`) : t('routeCreateFailed') });
    } finally { setSaving(false); }
  };
  return <div className="mt-2 rounded-lg border border-dashed border-[var(--studio-border)] bg-black/10 p-3">
    <div className="grid gap-2 sm:grid-cols-2 sm:items-end">
      <label className="grid gap-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('provider')}<select value={providerId} onChange={(event) => setProviderId(event.target.value)} className="h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40">{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
      <label className="grid gap-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('providerModelId')}<input value={providerModelId} maxLength={300} onChange={(event) => setProviderModelId(event.target.value)} className="h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40" /></label>
      <label className="grid gap-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('routePriority')}<input value={priority} inputMode="numeric" onChange={(event) => setPriority(event.target.value)} className="h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40" /></label>
      <label className="flex h-9 items-center gap-2 self-end rounded-lg border border-[var(--studio-border)] px-3 text-[11px] font-semibold text-white"><input type="checkbox" checked={fallback} onChange={(event) => setFallback(event.target.checked)} className="h-4 w-4 accent-white" />{t('routeFallback')}</label>
      <button type="button" disabled={saving || !valid} onClick={create} className="inline-flex h-9 items-center justify-center gap-2 self-end rounded-lg border border-[var(--studio-border-strong)] px-3 text-[11.5px] font-semibold text-white hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}{saving ? t('creatingRoute') : t('addRoute')}</button>
    </div>
    {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`mt-2 text-[10.5px] ${feedback.tone === 'error' ? 'text-red-200' : 'text-emerald-200'}`}>{feedback.text}</p>}
    <p className="mt-2 text-[10.5px] text-[var(--studio-text-muted)]">{t('newRouteDisabled')}</p>
  </div>;
}

export default function AdminModelRouteControls({ modelKey, routes, providerOptions, onCreated, onSaved }: {
  modelKey: string;
  routes: AdminModelRoute[];
  providerOptions: AdminModelProviderOption[];
  onCreated: (route: AdminModelRoute) => void;
  onSaved: (route: Pick<AdminModelRoute, 'id' | 'providerModelId' | 'enabled' | 'priority' | 'fallback'>) => void;
}) {
  const t = useTranslations('Admin.models');
  return <section className="mt-3 text-start"><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--studio-text-muted)]">{t('providerRoutes')}</p>{routes.length ? <div className="grid gap-2">{routes.map((route) => <RouteControl key={route.id} route={route} onSaved={onSaved} />)}</div> : <p className="text-[11px] text-[var(--studio-text-muted)]">{t('noProviderRoutes')}</p>}<AddRouteControl modelKey={modelKey} providers={providerOptions} onCreated={onCreated} /></section>;
}
