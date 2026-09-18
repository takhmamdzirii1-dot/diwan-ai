'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AdminModelRow } from '@/lib/admin/types';

type Presentation = Pick<AdminModelRow,
  'key' | 'displayName' | 'shortDescription' | 'mediaUrl' | 'category' |
  'sortOrder' | 'visibleInStudio' | 'availabilityLabel'>;

export default function AdminModelPresentationControls({ model, onSaved }: {
  model: Presentation;
  onSaved: (presentation: Presentation & { updatedAt: string }) => void;
}) {
  const t = useTranslations('Admin.models');
  const [displayName, setDisplayName] = useState(model.displayName);
  const [description, setDescription] = useState(model.shortDescription ?? '');
  const [mediaUrl, setMediaUrl] = useState(model.mediaUrl ?? '');
  const [category, setCategory] = useState(model.category ?? '');
  const [sortOrder, setSortOrder] = useState(String(model.sortOrder));
  const [visible, setVisible] = useState(model.visibleInStudio);
  const [availabilityLabel, setAvailabilityLabel] = useState(model.availabilityLabel ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setDisplayName(model.displayName); setDescription(model.shortDescription ?? '');
    setMediaUrl(model.mediaUrl ?? ''); setCategory(model.category ?? '');
    setSortOrder(String(model.sortOrder)); setVisible(model.visibleInStudio);
    setAvailabilityLabel(model.availabilityLabel ?? ''); setFeedback(null);
  }, [model]);

  const parsedSortOrder = useMemo(() => /^\d+$/.test(sortOrder) ? Number(sortOrder) : NaN, [sortOrder]);
  const valid = displayName.trim().length > 0 && displayName.trim().length <= 80
    && Number.isInteger(parsedSortOrder) && parsedSortOrder >= 0 && parsedSortOrder <= 10_000;
  const dirty = displayName.trim() !== model.displayName
    || description.trim() !== (model.shortDescription ?? '')
    || mediaUrl.trim() !== (model.mediaUrl ?? '')
    || category.trim() !== (model.category ?? '')
    || parsedSortOrder !== model.sortOrder
    || visible !== model.visibleInStudio
    || availabilityLabel.trim() !== (model.availabilityLabel ?? '');

  const save = async () => {
    if (!valid) { setFeedback({ tone: 'error', text: t('presentationInvalid') }); return; }
    setSaving(true); setFeedback(null);
    try {
      const response = await fetch('/api/admin/model-presentation', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          modelKey: model.key, displayName: displayName.trim(), shortDescription: description.trim(),
          mediaUrl: mediaUrl.trim(), category: category.trim(), sortOrder: parsedSortOrder,
          visibleInStudio: visible, availabilityLabel: availabilityLabel.trim(),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.presentation) throw new Error(body.error ?? 'MODEL_PRESENTATION_UPDATE_FAILED');
      onSaved({ key: model.key, ...body.presentation });
      setFeedback({ tone: 'success', text: t('presentationSaved') });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'MODEL_PRESENTATION_UPDATE_FAILED';
      setFeedback({ tone: 'error', text: t.has(`errors.${code}`) ? t(`errors.${code}`) : t('presentationFailed') });
    } finally { setSaving(false); }
  };

  const inputClass = 'h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white outline-none placeholder:text-[var(--studio-text-muted)] focus-visible:ring-2 focus-visible:ring-white/40';
  const labelClass = 'grid gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]';
  return <section className="mt-3 rounded-lg border border-[var(--studio-border-subtle)] bg-black/20 p-3 text-start">
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--studio-text-muted)]">{t('customerPresentation')}</p>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <label className={labelClass}>{t('displayName')}<input value={displayName} maxLength={80} onChange={(event) => { setDisplayName(event.target.value); setFeedback(null); }} className={inputClass} /></label>
      <label className={labelClass}>{t('category')}<input value={category} maxLength={60} onChange={(event) => { setCategory(event.target.value); setFeedback(null); }} placeholder={t('categoryPlaceholder')} className={inputClass} /></label>
      <label className={labelClass}>{t('sortOrder')}<input value={sortOrder} inputMode="numeric" onChange={(event) => { setSortOrder(event.target.value); setFeedback(null); }} className={inputClass} /></label>
      <label className={`${labelClass} md:col-span-2`}>{t('shortDescription')}<input value={description} maxLength={240} onChange={(event) => { setDescription(event.target.value); setFeedback(null); }} className={inputClass} /></label>
      <label className={labelClass}>{t('availabilityLabel')}<input value={availabilityLabel} maxLength={60} onChange={(event) => { setAvailabilityLabel(event.target.value); setFeedback(null); }} className={inputClass} /></label>
      <label className={`${labelClass} md:col-span-2`}>{t('mediaUrl')}<input value={mediaUrl} maxLength={500} onChange={(event) => { setMediaUrl(event.target.value); setFeedback(null); }} placeholder="/brand/model.svg or https://…" className={inputClass} /></label>
      <label className="flex h-9 items-center gap-2.5 self-end rounded-lg border border-[var(--studio-border)] px-3 text-[12px] font-semibold text-white"><input type="checkbox" checked={visible} onChange={(event) => { setVisible(event.target.checked); setFeedback(null); }} className="h-4 w-4 accent-white" />{t('visibleInStudio')}</label>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
      {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`me-auto text-[10.5px] ${feedback.tone === 'error' ? 'text-red-200' : 'text-emerald-200'}`}>{feedback.text}</p>}
      <button type="button" disabled={saving || !dirty || !valid} onClick={save} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-4 text-[12px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-45">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{saving ? t('saving') : t('savePresentation')}</button>
    </div>
  </section>;
}
