'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { AdminProviderRow } from '@/lib/admin/types';

type ProviderConfig = Pick<AdminProviderRow,
  'id' | 'name' | 'adapterType' | 'baseEndpoint' | 'archived' | 'testSupported'
  | 'enabled' | 'configured' | 'priority' | 'emergencyDisabled'
  | 'dailySpendLimitMinor' | 'spendCurrency'>;

export default function AdminProviderControls({ provider, onSaved }: {
  provider: ProviderConfig;
  onSaved: (config: Omit<ProviderConfig, 'id' | 'name' | 'testSupported'> & { providerId: string; displayName: string }) => void;
}) {
  const t = useTranslations('Admin.providers');
  const router = useRouter();
  const [displayName, setDisplayName] = useState(provider.name);
  const [baseEndpoint, setBaseEndpoint] = useState(provider.baseEndpoint ?? '');
  const [enabled, setEnabled] = useState(provider.enabled);
  const [priority, setPriority] = useState(String(provider.priority));
  const [emergencyDisabled, setEmergencyDisabled] = useState(provider.emergencyDisabled);
  const [spendLimit, setSpendLimit] = useState(provider.dailySpendLimitMinor ?? '');
  const [currency, setCurrency] = useState(provider.spendCurrency ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setEnabled(provider.enabled);
    setDisplayName(provider.name);
    setBaseEndpoint(provider.baseEndpoint ?? '');
    setPriority(String(provider.priority));
    setEmergencyDisabled(provider.emergencyDisabled);
    setSpendLimit(provider.dailySpendLimitMinor ?? '');
    setCurrency(provider.spendCurrency ?? '');
    setFeedback(null);
  }, [provider]);

  const normalized = useMemo(() => {
    const parsedPriority = /^\d+$/.test(priority) ? Number(priority) : NaN;
    const parsedSpend = spendLimit.trim() === '' ? null
      : /^\d+$/.test(spendLimit) ? Number(spendLimit) : NaN;
    const parsedCurrency = currency.trim() === '' ? null : currency.trim().toUpperCase();
    if (!Number.isInteger(parsedPriority) || parsedPriority < 0 || parsedPriority > 10_000) return null;
    if (parsedSpend !== null && (!Number.isSafeInteger(parsedSpend) || parsedSpend < 0)) return null;
    if ((parsedSpend === null) !== (parsedCurrency === null)) return null;
    if (parsedCurrency !== null && !/^[A-Z]{3}$/.test(parsedCurrency)) return null;
    return { priority: parsedPriority, dailySpendLimitMinor: parsedSpend, spendCurrency: parsedCurrency };
  }, [currency, priority, spendLimit]);
  const dirty = normalized != null && (
    displayName.trim() !== provider.name || baseEndpoint.trim() !== (provider.baseEndpoint ?? '')
    || enabled !== provider.enabled || emergencyDisabled !== provider.emergencyDisabled
    || normalized.priority !== provider.priority
    || String(normalized.dailySpendLimitMinor ?? '') !== (provider.dailySpendLimitMinor ?? '')
    || normalized.spendCurrency !== provider.spendCurrency
  );

  const save = async () => {
    if (!normalized) { setFeedback({ tone: 'error', text: t('invalidConfig') }); return; }
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/admin/providers', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ providerId: provider.id, displayName: displayName.trim(),
          adapterType: provider.adapterType, baseEndpoint: provider.adapterType === 'openai-compatible-chat' ? baseEndpoint.trim() || null : null,
          enabled, emergencyDisabled, ...normalized }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.config) throw new Error(body.error ?? 'PROVIDER_CONFIG_UPDATE_FAILED');
      onSaved(body.config);
      setFeedback({ tone: 'success', text: t('saved') });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'PROVIDER_CONFIG_UPDATE_FAILED';
      setFeedback({ tone: 'error', text: t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.PROVIDER_CONFIG_UPDATE_FAILED') });
    } finally {
      setSaving(false);
    }
  };
  const action = async (method: 'PUT' | 'DELETE', lifecycle?: 'archive' | 'delete') => {
    setSaving(true); setFeedback(null);
    try {
      const response = await fetch('/api/admin/providers', {
        method, headers: { 'content-type': 'application/json' },
        body: JSON.stringify(lifecycle ? { providerId: provider.id, action: lifecycle } : { providerId: provider.id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'PROVIDER_CONFIG_UPDATE_FAILED');
      setFeedback({ tone: 'success', text: method === 'PUT' ? 'Connection is ready.' : `Provider ${lifecycle}d.` });
      if (method === 'DELETE') router.refresh();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'PROVIDER_CONFIG_UPDATE_FAILED';
      const text = ({
        PROVIDER_REFERENCED_ARCHIVE_REQUIRED: 'This provider has routes or history. Archive it instead.',
        PROVIDER_CODE_REGISTERED_ARCHIVE_REQUIRED: 'Built-in providers cannot be deleted. Archive it instead.',
        PROVIDER_TEST_FAILED: 'The non-billable connection test failed.',
        PROVIDER_ENDPOINT_UNSAFE: 'The endpoint is not a public HTTPS destination.',
      } as Record<string, string>)[code] ?? code;
      setFeedback({ tone: 'error', text });
    } finally { setSaving(false); }
  };
  const inputClass = 'h-9 min-w-0 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-45';

  return <div className="mt-2 grid gap-2.5 rounded-lg border border-[var(--studio-border-subtle)] bg-black/20 p-3 sm:grid-cols-2 sm:items-end">
    <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">Display name<input value={displayName} maxLength={80} onChange={(event) => setDisplayName(event.target.value)} className={inputClass} /></label>
    <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">Adapter<input value={provider.adapterType} readOnly className={inputClass} /></label>
    {provider.adapterType === 'openai-compatible-chat' && <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)] sm:col-span-2">HTTPS base endpoint<input value={baseEndpoint} maxLength={500} onChange={(event) => setBaseEndpoint(event.target.value)} className={inputClass} /></label>}
    <label title={t('routingHelp')} className="flex h-9 items-center gap-2 rounded-lg border border-[var(--studio-border)] px-3 text-[11.5px] font-semibold text-white"><input type="checkbox" checked={enabled} disabled={!provider.configured || provider.archived} onChange={(event) => { setEnabled(event.target.checked); setFeedback(null); }} className="h-4 w-4 accent-white" />{t('enabledControl')}</label>
    <label title={t('emergencyHelp')} className="flex h-9 items-center gap-2 rounded-lg border border-red-300/20 px-3 text-[11.5px] font-semibold text-red-100"><input type="checkbox" checked={emergencyDisabled} onChange={(event) => { setEmergencyDisabled(event.target.checked); setFeedback(null); }} className="h-4 w-4 accent-red-300" />{t('killSwitch')}</label>
    <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('priority')}<input value={priority} inputMode="numeric" onChange={(event) => { setPriority(event.target.value); setFeedback(null); }} className={inputClass} /></label>
    <label title={t('limitHelp')} className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('spendLimit')}<input value={spendLimit} inputMode="numeric" placeholder={t('noLimit')} onChange={(event) => { setSpendLimit(event.target.value); setFeedback(null); }} className={inputClass} /></label>
    <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('currency')}<input value={currency} maxLength={3} placeholder="USD" onChange={(event) => { setCurrency(event.target.value.toUpperCase()); setFeedback(null); }} className={inputClass} /></label>
    <button type="button" disabled={saving || !dirty || !normalized} onClick={save} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-4 text-[12px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-45">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{saving ? t('saving') : t('save')}</button>
    {provider.testSupported && <button type="button" disabled={saving || !provider.configured || provider.archived} onClick={() => action('PUT')} className="h-9 rounded-lg border border-[var(--studio-border)] px-3 text-[11.5px] font-semibold text-white disabled:opacity-45">Test connection</button>}
    <button type="button" disabled={saving || provider.archived} onClick={() => action('DELETE', 'archive')} className="h-9 rounded-lg border border-amber-300/25 px-3 text-[11.5px] font-semibold text-amber-100 disabled:opacity-45">Archive</button>
    <button type="button" disabled={saving} onClick={() => action('DELETE', 'delete')} className="h-9 rounded-lg border border-red-300/25 px-3 text-[11.5px] font-semibold text-red-100 disabled:opacity-45">Delete if unused</button>
    {!provider.configured && <p className="text-[11px] text-amber-100/80 sm:col-span-2">{t('credentialsMissing')}</p>}
    <p className="text-[10.5px] text-[var(--studio-text-muted)] sm:col-span-2">{t('spendHelp')}</p>
    {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`text-[11px] sm:col-span-2 ${feedback.tone === 'error' ? 'text-red-200' : 'text-emerald-200'}`}>{feedback.text}</p>}
  </div>;
}
