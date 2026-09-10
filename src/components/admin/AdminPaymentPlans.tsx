'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronDown, CircleAlert, Loader2, Plus, Save } from 'lucide-react';
import type { AdminPaymentPlan } from '@/lib/admin/types';

type Draft = {
  slug: string;
  name: string;
  description: string;
  kind: AdminPaymentPlan['kind'];
  priceDzd: string;
  unifiedCredits: string;
  active: boolean;
  displayOrder: string;
  featured: boolean;
};

type Feedback = { scope: string; tone: 'success' | 'error'; message: string } | null;
type ValidationKey = 'validationRequired' | 'validationPositive' | 'validationOrder' | 'validationSlug' | 'validationDuplicateSlug';

const emptyDraft: Draft = {
  slug: '', name: '', description: '', kind: 'credit_pack', priceDzd: '',
  unifiedCredits: '', active: false, displayOrder: '0', featured: false,
};

function toDraft(plan: AdminPaymentPlan): Draft {
  return {
    slug: plan.slug, name: plan.name, description: plan.description ?? '', kind: plan.kind,
    priceDzd: String(plan.priceDzd), unifiedCredits: String(plan.unifiedCredits),
    active: plan.active, displayOrder: String(plan.displayOrder), featured: plan.featured,
  };
}

function sortPlans(plans: AdminPaymentPlan[]) {
  return [...plans].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}

function normalizeDraft(draft: Draft) {
  return {
    slug: draft.slug.trim().toLowerCase(), name: draft.name.trim(),
    description: draft.description.trim() || null, kind: draft.kind,
    priceDzd: Number(draft.priceDzd), unifiedCredits: Number(draft.unifiedCredits),
    active: draft.active, displayOrder: Number(draft.displayOrder), featured: draft.featured,
  };
}

function isWholeNumber(value: string, allowNegative = false) {
  return (allowNegative ? /^-?\d+$/ : /^\d+$/).test(value.trim()) && Number.isSafeInteger(Number(value));
}

function validateDraft(draft: Draft, existingSlugs: Set<string>, originalSlug?: string): ValidationKey | null {
  const slug = draft.slug.trim().toLowerCase();
  if (!draft.name.trim()) return 'validationRequired';
  if (!/^[a-z0-9_]{1,80}$/.test(slug)) return 'validationSlug';
  if (slug !== originalSlug && existingSlugs.has(slug)) return 'validationDuplicateSlug';
  if (!isWholeNumber(draft.priceDzd) || Number(draft.priceDzd) <= 0
    || !isWholeNumber(draft.unifiedCredits) || Number(draft.unifiedCredits) <= 0) return 'validationPositive';
  if (!isWholeNumber(draft.displayOrder, true)
    || Number(draft.displayOrder) < -10000 || Number(draft.displayOrder) > 10000) return 'validationOrder';
  return null;
}

function planMatchesDraft(plan: AdminPaymentPlan, draft: Draft) {
  const normalized = normalizeDraft(draft);
  return plan.slug === normalized.slug && plan.name === normalized.name
    && plan.description === normalized.description && plan.kind === normalized.kind
    && plan.priceDzd === normalized.priceDzd && plan.unifiedCredits === normalized.unifiedCredits
    && plan.active === normalized.active && plan.displayOrder === normalized.displayOrder
    && plan.featured === normalized.featured;
}

function FieldHelp({ children }: { children: React.ReactNode }) {
  return <span className="mt-1 block text-[10px] leading-relaxed text-white/38">{children}</span>;
}

