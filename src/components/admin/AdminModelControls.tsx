'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AdminModelRow } from '@/lib/admin/types';

type EditableModel = Pick<AdminModelRow,
  'key' | 'enabled' | 'priority' | 'creditPrice' | 'activationSupported'>;

export default function AdminModelControls({ model, onSaved }: {
  model: EditableModel;
  onSaved: (config: {
    modelKey: string;
    enabled: boolean;
    routingRole: AdminModelRow['priority'];
    customerCreditPrice: number | null;
    updatedAt: string;
  }) => void;
}) {
  const t = useTranslations('Admin.models');
  const [enabled, setEnabled] = useState(model.enabled);
  const [routingRole, setRoutingRole] = useState(model.priority);
  const [price, setPrice] = useState(model.creditPrice == null ? '' : String(model.creditPrice));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setEnabled(model.enabled);
    setRoutingRole(model.priority);
    setPrice(model.creditPrice == null ? '' : String(model.creditPrice));
    setFeedback(null);
  }, [model.key]);

  const normalizedPrice = useMemo(() => {
    const trimmed = price.trim();
    if (!trimmed) return null;
    if (!/^\d+$/.test(trimmed)) return undefined;
    const value = Number(trimmed);
    return Number.isSafeInteger(value) ? value : undefined;
  }, [price]);
  const dirty = enabled !== model.enabled
    || routingRole !== model.priority
    || normalizedPrice !== model.creditPrice;

  const save = async () => {
    if (normalizedPrice === undefined) {
      setFeedback({ tone: 'error', message: t('errors.invalidPrice') });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/admin/models', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          modelKey: model.key,
          enabled,
          routingRole: enabled ? routingRole : 'unassigned',
          customerCreditPrice: normalizedPrice,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.config) throw new Error(body.error ?? 'MODEL_CONFIG_UPDATE_FAILED');
      onSaved(body.config);
      setFeedback({ tone: 'success', message: t('saved') });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'MODEL_CONFIG_UPDATE_FAILED';
      setFeedback({
        tone: 'error',
        message: t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.MODEL_CONFIG_UPDATE_FAILED'),
      });
    } finally {
      setSaving(false);
    }
  };

  const controlClass = 'h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white outline-none focus-visible:border-[var(--studio-border-strong)] focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-45';

  return <div className="grid gap-3 rounded-lg border border-[var(--studio-border-subtle)] bg-black/20 p-3 text-start md:grid-cols-[minmax(150px,0.8fr)_minmax(170px,1fr)_minmax(200px,1fr)_auto] md:items-end">
    <label className="flex min-h-9 items-center gap-2.5 rounded-lg border border-[var(--studio-border)] px-3 text-[12px] font-semibold text-white">
      <input
        type="checkbox"
        checked={enabled}
        disabled={!model.activationSupported}
        onChange={(event) => {
          const nextEnabled = event.target.checked;
          setEnabled(nextEnabled);
          if (!nextEnabled) setRoutingRole('unassigned');
          setFeedback(null);
        }}
        className="h-4 w-4 accent-white"
      />
      {t('enabledLabel')}
    </label>
    <label className="grid gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">
      {t('routingRoleLabel')}
      <select
        value={routingRole}
        disabled={!enabled || !model.activationSupported}
        onChange={(event) => { setRoutingRole(event.target.value as AdminModelRow['priority']); setFeedback(null); }}
        className={controlClass}
      >
        <option value="primary">{t('rolePrimary')}</option>
        <option value="backup">{t('roleFallback')}</option>
        <option value="unassigned">{t('roleUnassigned')}</option>
      </select>
    </label>
    <label className="grid gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">
      {t('customerPriceLabel')}
      <input
        value={price}
        inputMode="numeric"
        placeholder={t('customerPricePlaceholder')}
        onChange={(event) => { setPrice(event.target.value); setFeedback(null); }}
        className={controlClass}
      />
    </label>
    <div className="flex min-w-32 flex-col items-stretch gap-1.5">
      <button
        type="button"
        disabled={saving || !dirty || normalizedPrice === undefined}
        onClick={save}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-4 text-[12px] font-semibold text-black transition-colors duration-150 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
      >
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {saving ? t('saving') : t('save')}
      </button>
      {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`text-[10.5px] ${feedback.tone === 'error' ? 'text-red-200' : 'text-emerald-200'}`}>{feedback.message}</p>}
    </div>
    {!model.activationSupported && <p className="md:col-span-4 text-[11px] text-amber-100/80">{t('activationUnavailable')}</p>}
    <p className="md:col-span-4 text-[11px] text-[var(--studio-text-muted)]">{t('priceHelper')}</p>
  </div>;
}
