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

export default function AdminProviderControls({ provider, onSaved, mode = 'identity' }: {
  provider: ProviderConfig;
  mode?: 'identity' | 'runtime';
  onSaved: (config: Omit<ProviderConfig, 'id' | 'name' | 'testSupported'> & { providerId: string; displayName: string }) => void;
}) {
  const t = useTranslations('Admin.providers');
  const router = useRouter();
  const [displayName, setDisplayName] = useState(provider.name);
  const [baseEndpoint, setBaseEndpoint] = useState(provider.baseEndpoint ?? '');
  const [enabled, setEnabled] = useState(provider.enabled);
  const [priority, setPriority] = useState(String(provider.priority));
  const [emergencyDisabled, setEmergencyDisabled] = useState(provider.emergencyDisabled);
  const [spendLimit, setSpendLimit] = useState(provider.dailySpendLimitMinor == null ? '' : (Number(provider.dailySpendLimitMinor) / 100).toFixed(2));
  const [currency, setCurrency] = useState(provider.spendCurrency ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmation, setConfirmation] = useState<string[] | null>(null);

  useEffect(() => {
    setEnabled(provider.enabled);
    setDisplayName(provider.name);
    setBaseEndpoint(provider.baseEndpoint ?? '');
    setPriority(String(provider.priority));
    setEmergencyDisabled(provider.emergencyDisabled);
    setSpendLimit(provider.dailySpendLimitMinor == null ? '' : (Number(provider.dailySpendLimitMinor) / 100).toFixed(2));
    setCurrency(provider.spendCurrency ?? '');
    setFeedback(null);
    setConfirmation(null);
  }, [provider]);

  const normalized = useMemo(() => {
    const parsedPriority = /^\d+$/.test(priority) ? Number(priority) : NaN;
    const parsedSpend = spendLimit.trim() === '' ? null
      : /^\d+(?:\.\d{1,2})?$/.test(spendLimit) ? Math.round(Number(spendLimit) * 100) : NaN;
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

  const save = async (confirmed = false) => {
    if (!normalized) { setFeedback({ tone: 'error', text: t('invalidConfig') }); return; }
    const changes = [
      mode === 'identity' && displayName.trim() !== provider.name ? `Name: ${provider.name} → ${displayName.trim()}` : null,
      mode === 'identity' && baseEndpoint.trim() !== (provider.baseEndpoint ?? '') ? 'HTTPS endpoint changed' : null,
      mode === 'runtime' && enabled !== provider.enabled ? `Routing: ${provider.enabled ? 'Enabled' : 'Disabled'} → ${enabled ? 'Enabled' : 'Disabled'}` : null,
      mode === 'runtime' && emergencyDisabled !== provider.emergencyDisabled ? `Emergency stop: ${provider.emergencyDisabled ? 'On' : 'Off'} → ${emergencyDisabled ? 'On' : 'Off'}` : null,
      mode === 'runtime' && normalized.priority !== provider.priority ? `Priority: ${provider.priority} → ${normalized.priority}` : null,
      mode === 'runtime' && String(normalized.dailySpendLimitMinor ?? '') !== (provider.dailySpendLimitMinor ?? '') ? `Daily limit: ${provider.dailySpendLimitMinor == null ? 'None' : `${(Number(provider.dailySpendLimitMinor) / 100).toFixed(2)} ${provider.spendCurrency}`} → ${normalized.dailySpendLimitMinor == null ? 'None' : `${(normalized.dailySpendLimitMinor / 100).toFixed(2)} ${normalized.spendCurrency}`}` : null,
    ].filter(Boolean);
    if (changes.length && !confirmed) { setConfirmation(changes as string[]); return; }
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/admin/providers', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ providerId: provider.id, displayName: mode === 'runtime' ? provider.name : displayName.trim(),
          adapterType: provider.adapterType, baseEndpoint: provider.adapterType === 'openai-compatible-chat' ? baseEndpoint.trim() || null : null,
          enabled: mode === 'identity' ? provider.enabled : enabled, emergencyDisabled: mode === 'identity' ? provider.emergencyDisabled : emergencyDisabled, ...(mode === 'identity' ? { priority: provider.priority, dailySpendLimitMinor: provider.dailySpendLimitMinor == null ? null : Number(provider.dailySpendLimitMinor), spendCurrency: provider.spendCurrency } : normalized) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.config) throw new Error(body.error ?? 'PROVIDER_CONFIG_UPDATE_FAILED');
      onSaved(body.config);
      router.refresh();
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
  const inputClass = 'h-10 min-w-0 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-[var(--studio-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)] disabled:cursor-not-allowed disabled:opacity-45';

  return <div className="mt-2 grid gap-3 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-card)] p-4 sm:grid-cols-2 sm:items-end">
    {mode === 'identity' && <><label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">Display name<input value={displayName} maxLength={80} onChange={(event) => setDisplayName(event.target.value)} className={inputClass} /></label>
    <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">Adapter<input value={provider.adapterType} readOnly className={inputClass} /></label>
    {provider.adapterType === 'openai-compatible-chat' && <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)] sm:col-span-2">HTTPS base endpoint<input value={baseEndpoint} maxLength={500} onChange={(event) => setBaseEndpoint(event.target.value)} className={inputClass} /></label>}</>}
    {mode === 'runtime' && <>
    <label title={t('routingHelp')} className="flex h-9 items-center gap-2 rounded-lg border border-[var(--studio-border)] px-3 text-[11.5px] font-semibold text-white"><input type="checkbox" checked={enabled} disabled={!provider.configured || provider.archived} onChange={(event) => { setEnabled(event.target.checked); setFeedback(null); }} className="h-4 w-4 accent-white" />{t('enabledControl')}</label>
    <label title={t('emergencyHelp')} className="flex h-9 items-center gap-2 rounded-lg border border-red-300/20 px-3 text-[11.5px] font-semibold text-red-100"><input type="checkbox" checked={emergencyDisabled} onChange={(event) => { setEmergencyDisabled(event.target.checked); setFeedback(null); }} className="h-4 w-4 accent-red-300" />{t('killSwitch')}</label>
    <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('priority')}<input value={priority} inputMode="numeric" onChange={(event) => { setPriority(event.target.value); setFeedback(null); }} className={inputClass} /></label>
    <label title={t('limitHelp')} className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">Daily limit ({currency || 'currency units'})<input value={spendLimit} inputMode="decimal" placeholder={t('noLimit')} onChange={(event) => { setSpendLimit(event.target.value); setFeedback(null); }} className={inputClass} /></label>
    <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('currency')}<input value={currency} maxLength={3} placeholder="USD" onChange={(event) => { setCurrency(event.target.value.toUpperCase()); setFeedback(null); }} className={inputClass} /></label>
    </>}
    <button type="button" disabled={saving || !dirty || !normalized} onClick={() => void save()} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-4 text-[12px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-45">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{saving ? t('saving') : t('save')}</button>
    {mode === 'identity' && provider.testSupported && <button type="button" disabled={saving || !provider.configured || provider.archived} onClick={() => action('PUT')} className="h-9 rounded-lg border border-[var(--studio-border)] px-3 text-[11.5px] font-semibold text-white disabled:opacity-45">Test connection</button>}
    {mode === 'identity' && <>
    <button type="button" disabled={saving || provider.archived} onClick={() => action('DELETE', 'archive')} className="h-9 rounded-lg border border-amber-300/25 px-3 text-[11.5px] font-semibold text-amber-100 disabled:opacity-45">Archive</button>
    <button type="button" disabled={saving} onClick={() => action('DELETE', 'delete')} className="h-9 rounded-lg border border-red-300/25 px-3 text-[11.5px] font-semibold text-red-100 disabled:opacity-45">Delete if unused</button></>}
    {!provider.configured && <p className="text-[11px] text-amber-100/80 sm:col-span-2">{t('credentialsMissing')}</p>}
    <p className="text-[10.5px] text-[var(--studio-text-muted)] sm:col-span-2">{t('spendHelp')}</p>
    {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`text-[11px] sm:col-span-2 ${feedback.tone === 'error' ? 'text-red-200' : 'text-emerald-200'}`}>{feedback.text}</p>}
    {confirmation && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--studio-overlay)] p-4"><div role="alertdialog" aria-modal="true" aria-label="Confirm provider change" className="w-full max-w-[460px] rounded-xl border border-[var(--studio-border)] bg-[var(--studio-card)] p-6 text-[var(--studio-text-primary)] shadow-[var(--studio-shadow)]"><h2 className="text-[18px] font-semibold">Confirm provider change</h2><p className="mt-2 text-[12px] text-[var(--studio-text-secondary)]">Changes affect future routing. Existing and completed jobs remain unchanged.</p><div className="mt-4 space-y-2 rounded-lg border border-[var(--studio-border)] p-3 text-[12px]">{confirmation.map((change) => <p key={change}>{change}</p>)}</div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfirmation(null)} className="h-10 rounded-lg border border-[var(--studio-border)] px-4 text-[12px]">Cancel</button><button type="button" disabled={saving} onClick={() => { setConfirmation(null); void save(true); }} className="h-10 rounded-lg bg-[var(--studio-accent)] px-4 text-[12px] font-semibold text-[var(--studio-accent-contrast)] disabled:opacity-45">Confirm Changes</button></div></div></div>}
  </div>;
}
