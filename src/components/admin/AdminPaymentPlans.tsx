'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Loader2, Plus, Save } from 'lucide-react';
import type { AdminPaymentPlan } from '@/lib/admin/types';

type Draft = Omit<AdminPaymentPlan, 'id'>;
type Feedback = { scope: string; tone: 'success' | 'error'; message: string } | null;
type ValidationKey = 'validationRequired' | 'validationPositive' | 'validationOrder';

const emptyDraft: Draft = {
  slug: '', name: '', description: null, kind: 'credit_pack', priceDzd: 0,
  unifiedCredits: 0, active: false, displayOrder: 0, featured: false,
};

function toDraft({ id: _id, ...plan }: AdminPaymentPlan): Draft {
  return plan;
}

function sortPlans(plans: AdminPaymentPlan[]) {
  return [...plans].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}

function PlanFields({ idPrefix, value, onChange }: { idPrefix: string; value: Draft; onChange: (value: Draft) => void }) {
  const t = useTranslations('Admin.payments');
  const input = 'mt-1.5 h-10 w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.025] px-3 text-[11.5px] text-white outline-none placeholder:text-white/25 focus-visible:ring-2 focus-visible:ring-white/50';
  const label = 'min-w-0 text-[10.5px] font-medium text-white/55';
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
    <label htmlFor={`${idPrefix}-slug`} className={label}>{t('planSlug')}<input id={`${idPrefix}-slug`} required pattern="[a-z0-9_]{1,80}" className={input} value={value.slug} onChange={(event) => onChange({ ...value, slug: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} /></label>
    <label htmlFor={`${idPrefix}-name`} className={`${label} xl:col-span-2`}>{t('planName')}<input id={`${idPrefix}-name`} required maxLength={120} className={input} value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} /></label>
    <label htmlFor={`${idPrefix}-kind`} className={label}>{t('planType')}<select id={`${idPrefix}-kind`} className={input} value={value.kind} onChange={(event) => onChange({ ...value, kind: event.target.value as Draft['kind'] })}><option value="credit_pack">{t('credit_pack')}</option><option value="subscription">{t('subscription')}</option></select></label>
    <label htmlFor={`${idPrefix}-price`} className={label}>{t('priceDzd')}<input id={`${idPrefix}-price`} required className={input} type="number" min="1" step="1" inputMode="numeric" value={value.priceDzd || ''} onChange={(event) => onChange({ ...value, priceDzd: Number(event.target.value) })} /></label>
    <label htmlFor={`${idPrefix}-credits`} className={label}>{t('planCredits')}<input id={`${idPrefix}-credits`} required className={input} type="number" min="1" step="1" inputMode="numeric" value={value.unifiedCredits || ''} onChange={(event) => onChange({ ...value, unifiedCredits: Number(event.target.value) })} /></label>
    <label htmlFor={`${idPrefix}-order`} className={label}>{t('displayOrder')}<input id={`${idPrefix}-order`} required className={input} type="number" min="-10000" max="10000" step="1" inputMode="numeric" value={value.displayOrder} onChange={(event) => onChange({ ...value, displayOrder: Number(event.target.value) })} /></label>
    <label htmlFor={`${idPrefix}-description`} className={`${label} md:col-span-2 xl:col-span-4`}>{t('planDescription')}<textarea id={`${idPrefix}-description`} maxLength={500} rows={2} className="mt-1.5 min-h-16 w-full resize-y rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-[11.5px] leading-relaxed text-white outline-none placeholder:text-white/25 focus-visible:ring-2 focus-visible:ring-white/50" value={value.description ?? ''} onChange={(event) => onChange({ ...value, description: event.target.value || null })} /></label>
    <div className="flex items-end gap-5 md:col-span-2 xl:col-span-2">
      <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[11.5px] text-white/65"><input type="checkbox" checked={value.active} onChange={(event) => onChange({ ...value, active: event.target.checked })} className="h-4 w-4 accent-white" />{t('active')}</label>
      <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[11.5px] text-white/65"><input type="checkbox" checked={value.featured} onChange={(event) => onChange({ ...value, featured: event.target.checked })} className="h-4 w-4 accent-white" />{t('featured')}</label>
    </div>
  </div>;
}

function validateDraft(plan: Draft): ValidationKey | null {
  if (!/^[a-z0-9_]{1,80}$/.test(plan.slug) || !plan.name.trim()) return 'validationRequired';
  if (!Number.isSafeInteger(plan.priceDzd) || plan.priceDzd <= 0 || !Number.isSafeInteger(plan.unifiedCredits) || plan.unifiedCredits <= 0) return 'validationPositive';
  if (!Number.isInteger(plan.displayOrder) || plan.displayOrder < -10000 || plan.displayOrder > 10000) return 'validationOrder';
  return null;
}

export default function AdminPaymentPlans({ plans }: { plans: AdminPaymentPlan[] }) {
  const t = useTranslations('Admin.payments');
  const router = useRouter();
  const [catalogPlans, setCatalogPlans] = useState(() => sortPlans(plans));
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(plans.map((plan) => [plan.id, toDraft(plan)])));
  const [newPlan, setNewPlan] = useState<Draft>(emptyDraft);
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    setCatalogPlans(sortPlans(plans));
    setDrafts((current) => Object.fromEntries(plans.map((plan) => [plan.id, current[plan.id] ?? toDraft(plan)])));
  }, [plans]);

  const save = async (id: string | null) => {
    if (pending) return;
    const scope = id ?? 'new';
    const draft = id ? drafts[id] : newPlan;
    if (!draft) return;
    const validationError = validateDraft(draft);
    if (validationError) {
      setFeedback({ scope, tone: 'error', message: t(validationError) });
      return;
    }

    setPending(scope); setFeedback(null);
    try {
      const response = await fetch(id ? `/api/admin/payments/plans/${id}` : '/api/admin/payments/plans', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...draft, description: draft.description || null }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.plan?.id) throw new Error(body?.error ?? 'INVALID_RESPONSE');
      const canonical = body.plan as AdminPaymentPlan;
      setCatalogPlans((current) => sortPlans(id ? current.map((plan) => plan.id === canonical.id ? canonical : plan) : [...current, canonical]));
      setDrafts((current) => ({ ...current, [canonical.id]: toDraft(canonical) }));
      if (!id) setNewPlan(emptyDraft);
      setFeedback({ scope: canonical.id, tone: 'success', message: t(id ? 'planSaved' : 'planCreated') });
      router.refresh();
    } catch {
      setFeedback({ scope, tone: 'error', message: t('planActionFailed') });
    } finally {
      setPending(null);
    }
  };

  const feedbackFor = (scope: string) => feedback?.scope === scope
    ? <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`mt-3 flex items-center gap-1.5 text-[11px] ${feedback.tone === 'error' ? 'text-red-200' : 'text-white/65'}`}>{feedback.tone === 'success' && <Check className="h-3.5 w-3.5" />}{feedback.message}</p>
    : null;

  return <section className="mb-8 rounded-2xl border border-white/[0.08] bg-[var(--studio-surface)] p-4 sm:p-5">
    <div className="mb-4 text-start"><h2 className="text-[15px] font-semibold text-white/85">{t('catalogTitle')}</h2><p className="mt-1 text-[11.5px] text-white/45">{t('catalogDescription')}</p></div>
    <div className="space-y-3">{catalogPlans.map((plan) => {
      const draft = drafts[plan.id] ?? toDraft(plan);
      return <form key={plan.id} onSubmit={(event) => { event.preventDefault(); void save(plan.id); }} className="rounded-xl border border-white/[0.07] bg-white/[0.018] p-3">
        <PlanFields idPrefix={`plan-${plan.id}`} value={draft} onChange={(value) => setDrafts((current) => ({ ...current, [plan.id]: value }))} />
        <button type="submit" disabled={pending !== null} className="mt-3 flex h-9 items-center gap-2 rounded-lg border border-white/12 px-3 text-[11px] text-white/70 transition-colors duration-150 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-50">{pending === plan.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}{pending === plan.id ? t('saving') : t('savePlan')}</button>
        {feedbackFor(plan.id)}
      </form>;
    })}</div>
    <form onSubmit={(event) => { event.preventDefault(); void save(null); }} className="mt-4 rounded-xl border border-dashed border-white/10 p-3">
      <p className="mb-3 text-[11px] font-medium text-white/55">{t('newPlan')}</p>
      <PlanFields idPrefix="new-plan" value={newPlan} onChange={setNewPlan} />
      <button type="submit" disabled={pending !== null} className="mt-3 flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-[11px] font-semibold text-black transition-colors duration-150 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-50">{pending === 'new' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}{pending === 'new' ? t('saving') : t('createPlan')}</button>
      {feedbackFor('new')}
    </form>
  </section>;
}
