'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MODEL_BRANDS } from '@/src/config/model-catalog';

export default function AdminModelCreate({ initial }: { initial?: { displayName: string; modality: 'chat' | 'image' | 'video' } }) {
  const t = useTranslations('Admin.models.create');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stableId, setStableId] = useState('');
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [modality, setModality] = useState<'chat' | 'image' | 'video'>(initial?.modality ?? 'chat');
  const [brand, setBrand] = useState('');
  const [backendId, setBackendId] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const valid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stableId.trim()) && displayName.trim().length > 0 && brand.trim().length <= 60
    && backendId.trim().length > 0 && backendId.trim().length <= 240 && !/\s/.test(backendId.trim());
  const create = async () => {
    if (!valid) return;
    setSaving(true); setFeedback(null);
    try {
      const response = await fetch('/api/admin/models', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stableId: stableId.trim(), modelId: backendId.trim(), displayName: displayName.trim(), modality, brand: brand.trim() || undefined }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.model) throw new Error(body.error ?? 'MODEL_CREATE_FAILED');
      setStableId(''); setDisplayName(''); setBrand(''); setBackendId(''); setFeedback({ tone: 'success', text: t('created') });
      router.refresh();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'MODEL_CREATE_FAILED';
      setFeedback({ tone: 'error', text: t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.MODEL_CREATE_FAILED') });
    } finally { setSaving(false); }
  };
  return <div className="relative">
    <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-[12px] font-semibold text-black hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white/40"><Plus className="h-4 w-4" />{initial ? 'Configure model' : t('action')}</button>
    {open && <div className="absolute end-0 top-11 z-30 grid w-[min(600px,calc(100vw-2rem))] gap-2 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] p-4 shadow-xl sm:grid-cols-3 sm:items-end">
      <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('stableId')}<input value={stableId} onChange={(event) => setStableId(event.target.value.toLowerCase())} placeholder="my-model" className="h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white" /></label>
      <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('displayName')}<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white" /></label>
      <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('modality')}<select value={modality} onChange={(event) => setModality(event.target.value as typeof modality)} className="h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white"><option value="chat">Chat</option><option value="image">Image</option><option value="video">Video</option></select></label>
      <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('brand')}<input value={brand} maxLength={60} list="vantra-model-brand-create-list" autoComplete="off" onChange={(event) => setBrand(event.target.value)} placeholder="Optional" className="h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white" /><datalist id="vantra-model-brand-create-list">{[...new Set(Object.values(MODEL_BRANDS).map((item) => item.name))].sort().map((name) => <option key={name} value={name} />)}</datalist></label>
      <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)] sm:col-span-2">{t('backendModelId')}<input value={backendId} maxLength={240} autoComplete="off" spellCheck={false} onChange={(event) => setBackendId(event.target.value)} placeholder="agnes-3.0-flash" className="h-9 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[12px] text-white" /></label>
      <p className="text-[10.5px] leading-relaxed text-[var(--studio-text-muted)] sm:col-span-3">{t('help')}</p>
      <button type="button" disabled={saving || !valid} onClick={create} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-4 text-[12px] font-semibold text-black disabled:opacity-45">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />}{saving ? t('creating') : t('submit')}</button>
      {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`text-[10.5px] sm:col-span-3 ${feedback.tone === 'error' ? 'text-red-200' : 'text-emerald-200'}`}>{feedback.text}</p>}
    </div>}
  </div>;
}
