'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Check, ChevronDown, CircleAlert, Loader2, Plus, Save, SlidersHorizontal } from 'lucide-react';
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
  return <span className="mt-1 block text-[11.5px] leading-relaxed text-[var(--studio-text-secondary)]">{children}</span>;
}

function PlanFields({ idPrefix, value, existing, onChange }: {
  idPrefix: string; value: Draft; existing: boolean; onChange: (value: Draft) => void;
}) {
  const t = useTranslations('Admin.payments');
  const input = 'mt-1.5 h-10 w-full min-w-0 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 text-[13px] text-white outline-none placeholder:text-[var(--studio-text-muted)] focus-visible:border-[var(--studio-border-strong)] disabled:cursor-not-allowed disabled:bg-black/20 disabled:text-[var(--studio-text-disabled)]';
  const label = 'min-w-0 text-[12px] font-semibold text-[var(--studio-text-secondary)]';

  return <div className="space-y-4">
    <div className="grid gap-x-3 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
      <label htmlFor={`${idPrefix}-name`} className={`${label} md:col-span-2`}>{t('planName')}
        <input id={`${idPrefix}-name`} required maxLength={120} className={input} value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })} />
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
      <label htmlFor={`${idPrefix}-description`} className={`${label} md:col-span-2 xl:col-span-3`}>{t('planDescription')}
        <textarea id={`${idPrefix}-description`} maxLength={500} rows={2}
          className="mt-1.5 min-h-16 w-full resize-y rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-3 py-2 text-[13px] leading-relaxed text-white outline-none placeholder:text-[var(--studio-text-muted)] focus-visible:border-[var(--studio-border-strong)]"
          value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} />
      </label>
      <div className="grid gap-2">
      <label className="flex min-h-10 cursor-pointer items-start gap-2 rounded-lg border border-[var(--studio-border)] bg-white/[0.025] px-3 py-2 text-[12px] text-[var(--studio-text-secondary)] hover:border-[var(--studio-border-strong)]">
        <input type="checkbox" checked={value.active} onChange={(event) => onChange({ ...value, active: event.target.checked })} className="mt-0.5 h-4 w-4 accent-white" />
        <span><span className="block font-semibold text-white">{t('availableForPurchase')}</span><FieldHelp>{t('activeHelp')}</FieldHelp></span>
      </label>
      <label className="flex min-h-10 cursor-pointer items-start gap-2 rounded-lg border border-[var(--studio-border)] bg-white/[0.025] px-3 py-2 text-[12px] text-[var(--studio-text-secondary)] hover:border-[var(--studio-border-strong)]">
        <input type="checkbox" checked={value.featured} onChange={(event) => onChange({ ...value, featured: event.target.checked })} className="mt-0.5 h-4 w-4 accent-white" />
        <span><span className="block font-semibold text-white">{t('recommended')}</span><FieldHelp>{t('featuredHelp')}</FieldHelp></span>
      </label>
      </div>
    </div>
    <details className="group rounded-lg border border-[var(--studio-border-subtle)] bg-black/15">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 text-[11.5px] font-semibold text-[var(--studio-text-muted)] hover:text-white [&::-webkit-details-marker]:hidden"><SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />{t('advanced')}<ChevronDown className="ms-auto h-3.5 w-3.5 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" /></summary>
      <div className="grid gap-3 border-t border-white/[0.06] p-3 md:grid-cols-3">
        <label htmlFor={`${idPrefix}-slug`} className={label}>{t('planSlug')}
          <input id={`${idPrefix}-slug`} required disabled={existing} dir="ltr" autoComplete="off" className={input}
            value={value.slug} onChange={(event) => onChange({ ...value, slug: event.target.value })} />
          <FieldHelp>{t(existing ? 'slugLockedHelp' : 'slugHelp')}</FieldHelp>
        </label>
        <label htmlFor={`${idPrefix}-kind`} className={label}>{t('planType')}
          <select id={`${idPrefix}-kind`} className={input} value={value.kind}
            onChange={(event) => onChange({ ...value, kind: event.target.value as Draft['kind'] })}>
            <option value="credit_pack">{t('credit_pack')}</option><option value="subscription">{t('subscription')}</option>
          </select><FieldHelp>{t('planTypeHelp')}</FieldHelp>
        </label>
        <label htmlFor={`${idPrefix}-order`} className={label}>{t('displayOrder')}
          <input id={`${idPrefix}-order`} required className={input} type="number" min="-10000" max="10000" step="1" inputMode="numeric"
            value={value.displayOrder} onChange={(event) => onChange({ ...value, displayOrder: event.target.value })} />
          <FieldHelp>{t('displayOrderHelp')}</FieldHelp>
        </label>
      </div>
    </details>
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
  const hasUnsavedPlans = useMemo(() => catalogPlans.some((plan) => {
    const draft = drafts[plan.id];
    return draft ? !planMatchesDraft(plan, draft) : false;
  }), [catalogPlans, drafts]);

  const move = async (id: string, direction: -1 | 1) => {
    if (pending || hasUnsavedPlans) return;
    const currentIndex = catalogPlans.findIndex((plan) => plan.id === id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= catalogPlans.length) return;
    const previous = catalogPlans;
    const optimistic = [...catalogPlans];
    [optimistic[currentIndex], optimistic[nextIndex]] = [optimistic[nextIndex], optimistic[currentIndex]];
    setCatalogPlans(optimistic);
    setPending('reorder'); setFeedback(null);
    try {
      const response = await fetch('/api/admin/payments/plans', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderedIds: optimistic.map((plan) => plan.id) }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(body?.plans)) throw new Error(t('errors.PLAN_REORDER_FAILED'));
      const canonical = body.plans as AdminPaymentPlan[];
      setCatalogPlans(sortPlans(canonical));
      setDrafts(Object.fromEntries(canonical.map((plan) => [plan.id, toDraft(plan)])));
      setFeedback({ scope: 'catalog', tone: 'success', message: t('orderSaved') });
      router.refresh();
    } catch (error) {
      setCatalogPlans(previous);
      setFeedback({ scope: 'catalog', tone: 'error', message: error instanceof Error ? error.message : t('errors.PLAN_REORDER_FAILED') });
    } finally { setPending(null); }
  };

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

  return <section className="mb-8 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-4 shadow-[0_18px_50px_-40px_rgba(0,0,0,0.95)]">
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3 text-start">
      <div><h2 className="text-[20px] font-semibold tracking-[-0.02em] text-white">{t('catalogTitle')}</h2><p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-[var(--studio-text-secondary)]">{t('catalogDescription')}</p></div>
      <span className="rounded-full border border-[var(--studio-border)] bg-white/[0.045] px-2.5 py-1 text-[11px] font-semibold text-[var(--studio-text-secondary)]">{t('planCount', { count: catalogPlans.length })}</span>
    </div>

    {feedbackFor('catalog')}
    <div className="space-y-2.5">{catalogPlans.map((plan, index) => {
      const draft = drafts[plan.id] ?? toDraft(plan);
      const dirty = !planMatchesDraft(plan, draft);
      return <details key={plan.id} name="admin-plan-editor" className="group rounded-xl border border-[var(--studio-border)] bg-white/[0.02] open:bg-white/[0.035] open:shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-3 py-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/50 [&::-webkit-details-marker]:hidden sm:px-4">
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--studio-text-muted)] transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-[14px] font-semibold text-white">{plan.name}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${plan.active ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100' : 'border-white/15 bg-white/[0.04] text-[var(--studio-text-muted)]'}`}>{t(plan.active ? 'availableForPurchase' : 'inactive')}</span>
            {plan.featured && <span className="rounded-full border border-white/20 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-white">{t('recommended')}</span>}
            {dirty && <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-2 py-0.5 text-[9.5px] text-amber-100">{t('unsaved')}</span>}</div>
          </div>
          <div className="grid shrink-0 grid-cols-2 items-center gap-3 text-end sm:gap-5">
            <div><p dir="ltr" className="text-[13px] font-semibold tabular-nums text-white">{plan.priceDzd.toLocaleString(locale)} DA</p><p className="text-[10px] font-medium text-[var(--studio-text-muted)]">{t('priceDzd')}</p></div>
            <div><p className="text-[13px] font-semibold tabular-nums text-white">{plan.unifiedCredits.toLocaleString(locale)}</p><p className="text-[10px] font-medium text-[var(--studio-text-muted)]">{t('planCredits')}</p></div>
          </div>
          <div className="flex shrink-0 flex-col gap-1 sm:flex-row"><button type="button" disabled={index === 0 || pending !== null || hasUnsavedPlans} title={t('moveUp', { name: plan.name })} aria-label={t('moveUp', { name: plan.name })} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void move(plan.id, -1); }} className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/45 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"><ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /></button><button type="button" disabled={index === catalogPlans.length - 1 || pending !== null || hasUnsavedPlans} title={t('moveDown', { name: plan.name })} aria-label={t('moveDown', { name: plan.name })} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void move(plan.id, 1); }} className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/45 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"><ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /></button></div>
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
