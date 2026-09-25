'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AdminModelRow } from '@/lib/admin/types';
import { MODEL_PLAN_CODES, type ModelPlanCode } from '@/lib/models/plan-entitlements';
import { includedPlans, MODEL_ACCESS_STATES, type ModelAccessState, type ModelPlanAccessMap } from '@/lib/models/model-access';

type EditableModel = Pick<AdminModelRow,
  'key' | 'displayName' | 'modality' | 'enabled' | 'priority' | 'creditPrice' | 'activationSupported' | 'allowedPlans' | 'planAccess'>;

function clonePlanAccess(access: ModelPlanAccessMap): ModelPlanAccessMap {
  return Object.fromEntries(MODEL_PLAN_CODES.map((plan) => [plan, { ...access[plan] }])) as ModelPlanAccessMap;
}

export default function AdminModelControls({ model, mode = 'pricing', onSaved }: {
  model: EditableModel;
  mode?: 'pricing' | 'plans' | 'routing';
  onSaved: (config: {
    modelKey: string;
    enabled: boolean;
    routingRole: AdminModelRow['priority'];
    customerCreditPrice: number | null;
    allowedPlans: ModelPlanCode[];
    planAccess: ModelPlanAccessMap;
    updatedAt: string;
  }) => void;
}) {
  const t = useTranslations('Admin.models');
  const enabled = model.enabled;
  const [routingRole, setRoutingRole] = useState(model.priority);
  const [price, setPrice] = useState(model.creditPrice == null ? '' : String(model.creditPrice));
  const [planAccess, setPlanAccess] = useState<ModelPlanAccessMap>(() => clonePlanAccess(model.planAccess));
  const [saving, setSaving] = useState(false);
  const [confirmingPrice, setConfirmingPrice] = useState(false);
  const cancelConfirmationRef = useRef<HTMLButtonElement>(null);
  const saveConfirmationRef = useRef<HTMLButtonElement>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setRoutingRole(model.priority);
    setPrice(model.creditPrice == null ? '' : String(model.creditPrice));
    setPlanAccess(clonePlanAccess(model.planAccess));
    setFeedback(null);
    setConfirmingPrice(false);
  }, [model.key]);

  useEffect(() => { if (confirmingPrice) cancelConfirmationRef.current?.focus(); }, [confirmingPrice]);

  const normalizedPrice = useMemo(() => {
    const trimmed = price.trim();
    if (!trimmed) return null;
    if (!/^\d+$/.test(trimmed)) return undefined;
    const value = Number(trimmed);
    return Number.isSafeInteger(value) ? value : undefined;
  }, [price]);
  const dirty = mode === 'pricing' ? normalizedPrice !== model.creditPrice
    : mode === 'plans' ? MODEL_PLAN_CODES.some((plan) => planAccess[plan].state !== model.planAccess[plan].state
      || planAccess[plan].trialAllowance !== model.planAccess[plan].trialAllowance)
      : routingRole !== model.priority;

  const requestSave = () => {
    if (mode === 'pricing' && normalizedPrice !== model.creditPrice) {
      setConfirmingPrice(true);
      return;
    }
    void save();
  };

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
          customerCreditPrice: mode === 'pricing' ? normalizedPrice : model.creditPrice,
          allowedPlans: includedPlans(planAccess),
          ...(mode === 'plans' ? { planAccess: MODEL_PLAN_CODES.map((planCode) => ({ planCode, ...planAccess[planCode] })) } : {}),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.config) throw new Error(body.error ?? 'MODEL_CONFIG_UPDATE_FAILED');
      onSaved(body.config);
      setConfirmingPrice(false);
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

  return <div className="grid gap-3 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-card)] p-4 text-start sm:grid-cols-2 sm:items-end">
    {mode === 'routing' && <label title={t('roleHelp')} className="grid gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">
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
    </label>}
    {mode === 'pricing' && <label title={t('priceHelper')} className="grid gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">
      {t('customerPriceLabel')}
      <input
        value={price}
        inputMode="numeric"
        placeholder={t('customerPricePlaceholder')}
        onChange={(event) => { setPrice(event.target.value); setFeedback(null); }}
        className={controlClass}
      />
    </label>}
    {mode === 'plans' && <fieldset className="sm:col-span-2">
      <legend className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--studio-text-muted)]">{t('planAccessLabel')}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {MODEL_PLAN_CODES.map((plan) => <div key={plan} className="grid gap-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] p-3">
          <div className="flex items-center justify-between gap-3"><span className="text-[12px] font-semibold text-white">{t(`plan.${plan}`)}</span>{plan === 'max' && <span className="text-[10px] text-[var(--studio-text-muted)]">{t('maxFrozen')}</span>}</div>
          <select
            aria-label={`${t(`plan.${plan}`)} access`}
            value={planAccess[plan].state}
            disabled={plan === 'max'}
            onChange={(event) => {
              const state = event.target.value as ModelAccessState;
              setPlanAccess((current) => ({ ...current, [plan]: { state, trialAllowance: state === 'trial' ? current[plan].trialAllowance : null } }));
              setFeedback(null);
            }}
            className={controlClass}
          >
            {MODEL_ACCESS_STATES.map((state) => <option key={state} value={state}>{state[0].toUpperCase() + state.slice(1)}</option>)}
          </select>
          {planAccess[plan].state === 'trial' && <label className="grid gap-1 text-[10px] font-medium text-[var(--studio-text-muted)]">
            Model Trial Uses
            <input
              value={planAccess[plan].trialAllowance ?? ''}
              inputMode="numeric"
              placeholder="Required before runtime access"
              onChange={(event) => {
                const value = event.target.value.trim();
                const allowance = /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null;
                setPlanAccess((current) => ({ ...current, [plan]: { state: 'trial', trialAllowance: allowance } }));
                setFeedback(null);
              }}
              className={controlClass}
            />
          </label>}
        </div>)}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--studio-text-muted)]">Trial access fails closed until a positive allowance is configured. Brand and execution routing remain independent.</p>
    </fieldset>}
    <div className="flex min-w-32 flex-col items-stretch gap-1.5">
      <button
        type="button"
        disabled={saving || !dirty || normalizedPrice === undefined}
        onClick={requestSave}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-4 text-[12px] font-semibold text-black transition-colors duration-150 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
      >
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {saving ? t('saving') : 'Save Changes'}
      </button>
      {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`text-[10.5px] ${feedback.tone === 'error' ? 'text-red-200' : 'text-emerald-200'}`}>{feedback.message}</p>}
    </div>
    {mode === 'pricing' && <p className="sm:col-span-2 text-[11px] text-[var(--studio-text-muted)]">{t('priceSemantics')}</p>}
    {mode === 'routing' && !model.enabled && <p className="sm:col-span-2 text-[11px] text-amber-100/80">{t('routingRequiresEnabled')}</p>}
    {confirmingPrice && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--studio-overlay)] p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setConfirmingPrice(false); }} onKeyDown={(event) => { if (event.key === 'Escape' && !saving) setConfirmingPrice(false); if (event.key === 'Tab' && !event.shiftKey && event.target === saveConfirmationRef.current) { event.preventDefault(); cancelConfirmationRef.current?.focus(); } if (event.key === 'Tab' && event.shiftKey && event.target === cancelConfirmationRef.current) { event.preventDefault(); saveConfirmationRef.current?.focus(); } }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-pricing-title" aria-describedby="confirm-pricing-description" className="w-full max-w-[480px] rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-popover)] p-6 text-center text-[var(--studio-text-primary)] shadow-[var(--studio-shadow)]">
        <div className="mx-auto mb-4 flex h-9 w-9 items-center justify-center rounded-full border border-amber-400/50 text-xl text-[var(--studio-warning)]">!</div>
        <h2 id="confirm-pricing-title" className="text-[20px] font-semibold">Confirm pricing change</h2>
        <p id="confirm-pricing-description" className="mt-2 text-[13px] text-[var(--studio-text-secondary)]">You are changing the customer cost for {model.displayName}.</p>
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-card)] p-4 text-start text-[13px]">
          <div><p className="text-[var(--studio-text-secondary)]">Current customer cost</p><strong className="mt-1 block">{model.creditPrice == null ? 'Unavailable' : `${model.creditPrice} credits / ${model.modality === 'chat' ? 'request' : model.modality}`}</strong></div>
          <span aria-hidden="true" className="text-[var(--studio-text-muted)]">→</span>
          <div><p className="text-[var(--studio-text-secondary)]">New customer cost</p><strong className="mt-1 block text-[var(--studio-warning)]">{normalizedPrice == null ? 'Unavailable' : `${normalizedPrice} credits / ${model.modality === 'chat' ? 'request' : model.modality}`}</strong></div>
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-[var(--studio-text-secondary)]">This affects future customer usage. Historical jobs and records remain unchanged.</p>
        <div className="mt-6 flex gap-3"><button ref={cancelConfirmationRef} type="button" disabled={saving} onClick={() => setConfirmingPrice(false)} className="h-10 flex-1 rounded-lg border border-[var(--studio-border)]">Cancel</button><button ref={saveConfirmationRef} type="button" disabled={saving} onClick={() => void save()} className="h-10 flex-1 rounded-lg bg-[var(--studio-accent)] font-semibold text-[var(--studio-accent-contrast)] disabled:opacity-50">{saving ? t('saving') : 'Save change'}</button></div>
        {feedback?.tone === 'error' && <p role="alert" className="mt-3 text-[12px] text-[var(--studio-error)]">{feedback.message}</p>}
      </div>
    </div>}
  </div>;
}
