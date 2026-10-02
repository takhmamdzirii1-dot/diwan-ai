'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import ConnectedActionReviews from './ConnectedActionReviews';

type AppView = { id: string; name: string; canConnect: boolean; authorization: 'reference' | 'oauth';
  requiresStore?: boolean;
  connection: { status: 'connected' | 'disconnected'; expiresAt: string | null; scopes: string[]; account?: { name: string; email?: string } } | null };

export default function ConnectedAppsPanel() {
  const t = useTranslations('studio.settings.connectedAppsPanel');
  const settings = useTranslations('studio.settings');
  const [apps, setApps] = useState<AppView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [stores, setStores] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    const outcome = new URLSearchParams(window.location.search).get('connected_app_result');
    if (outcome) {
      setFeedback(null);
      if (outcome !== 'connected') setError(true);
      const url = new URL(window.location.href); url.searchParams.delete('connected_app_result');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    fetch('/api/connected-apps', { cache: 'no-store' }).then(async (response) => {
      if (response.status === 401) { if (active) setSignedOut(true); return { apps: [] }; }
      if (!response.ok) throw new Error('load_failed');
      return response.json() as Promise<{ apps: AppView[] }>;
    }).then((result) => { if (active) {
      setApps(result.apps);
      const verified = result.apps.some(app => app.authorization === 'oauth' && app.connection?.status === 'connected' && app.connection.account);
      if (outcome === 'connected') { setFeedback(verified ? t('connectedFeedback') : null); setError(!verified); }
      else if (outcome !== 'failed') setError(false);
    } })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const changeConnection = async (app: AppView, connect: boolean) => {
    if (busy) return;
    setBusy(app.id); setFeedback(null); setError(false);
    try {
      if (connect && app.authorization === 'oauth') {
        const response = await fetch('/api/connected-apps/oauth/start', { method: 'POST',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appId: app.id,
            ...(app.requiresStore ? { shop: stores[app.id]?.trim() ?? '' } : {}) }) });
        if (!response.ok) throw new Error('authorization_failed');
        const result = await response.json() as { authorizationUrl: string };
        window.location.assign(result.authorizationUrl); return;
      }
      const response = await fetch('/api/connected-apps', { method: connect ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appId: app.id }) });
      if (!response.ok) throw new Error('change_failed');
      const result = await response.json() as { connection: AppView['connection']; revoked?: boolean };
      setApps((current) => current.map((item) => item.id === app.id ? { ...item, connection: result.connection } : item));
      setFeedback(connect ? t('connectedFeedback') : result.revoked === false ? t('disconnectedLocal') : t('disconnectedFeedback'));
    } catch { setError(true); }
    finally { setBusy(null); }
  };

  return <div className="space-y-4">
    <div>
      <h2 className="text-[16px] font-semibold tracking-tight text-[var(--studio-text-primary)]">{t('title')}</h2>
      <p className="mt-1 text-[12.5px] text-[var(--studio-text-secondary)]">{t('description')}</p>
    </div>
    {loading ? <p role="status" className="text-sm text-[var(--studio-text-secondary)]">{t('loading')}</p>
      : signedOut ? <p className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] p-4 text-sm text-[var(--studio-text-secondary)]">{t('signIn')}</p>
        : apps.length === 0 ? <p className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] p-4 text-sm text-[var(--studio-text-secondary)]">{t('empty')}</p>
        : apps.map((app) => {
          const connected = app.connection?.status === 'connected';
          const expired = connected && !!app.connection?.expiresAt && new Date(app.connection.expiresAt).getTime() <= Date.now();
          return <div key={app.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] p-4">
            <div><p className="text-sm font-medium text-[var(--studio-text-primary)]">{app.name}</p>
              {connected && app.connection?.account && <p dir="auto" className="text-xs text-[var(--studio-text-secondary)]">{app.connection.account.email ?? app.connection.account.name}</p>}
              <p className="mt-1 text-xs text-[var(--studio-text-secondary)]">{expired ? t('expired') : connected ? t('connected') : t('notConnected')}</p></div>
            {app.requiresStore && (!connected || expired) && <label className="flex min-w-0 flex-col gap-1 text-xs text-[var(--studio-text-secondary)]">
              {settings('connectedStoreDomain')}<input type="text" dir="ltr" value={stores[app.id] ?? ''} onChange={event => setStores(current => ({ ...current, [app.id]: event.target.value }))}
                placeholder={app.id === 'woocommerce' ? 'your-store.example' : 'your-store.myshopify.com'} autoComplete="off" maxLength={253}
                className="min-h-9 min-w-0 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[var(--studio-text-primary)]" />
            </label>}
            {app.canConnect && <button type="button" disabled={busy !== null}
              onClick={() => void changeConnection(app, !connected || expired)}
              className="min-h-9 rounded-lg border border-[var(--studio-border-strong)] px-3 text-xs font-medium text-[var(--studio-text-primary)] hover:bg-[var(--studio-hover)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
              {busy === app.id ? t('working') : connected && !expired ? t('disconnect') : t('connect')}
            </button>}
            {connected && (expired || !app.canConnect) && <button type="button" disabled={busy !== null} onClick={() => void changeConnection(app, false)}
              className="text-xs text-[var(--studio-text-secondary)] underline">{t('disconnect')}</button>}
          </div>;
        })}
    {feedback && <p role="status" className="text-xs text-[var(--studio-text-secondary)]">{feedback}</p>}
    {error && <p role="alert" className="text-xs text-[var(--studio-text-primary)]">{t('error')}</p>}
    <ConnectedActionReviews />
  </div>;
}
