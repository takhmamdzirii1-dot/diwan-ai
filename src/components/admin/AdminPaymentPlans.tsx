'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Plus, Save } from 'lucide-react';
import type { AdminPaymentPlan } from '@/lib/admin/types';

type Draft = Omit<AdminPaymentPlan, 'id'>;
const emptyDraft: Draft = { slug: '', name: '', description: null, kind: 'credit_pack', priceDzd: 0, unifiedCredits: '0', active: false, displayOrder: 0, featured: false };

function PlanFields({ value, onChange }: { value: Draft; onChange: (value: Draft) => void }) {
  const t = useTranslations('Admin.payments');
  const input = 'h-9 min-w-0 rounded-lg border border-white/10 bg-white/[0.025] px-3 text-[11px] text-white outline-none placeholder:text-white/25 focus-visible:ring-2 focus-visible:ring-white/50';
  return <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[130px_minmax(160px,1fr)_140px_120px_140px_90px]">
    <input className={input} value={value.slug} placeholder={t('planSlug')} onChange={(e) => onChange({ ...value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} />
    <input className={input} value={value.name} placeholder={t('planName')} onChange={(e) => onChange({ ...value, name: e.target.value })} />
    <select className={input} value={value.kind} onChange={(e) => onChange({ ...value, kind: e.target.value as Draft['kind'] })}><option value="credit_pack">{t('credit_pack')}</option><option value="subscription">{t('subscription')}</option></select>
    <input className={input} type="number" min="1" value={value.priceDzd || ''} placeholder={t('priceDzd')} onChange={(e) => onChange({ ...value, priceDzd: Number(e.target.value) })} />
    <input className={input} type="number" min="1" value={value.unifiedCredits === '0' ? '' : value.unifiedCredits} placeholder={t('planCredits')} onChange={(e) => onChange({ ...value, unifiedCredits: e.target.value })} />
    <input className={input} type="number" min="-10000" max="10000" value={value.displayOrder} aria-label={t('displayOrder')} onChange={(e) => onChange({ ...value, displayOrder: Number(e.target.value) })} />
    <input className={`${input} md:col-span-2 xl:col-span-4`} value={value.description ?? ''} placeholder={t('planDescription')} onChange={(e) => onChange({ ...value, description: e.target.value || null })} />
    <label className="flex h-9 items-center gap-2 text-[11px] text-white/60"><input type="checkbox" checked={value.active} onChange={(e) => onChange({ ...value, active: e.target.checked })} />{t('active')}</label>
    <label className="flex h-9 items-center gap-2 text-[11px] text-white/60"><input type="checkbox" checked={value.featured} onChange={(e) => onChange({ ...value, featured: e.target.checked })} />{t('featured')}</label>
  </div>;
}

function toPayload(plan: Draft) {
  return { ...plan, description: plan.description || null, priceDzd: Number(plan.priceDzd), unifiedCredits: Number(plan.unifiedCredits), displayOrder: Number(plan.displayOrder) };
}

export default function AdminPaymentPlans({ plans }: { plans: AdminPaymentPlan[] }) {
  const t = useTranslations('Admin.payments');
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(plans.map(({ id, ...plan }) => [id, plan])));
  const [newPlan, setNewPlan] = useState<Draft>(emptyDraft);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setDrafts(Object.fromEntries(plans.map(({ id, ...plan }) => [id, plan])));
  }, [plans]);

  const save = async (id: string | null) => {
    const draft = id ? drafts[id] : newPlan;
    if (!draft) return;
    setPending(id ?? 'new'); setError(false);
    try {
      const response = await fetch(id ? `/api/admin/payments/plans/${id}` : '/api/admin/payments/plans', {
        method: id ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(toPayload(draft)),
      });
      if (!response.ok) throw new Error('request failed');
      if (!id) setNewPlan(emptyDraft);
      router.refresh();
    } catch { setError(true); } finally { setPending(null); }
  };

  return <section className="mb-8 rounded-2xl border border-white/[0.08] bg-[var(--studio-surface)] p-4 sm:p-5">
    <div className="mb-4 text-start"><h2 className="text-[15px] font-semibold text-white/85">{t('catalogTitle')}</h2><p className="mt-1 text-[11.5px] text-white/45">{t('catalogDescription')}</p></div>
    <div className="space-y-3">{plans.map((plan) => <div key={plan.id} className="rounded-xl border border-white/[0.07] bg-white/[0.018] p-3"><PlanFields value={drafts[plan.id]} onChange={(value) => setDrafts((all) => ({ ...all, [plan.id]: value }))} /><button type="button" disabled={pending !== null} onClick={() => save(plan.id)} className="mt-3 flex h-9 items-center gap-2 rounded-lg border border-white/12 px-3 text-[11px] text-white/70 hover:bg-white/[0.05] disabled:opacity-50"><Save className="h-3.5 w-3.5" />{pending === plan.id ? t('saving') : t('savePlan')}</button></div>)}</div>
    <div className="mt-4 rounded-xl border border-dashed border-white/10 p-3"><p className="mb-3 text-[11px] font-medium text-white/55">{t('newPlan')}</p><PlanFields value={newPlan} onChange={setNewPlan} /><button type="button" disabled={pending !== null} onClick={() => save(null)} className="mt-3 flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-[11px] font-semibold text-black disabled:opacity-50">{pending === 'new' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}{t('createPlan')}</button></div>
    {error && <p role="alert" className="mt-3 text-[11px] text-red-200">{t('planActionFailed')}</p>}
  </section>;
}