function PlanFields({ idPrefix, value, existing, onChange }: {
  idPrefix: string; value: Draft; existing: boolean; onChange: (value: Draft) => void;
}) {
  const t = useTranslations('Admin.payments');
  const input = 'mt-1.5 h-10 w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.025] px-3 text-[11.5px] text-white outline-none placeholder:text-white/25 focus-visible:border-white/25 focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:bg-white/[0.012] disabled:text-white/35';
  const label = 'min-w-0 text-[10.5px] font-medium text-white/60';

  return <div className="grid gap-x-3 gap-y-4 md:grid-cols-2 xl:grid-cols-6">
    <label htmlFor={`${idPrefix}-slug`} className={label}>{t('planSlug')}
      <input id={`${idPrefix}-slug`} required disabled={existing} dir="ltr" autoComplete="off" className={input}
        value={value.slug} onChange={(event) => onChange({ ...value, slug: event.target.value })} />
      <FieldHelp>{t(existing ? 'slugLockedHelp' : 'slugHelp')}</FieldHelp>
    </label>
    <label htmlFor={`${idPrefix}-name`} className={`${label} xl:col-span-2`}>{t('planName')}
      <input id={`${idPrefix}-name`} required maxLength={120} className={input} value={value.name}
        onChange={(event) => onChange({ ...value, name: event.target.value })} />
    </label>
    <label htmlFor={`${idPrefix}-kind`} className={label}>{t('planType')}
      <select id={`${idPrefix}-kind`} className={input} value={value.kind}
        onChange={(event) => onChange({ ...value, kind: event.target.value as Draft['kind'] })}>
        <option value="credit_pack">{t('credit_pack')}</option><option value="subscription">{t('subscription')}</option>
      </select><FieldHelp>{t('planTypeHelp')}</FieldHelp>
    </label>
    <label htmlFor={`${idPrefix}-price`} className={label}>{t('priceDzd')}
      <input id={`${idPrefix}-price`} required className={input} type="number" min="1" step="1" inputMode="numeric"
        value={value.priceDzd} onChange={(event) => onChange({ ...value, priceDzd: event.target.value })} />
      <FieldHelp>{t('priceHelp')}</FieldHelp>
    </label>
    <label htmlFor={`${idPrefix}-credits`} className={label}>{t('planCredits')}
      <input id={`${idPrefix}-credits`} required className={input} type="number" min="1" step="1" inputMode="numeric"
        value={value.unifiedCredits} onChange={(event) => onChange({ ...value, unifiedCredits: event.target.value })} />
      <FieldHelp>{t('creditsHelp')}</FieldHelp>
    </label>
    <label htmlFor={`${idPrefix}-order`} className={label}>{t('displayOrder')}
      <input id={`${idPrefix}-order`} required className={input} type="number" min="-10000" max="10000" step="1" inputMode="numeric"
        value={value.displayOrder} onChange={(event) => onChange({ ...value, displayOrder: event.target.value })} />
      <FieldHelp>{t('displayOrderHelp')}</FieldHelp>
    </label>
    <label htmlFor={`${idPrefix}-description`} className={`${label} md:col-span-2 xl:col-span-4`}>{t('planDescription')}
      <textarea id={`${idPrefix}-description`} maxLength={500} rows={2}
        className="mt-1.5 min-h-16 w-full resize-y rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-[11.5px] leading-relaxed text-white outline-none placeholder:text-white/25 focus-visible:border-white/25 focus-visible:ring-2 focus-visible:ring-white/50"
        value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} />
    </label>
    <div className="grid gap-2 md:col-span-2 xl:col-span-2">
      <label className="flex min-h-10 cursor-pointer items-start gap-2 rounded-lg border border-white/[0.07] bg-white/[0.018] px-3 py-2 text-[11.5px] text-white/70">
        <input type="checkbox" checked={value.active} onChange={(event) => onChange({ ...value, active: event.target.checked })} className="mt-0.5 h-4 w-4 accent-white" />
        <span><span className="block font-medium text-white/75">{t('active')}</span><FieldHelp>{t('activeHelp')}</FieldHelp></span>
      </label>
      <label className="flex min-h-10 cursor-pointer items-start gap-2 rounded-lg border border-white/[0.07] bg-white/[0.018] px-3 py-2 text-[11.5px] text-white/70">
        <input type="checkbox" checked={value.featured} onChange={(event) => onChange({ ...value, featured: event.target.checked })} className="mt-0.5 h-4 w-4 accent-white" />
        <span><span className="block font-medium text-white/75">{t('featured')}</span><FieldHelp>{t('featuredHelp')}</FieldHelp></span>
      </label>
    </div>
  </div>;
}

