'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AdminProviderRow } from '@/lib/admin/types';

type ProviderConfig = Pick<AdminProviderRow,
  'id' | 'enabled' | 'configured' | 'priority' | 'emergencyDisabled'
  | 'dailySpendLimitMinor' | 'spendCurrency'>;

export default function AdminProviderControls({ provider, onSaved }: {
  provider: ProviderConfig;
  onSaved: (config: Omit<ProviderConfig, 'id'> & { providerId: string }) => void;
}) {
  const t = useTranslations('Admin.providers');
  const [enabled, setEnabled] = useState(provider.enabled);
  const [priority, setPriority] = useState(String(provider.priority));
  const [emergencyDisabled, setEmergencyDisabled] = useState(provider.emergencyDisabled);
  const [spendLimit, setSpendLimit] = useState(provider.dailySpendLimitMinor ?? '');
  const [currency, setCurrency] = useState(provider.spendCurrency ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setEnabled(provider.enabled);
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
    enabled !== provider.enabled || emergencyDisabled !== provider.emergencyDisabled
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
        body: JSON.stringify({ providerId: provider.id, enabled, emergencyDisabled, ...normalized }),
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
  const inputClass = 'h-9 min-w-0 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-45';

  return <div className="mt-2 grid gap-2.5 rounded-lg border border-[var(--studio-border-subtle)] bg-black/20 p-3 sm:grid-cols-2 sm:items-end">
    <label title={t('routingHelp')} className="flex h-9 items-center gap-2 rounded-lg border border-[var(--studio-border)] px-3 text-[11.5px] font-semibold text-white"><input type="checkbox" checked={enabled} disabled={!provider.configured} onChange={(event) => { setEnabled(event.target.checked); setFeedback(null); }} className="h-4 w-4 accent-white" />{t('enabledControl')}</label>
    <label title={t('emergencyHelp')} className="flex h-9 items-center gap-2 rounded-lg border border-red-300/20 px-3 text-[11.5px] font-semibold text-red-100"><input type="checkbox" checked={emergencyDisabled} onChange={(event) => { setEmergencyDisabled(event.target.checked); setFeedback(null); }} className="h-4 w-4 accent-red-300" />{t('killSwitch')}</label>
    <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('priority')}<input value={priority} inputMode="numeric" onChange={(event) => { setPriority(event.target.value); setFeedback(null); }} className={inputClass} /></label>
    <label title={t('limitHelp')} className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('spendLimit')}<input value={spendLimit} inputMode="numeric" placeholder={t('noLimit')} onChange={(event) => { setSpendLimit(event.target.value); setFeedback(null); }} className={inputClass} /></label>
    <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('currency')}<input value={currency} maxLength={3} placeholder="USD" onChange={(event) => { setCurrency(event.target.value.toUpperCase()); setFeedback(null); }} className={inputClass} /></label>
    <button type="button" disabled={saving || !dirty || !normalized} onClick={save} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-4 text-[12px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-45">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{saving ? t('saving') : t('save')}</button>
    {!provider.configured && <p className="text-[11px] text-amber-100/80 sm:col-span-2">{t('credentialsMissing')}</p>}
    <p className="text-[10.5px] text-[var(--studio-text-muted)] sm:col-span-2">{t('spendHelp')}</p>
    {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`text-[11px] sm:col-span-2 ${feedback.tone === 'error' ? 'text-red-200' : 'text-emerald-200'}`}>{feedback.text}</p>}
  </div>;
}
