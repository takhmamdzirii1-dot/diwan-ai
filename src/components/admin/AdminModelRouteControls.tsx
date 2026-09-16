'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AdminModelRoute } from '@/lib/admin/types';

function RouteControl({ route, onSaved }: {
  route: AdminModelRoute;
  onSaved: (route: Pick<AdminModelRoute, 'id' | 'enabled' | 'priority' | 'fallback'>) => void;
}) {
  const t = useTranslations('Admin.models');
  const [enabled, setEnabled] = useState(route.enabled);
  const [fallback, setFallback] = useState(route.fallback);
  const [priority, setPriority] = useState(String(route.priority));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  useEffect(() => {
    setEnabled(route.enabled); setFallback(route.fallback); setPriority(String(route.priority)); setFeedback(null);
  }, [route]);
  const parsedPriority = useMemo(() => /^\d+$/.test(priority) ? Number(priority) : NaN, [priority]);
  const valid = Number.isInteger(parsedPriority) && parsedPriority >= 0 && parsedPriority <= 10_000;
  const dirty = valid && (enabled !== route.enabled || fallback !== route.fallback || parsedPriority !== route.priority);
  const save = async () => {
    if (!valid) return;
    setSaving(true); setFeedback(null);
    try {
      const response = await fetch('/api/admin/model-routes', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ routeId: route.id, enabled, fallback, priority: parsedPriority }),
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
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_110px_auto] sm:items-end"><label className="flex h-9 items-center gap-2 rounded-lg border border-[var(--studio-border)] px-3 text-[11px] font-semibold text-white"><input type="checkbox" checked={enabled} disabled={!canEnable && !route.enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-4 w-4 accent-white" />{t('routeEnabled')}</label><label className="flex h-9 items-center gap-2 rounded-lg border border-[var(--studio-border)] px-3 text-[11px] font-semibold text-white"><input type="checkbox" checked={fallback} onChange={(event) => setFallback(event.target.checked)} className="h-4 w-4 accent-white" />{t('routeFallback')}</label><label className="grid gap-1 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('routePriority')}<input value={priority} inputMode="numeric" onChange={(event) => setPriority(event.target.value)} className="h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40" /></label><button type="button" disabled={saving || !dirty} onClick={save} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-3 text-[11.5px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-45">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{saving ? t('saving') : t('save')}</button></div>
    {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`mt-2 text-[10.5px] ${feedback.tone === 'error' ? 'text-red-200' : 'text-emerald-200'}`}>{feedback.text}</p>}
  </div>;
}

export default function AdminModelRouteControls({ routes, onSaved }: {
  routes: AdminModelRoute[];
  onSaved: (route: Pick<AdminModelRoute, 'id' | 'enabled' | 'priority' | 'fallback'>) => void;
}) {
  const t = useTranslations('Admin.models');
  return <section className="mt-3 text-start"><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--studio-text-muted)]">{t('providerRoutes')}</p>{routes.length ? <div className="grid gap-2 xl:grid-cols-2">{routes.map((route) => <RouteControl key={route.id} route={route} onSaved={onSaved} />)}</div> : <p className="text-[11px] text-[var(--studio-text-muted)]">{t('noProviderRoutes')}</p>}</section>;
}