export default function AdminPaymentPlans({ plans }: { plans: AdminPaymentPlan[] }) {
  const t = useTranslations('Admin.payments');
  const locale = useLocale();
  const router = useRouter();
  const [catalogPlans, setCatalogPlans] = useState(() => sortPlans(plans));
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(plans.map((plan) => [plan.id, toDraft(plan)])));
  const [newPlan, setNewPlan] = useState<Draft>(emptyDraft);
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    setCatalogPlans(sortPlans(plans));
    setDrafts(Object.fromEntries(plans.map((plan) => [plan.id, toDraft(plan)])));
  }, [plans]);

  const slugs = useMemo(() => new Set(catalogPlans.map((plan) => plan.slug)), [catalogPlans]);

  const save = async (id: string | null) => {
    if (pending) return;
    const scope = id ?? 'new';
    const draft = id ? drafts[id] : newPlan;
    const original = id ? catalogPlans.find((plan) => plan.id === id) : undefined;
    if (!draft || (id && !original)) return;
    const validationError = validateDraft(draft, slugs, original?.slug);
    if (validationError) {
      setFeedback({ scope, tone: 'error', message: t(validationError) });
      return;
    }

    setPending(scope); setFeedback(null);
    try {
      const response = await fetch(id ? `/api/admin/payments/plans/${id}` : '/api/admin/payments/plans', {
        method: id ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(normalizeDraft(draft)),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.plan?.id) {
        const key = typeof body?.error === 'string' && t.has(`errors.${body.error}`) ? `errors.${body.error}` : 'planActionFailed';
        throw new Error(t(key));
      }
      const canonical = body.plan as AdminPaymentPlan;
      setCatalogPlans((current) => sortPlans(id ? current.map((plan) => plan.id === canonical.id ? canonical : plan) : [...current, canonical]));
      setDrafts((current) => ({ ...current, [canonical.id]: toDraft(canonical) }));
      if (!id) setNewPlan(emptyDraft);
      setFeedback({ scope: canonical.id, tone: 'success', message: t(id ? 'planSaved' : 'planCreated') });
      router.refresh();
    } catch (error) {
      setFeedback({ scope, tone: 'error', message: error instanceof Error ? error.message : t('planActionFailed') });
    } finally { setPending(null); }
  };

  const feedbackFor = (scope: string) => feedback?.scope === scope
    ? <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`mt-3 flex items-center gap-1.5 text-[11px] ${feedback.tone === 'error' ? 'text-red-200' : 'text-white/70'}`}>
      {feedback.tone === 'success' && <Check className="h-3.5 w-3.5" aria-hidden="true" />}{feedback.message}</p> : null;

  return <section className="mb-8 rounded-2xl border border-white/[0.08] bg-[var(--studio-surface)] p-4 sm:p-5">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 text-start">
      <div><h2 className="text-[15px] font-semibold text-white/85">{t('catalogTitle')}</h2><p className="mt-1 max-w-3xl text-[11.5px] leading-relaxed text-white/50">{t('catalogDescription')}</p></div>
      <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[10.5px] text-white/55">{t('planCount', { count: catalogPlans.length })}</span>
    </div>

    <div className="space-y-3">{catalogPlans.map((plan) => {
      const draft = drafts[plan.id] ?? toDraft(plan);
      const dirty = !planMatchesDraft(plan, draft);
      return <details key={plan.id} className="group rounded-xl border border-white/[0.08] bg-white/[0.018] open:bg-white/[0.024]">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-3 py-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/50 [&::-webkit-details-marker]:hidden sm:px-4">
          <ChevronDown className="h-4 w-4 shrink-0 text-white/35 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-[13px] font-semibold text-white/85">{plan.name}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${plan.active ? 'border-white/20 bg-white text-black' : 'border-white/10 bg-white/[0.03] text-white/45'}`}>{t(plan.active ? 'active' : 'inactive')}</span>
            {plan.featured && <span className="rounded-full border border-white/15 px-2 py-0.5 text-[9.5px] text-white/65">{t('featured')}</span>}
            {dirty && <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-2 py-0.5 text-[9.5px] text-amber-100">{t('unsaved')}</span>}</div>
            <p dir="ltr" className="mt-1 truncate text-[10px] text-white/35">{t('internalSlugShort')}: {plan.slug}</p></div>
          <div className="hidden shrink-0 items-center gap-5 text-end sm:flex">
            <div><p dir="ltr" className="text-[12px] font-medium tabular-nums text-white/75">{plan.priceDzd.toLocaleString(locale)} DA</p><p className="text-[9.5px] text-white/35">{t('priceDzd')}</p></div>
            <div><p className="text-[12px] font-medium tabular-nums text-white/75">{plan.unifiedCredits.toLocaleString(locale)}</p><p className="text-[9.5px] text-white/35">{t('planCredits')}</p></div>
            <div><p className="text-[12px] font-medium tabular-nums text-white/75">{plan.displayOrder}</p><p className="text-[9.5px] text-white/35">{t('displayOrder')}</p></div>
          </div>
        </summary>
        <form onSubmit={(event) => { event.preventDefault(); void save(plan.id); }} className="border-t border-white/[0.07] p-3 sm:p-4">
          <PlanFields idPrefix={`plan-${plan.id}`} existing value={draft} onChange={(value) => setDrafts((current) => ({ ...current, [plan.id]: value }))} />
          <div className="mt-4 flex flex-wrap items-center gap-3"><button type="submit" disabled={pending !== null || !dirty}
            className="flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-[11px] font-semibold text-black transition-colors duration-150 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35 motion-reduce:transition-none">
            {pending === plan.id ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save className="h-3.5 w-3.5" aria-hidden="true" />}{pending === plan.id ? t('saving') : dirty ? t('savePlan') : t('saved')}</button>
            {dirty && <button type="button" disabled={pending !== null} onClick={() => setDrafts((current) => ({ ...current, [plan.id]: toDraft(plan) }))}
              className="h-9 rounded-lg border border-white/10 px-3 text-[11px] text-white/60 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-40">{t('discardChanges')}</button>}</div>
          {feedbackFor(plan.id)}
        </form>
      </details>;
    })}</div>

    {!catalogPlans.length && <div className="mb-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-[12px] text-white/45">{t('noPlans')}</div>}
    <details className="group mt-4 rounded-xl border border-dashed border-white/12 bg-black/10">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-3 text-[12px] font-medium text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/50 [&::-webkit-details-marker]:hidden sm:px-4">
        <Plus className="h-4 w-4" aria-hidden="true" />{t('newPlan')}<ChevronDown className="ms-auto h-4 w-4 text-white/35 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <form onSubmit={(event) => { event.preventDefault(); void save(null); }} className="border-t border-white/[0.07] p-3 sm:p-4">
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 text-start text-[10.5px] leading-relaxed text-white/48"><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{t('createHelp')}</div>
        <PlanFields idPrefix="new-plan" existing={false} value={newPlan} onChange={setNewPlan} />
        <button type="submit" disabled={pending !== null} className="mt-4 flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-[11px] font-semibold text-black transition-colors duration-150 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none">
          {pending === 'new' ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}{pending === 'new' ? t('saving') : t('createPlan')}</button>
        {feedbackFor('new')}
      </form>
    </details>
  </section>;
}
