'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Banknote, Building2, Check, CheckCircle2, Clipboard, Clock3, CreditCard, FileUp, Loader2, LockKeyhole, X } from 'lucide-react';
import type { ManualTransferDestination, PaymentMethod, PaymentOrder, PaymentPlan } from '@/lib/payments/types';
import { isPurchasablePlan } from '@/lib/payments/plan-catalog';
import { trackFunnelEvent } from '@/src/lib/funnel-analytics';

export interface TopUpPlan { id: string; }
export interface TopUpModalProps { isOpen: boolean; onClose: () => void; plan?: TopUpPlan; onSuccess?: () => void; }
type Step = 1 | 2 | 3;
type Availability = Record<PaymentMethod, boolean>;
const defaultAvailability: Availability = { baridimob: true, ccp: true, edahabia: false, cib: false };
const surface = 'rounded-2xl border border-[var(--studio-border,#414145)] bg-[var(--studio-card,#151517)]';
const primary = 'flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[var(--studio-accent,#f5f5f5)] px-5 text-base font-semibold text-[var(--studio-accent-contrast,#0b0b0d)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent,#fff)] disabled:cursor-not-allowed disabled:opacity-45';

function CopyValue({ label, value, copied, copy, onCopy }: { label: string; value: string; copied: boolean; copy: string; onCopy: (value: string) => void }) {
  return <div className="flex min-h-16 items-center justify-between gap-3 border-b border-[var(--studio-border-subtle,#333)] py-3 last:border-0">
    <div className="min-w-0"><p className="text-base text-[var(--studio-text-secondary,#bbb)]">{label}</p><p dir="ltr" className="mt-1 break-all text-base font-semibold tabular-nums">{value}</p></div>
    <button type="button" onClick={() => onCopy(value)} aria-label={copy + ' ' + label} className="flex min-h-12 shrink-0 items-center gap-2 rounded-xl border border-[var(--studio-border,#444)] px-3 text-base font-medium hover:bg-[var(--studio-hover,#29292d)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent,#fff)]">{copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{copy}</button>
  </div>;
}

export default function TopUpModal({ isOpen, onClose, plan }: TopUpModalProps) {
  const t = useTranslations('payments');
  const locale = useLocale();
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [preselected, setPreselected] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [method, setMethod] = useState<PaymentMethod>('baridimob');
  const [available, setAvailable] = useState<Availability>(defaultAvailability);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [destination, setDestination] = useState<ManualTransferDestination | null>(null);
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [gatewayFailed, setGatewayFailed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const checkoutAttempt = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const selectedPlan = useMemo(() => plans.find((item) => item.id === selectedPlanId) ?? null, [plans, selectedPlanId]);
  const checkoutTitle = selectedPlan?.kind === 'subscription'
    ? t('activatePlan', { plan: selectedPlan.name }) : t('title');
  const manual = method === 'baridimob' || method === 'ccp';
  const instantAvailable = available.edahabia || available.cib;
  const translateError = (code: string) => t.has('errors.' + code) ? t('errors.' + code) : t('errors.generic');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setPlans([]); setSelectedPlanId(''); setPreselected(false); setStep(1); setMethod('baridimob'); setAvailable(defaultAvailability);
    setOrder(null); setDestination(null); setReference(''); setProof(null); setBusy(false);
    setSubmitted(false); setConfirmation(false); setGatewayFailed(false); setCopied(null); setError(null);
    setCatalogLoading(true); inFlight.current = false;
    checkoutAttempt.current = crypto.randomUUID();
    Promise.all([
      fetch('/api/payments/plans', { cache: 'no-store' }).then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'PAYMENT_CATALOG_UNAVAILABLE');
        return body as { plans?: PaymentPlan[]; gatewayAvailability?: Availability };
      }),
      fetch('/api/payments/retention', { cache: 'no-store' }).then(async (response) => response.ok ? response.json() : null).catch(() => null),
    ]).then(([catalog, retention]) => {
      const lite = retention?.liteOffer as PaymentPlan | null | undefined;
      const next = [...(catalog.plans ?? []), ...(lite ? [lite] : [])].filter(isPurchasablePlan)
        .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
      if (cancelled) return;
      const status = { ...defaultAvailability, ...catalog.gatewayAvailability };
      setPlans(next); setAvailable(status);
      setMethod(status.edahabia ? 'edahabia' : status.cib ? 'cib' : status.baridimob ? 'baridimob' : 'ccp');
      const chosen = next.find((item) => item.id === plan?.id);
      if (chosen) { setSelectedPlanId(chosen.id); setPreselected(true); setStep(2); }
      else if (plan?.id) setError(t('chosenPlanUnavailable'));
    }).catch((cause) => { if (!cancelled) setError(translateError(cause instanceof Error ? cause.message : 'PAYMENT_CATALOG_UNAVAILABLE')); })
      .finally(() => { if (!cancelled) setCatalogLoading(false); });
    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); };
  // Opening the dialog or changing its preselected plan restarts checkout.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, plan?.id]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!isOpen) return;
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key !== 'Tab') return;
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href]') ?? [])]
        .filter((item) => item.getClientRects().length > 0);
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [isOpen, busy, onClose]);
  useEffect(() => { if (isOpen) heading.current?.focus(); }, [isOpen, step, submitted]);

  const cancelDraft = async () => {
    if (!order) return true;
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      const response = await fetch('/api/payments/orders/' + order.id + '/cancel', { method: 'POST' });
      if (!response.ok) throw new Error('PAYMENT_CANCELLATION_FAILED');
      setOrder(null); setDestination(null); setReference(''); setProof(null);
      window.dispatchEvent(new Event('vantra-payment-updated'));
      return true;
    } catch { setError(t('changePaymentFailed')); return false; }
    finally { setBusy(false); inFlight.current = false; }
  };
  const changePlan = async () => { if (await cancelDraft()) { setPreselected(false); setStep(1); setError(null); } };
  const changeMethod = async (next: PaymentMethod) => {
    if (next === method || !available[next] || busy) return;
    if (await cancelDraft()) { setMethod(next); setGatewayFailed(false); setError(null); }
  };
  const back = () => { if (busy || submitted || confirmation) return; setError(null); if (step === 3) setStep(2); else if (step === 2 && !preselected) void changePlan(); };
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(value); }
    catch { setError(t('copyFailed')); }
  };
  const createOrder = async () => {
    if (!selectedPlan || inFlight.current) return;
    if (order && order.payment_method === method) { setStep(3); return; }
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const response = await fetch('/api/payments/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ planId: selectedPlan.id, method }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'PAYMENT_ORDER_CREATE_FAILED');
      setOrder(body.order); setDestination(body.destination); setStep(3);
      window.dispatchEvent(new Event('vantra-payment-updated'));
    } catch (cause) { setError(translateError(cause instanceof Error ? cause.message : 'PAYMENT_ORDER_CREATE_FAILED')); }
    finally { setBusy(false); inFlight.current = false; }
  };
  const continueMethod = () => {
    if (!selectedPlan || !available[method] || busy) return;
    void trackFunnelEvent('checkout_started', checkoutAttempt.current, { planId: selectedPlan.id, planCode: selectedPlan.planCode });
    void trackFunnelEvent('payment_method_selected', `${checkoutAttempt.current}:${method}`, { planId: selectedPlan.id, method });
    if (manual) void createOrder();
    else { setGatewayFailed(false); setStep(3); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!order || inFlight.current || reference.trim().length < 2) return;
    inFlight.current = true; setBusy(true); setError(null);
    const form = new FormData(); form.set('customerReference', reference.trim()); if (proof) form.set('proof', proof);
    try {
      const response = await fetch('/api/payments/orders/' + order.id + '/submit', { method: 'POST', body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'PAYMENT_SUBMISSION_FAILED');
      setOrder(body.order); setConfirmation(true); window.dispatchEvent(new Event('vantra-payment-updated'));
      timer.current = setTimeout(() => { setSubmitted(true); setConfirmation(false); }, 1000);
    } catch (cause) { setError(translateError(cause instanceof Error ? cause.message : 'PAYMENT_SUBMISSION_FAILED')); }
    finally { setBusy(false); inFlight.current = false; }
  };
  const startGateway = async () => {
    if (!selectedPlan || !available[method] || inFlight.current) return;
    inFlight.current = true; setBusy(true); setGatewayFailed(false);
    try {
      const returnUrl = new URL('/' + locale + '/payment/return', window.location.origin);
      const response = await fetch('/api/payments/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ planId: selectedPlan.id, method, returnUrl: returnUrl.toString() }) });
      const body = await response.json();
      if (!response.ok || typeof body.redirectUrl !== 'string') throw new Error('GATEWAY_UNAVAILABLE');
      const redirect = new URL(body.redirectUrl);
      if (redirect.protocol !== 'https:') throw new Error('GATEWAY_UNAVAILABLE');
      window.location.assign(redirect.toString());
    } catch { setGatewayFailed(true); setBusy(false); inFlight.current = false; }
  };
  const methodCard = (id: PaymentMethod, Icon: React.ElementType, detail: string) => {
    const active = method === id;
    return <button key={id} type="button" role="radio" aria-checked={active} disabled={!available[id] || busy} onClick={() => void changeMethod(id)}
      className={'flex min-h-[76px] w-full items-center gap-3 rounded-xl border-2 p-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent,#fff)] ' + (active ? 'border-[var(--studio-accent,#fff)] bg-[var(--studio-hover,#29292d)]' : 'border-[var(--studio-border,#444)] hover:bg-[var(--studio-hover,#29292d)]') + (!available[id] ? ' opacity-55' : '')}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block text-base font-semibold">{t(id)}</span><span className="mt-0.5 block text-base leading-tight text-[var(--studio-text-secondary,#bbb)]">{available[id] ? detail : t('comingSoon')}</span></span>
      <span aria-hidden="true" className={'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ' + (active ? 'border-[var(--studio-accent,#fff)]' : 'border-[var(--studio-text-secondary,#aaa)]')}>{active && <span className="h-2 w-2 rounded-full bg-[var(--studio-accent,#fff)]" />}</span>
    </button>;
  };

  return <AnimatePresence>{isOpen && <div id="vantra-topup-modal-root" role="dialog" aria-modal="true" aria-labelledby="topup-title" className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden text-[var(--studio-text-primary,#fff)] [--section-padding:0px] sm:p-5">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={() => { if (!busy) onClose(); }} className="fixed inset-0 bg-[var(--studio-overlay,rgba(0,0,0,.82))] backdrop-blur-md" />
    <motion.div ref={dialog} initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }} transition={{ duration: 0.2 }} className="relative z-10 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden border border-[var(--studio-border,#444)] bg-[var(--studio-card,#151517)] shadow-[var(--studio-shadow,0_24px_80px_rgba(0,0,0,.7))] sm:h-auto sm:max-h-[calc(100dvh-40px)] sm:max-w-[700px] sm:rounded-3xl">
      <header className="sticky top-0 z-10 shrink-0 border-b border-[var(--studio-border,#444)] bg-[var(--studio-card,#151517)] px-5 pb-3 pt-[max(16px,env(safe-area-inset-top))] sm:px-6 sm:pt-5">
        <div className="flex items-start gap-3"><button type="button" onClick={back} disabled={busy || submitted || confirmation || step === 1 || (step === 2 && preselected)} aria-label={t('back')} className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-[var(--studio-border,#444)] disabled:invisible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent,#fff)]"><ArrowLeft className="h-5 w-5 rtl:rotate-180" /></button><div className="min-w-0 flex-1"><h2 ref={heading} tabIndex={-1} id="topup-title" className="text-xl font-semibold outline-none">{checkoutTitle}</h2><p className="mt-0.5 text-base text-[var(--studio-text-secondary,#bbb)]">{submitted ? t('pendingTitle') : step === 1 ? t('selectPlan') : step === 2 ? t('paymentMethod') : t('paymentDetails')}</p></div><button type="button" onClick={onClose} disabled={busy} aria-label={t('close')} className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-[var(--studio-border,#444)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent,#fff)]"><X className="h-5 w-5" /></button></div>
        <div className="mt-3 flex items-center justify-between text-base font-medium text-[var(--studio-text-secondary,#bbb)]"><span>{t('stepOf', { step, total: 3 })}</span><span>{Math.round(step / 3 * 100)}%</span></div><div role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3} aria-label={t('progressLabel')} className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--studio-border,#444)]"><div className="h-full rounded-full bg-[var(--studio-accent,#fff)] transition-[width] duration-200" style={{ width: String(step / 3 * 100) + '%' }} /></div>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 text-base sm:flex-[0_1_auto] sm:px-6 sm:py-5">
        {submitted ? <div role="status" className={surface + ' p-6 text-center'}><Clock3 className="mx-auto h-9 w-9" /><h3 className="mt-3 text-xl font-semibold">{t('pendingTitle')}</h3><p className="mt-3 leading-relaxed text-[var(--studio-text-secondary,#bbb)]">{t('pendingDescription')}</p>{order && <p dir="ltr" className="mt-4 rounded-xl border border-[var(--studio-border,#444)] p-3 font-semibold">{order.payment_reference}</p>}</div> : <>
          {step === 1 && <section aria-labelledby="plan-heading"><h3 id="plan-heading" className="mb-3 text-lg font-semibold">{t('selectPlan')}</h3>{catalogLoading ? <div className={surface + ' flex min-h-28 items-center justify-center'}><Loader2 className="h-6 w-6 animate-spin" aria-label={t('loadingPlans')} /></div> : plans.length ? <div role="radiogroup" aria-label={t('selectPlan')} className="space-y-3">{plans.map((item) => <button key={item.id} type="button" role="radio" aria-checked={selectedPlanId === item.id} onClick={() => { setSelectedPlanId(item.id); setError(null); }} className={'flex min-h-20 w-full items-center gap-4 rounded-2xl border-2 p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent,#fff)] ' + (selectedPlanId === item.id ? 'border-[var(--studio-accent,#fff)] bg-[var(--studio-hover,#29292d)]' : 'border-[var(--studio-border,#444)] hover:bg-[var(--studio-hover,#29292d)]')}><span className="min-w-0 flex-1"><span className="block text-lg font-semibold">{item.name}</span><span className="mt-1 block text-base text-[var(--studio-text-secondary,#bbb)]">{item.unifiedCredits.toLocaleString(locale)} {t('creditsShort')}</span></span><strong dir="ltr" className="shrink-0 text-base">{item.priceDzd.toLocaleString(locale)} DA</strong></button>)}</div> : <div className={surface + ' p-5 text-center'}>{t('catalogEmpty')}</div>}</section>}
          {step > 1 && selectedPlan && <div role="group" className={surface + ' w-full p-4'} aria-label={t('selectedPlan')}>
            <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
              <div className="min-w-0"><p className="text-base text-[var(--studio-text-secondary,#bbb)]">{t('selectedPlan')}</p><h3 className="mt-0.5 truncate text-lg font-semibold">{selectedPlan.name}</h3><p className="mt-0.5 text-base text-[var(--studio-text-secondary,#bbb)]">{selectedPlan.unifiedCredits.toLocaleString(locale)} {t('creditsShort')}</p></div>
              <div className="flex items-center justify-between gap-4 sm:justify-end"><strong dir="ltr" className="shrink-0 text-lg">{selectedPlan.priceDzd.toLocaleString(locale)} DA</strong><button type="button" onClick={() => void changePlan()} disabled={busy || confirmation || submitted} className="min-h-12 rounded-lg px-2 text-base font-semibold underline underline-offset-4 disabled:opacity-40">{t('change')}</button></div>
            </div>
          </div>}
          {step === 2 && <div className="space-y-4 sm:space-y-5">
            <section><div className="mb-1 flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">{t('instant')}</h3>{instantAvailable && <span className="rounded-full border border-[var(--studio-border,#444)] px-2 py-1 text-base font-semibold">{t('recommended')}</span>}</div><p className="mb-2 text-base text-[var(--studio-text-secondary,#bbb)]">{instantAvailable ? t('activatesImmediately') : t('gatewayUnavailableTitle')}</p><div role="radiogroup" aria-label={t('instant')} className="grid gap-2 sm:grid-cols-2">{methodCard('edahabia', CreditCard, t('activatesImmediately'))}{methodCard('cib', CreditCard, t('activatesImmediately'))}</div></section>
            <section><h3 className="mb-1 text-lg font-semibold">{t('manualTransfer')}</h3><p className="mb-2 text-base text-[var(--studio-text-secondary,#bbb)]">{t('reviewedWithinHours')}</p><div role="radiogroup" aria-label={t('manualTransfer')} className="grid gap-2 sm:grid-cols-2">{methodCard('baridimob', Banknote, t('reviewedWithinHours'))}{methodCard('ccp', Building2, t('reviewedWithinHours'))}</div></section>
          </div>}
          {step === 3 && !manual && <section className="space-y-4"><div className={surface + ' p-5'}><div className="flex gap-3"><LockKeyhole className="mt-1 h-6 w-6 shrink-0" /><div><h3 className="text-lg font-semibold">{t('securePayment')}</h3><p className="mt-2 leading-relaxed text-[var(--studio-text-secondary,#bbb)]">{t('gatewayTrust')}</p><p className="mt-3 text-base font-semibold">{t('poweredBySatim')}</p></div></div></div>{gatewayFailed && <div role="alert" className="rounded-xl border-2 border-red-400/60 bg-red-400/10 p-4"><h3 className="font-semibold">{t('gatewayFailedTitle')}</h3><p className="mt-1 text-base">{t('gatewayFailedDescription')}</p></div>}{busy && <p role="status" className="flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin" />{t('redirecting')}</p>}</section>}
          {step === 3 && manual && order && <form id="manual-payment-form" onSubmit={submit} className="space-y-5"><div className={surface + ' p-4'}><h3 className="mb-2 text-lg font-semibold">{t('transferDetails')}</h3><CopyValue label={t('transferReference')} value={order.payment_reference} copied={copied === order.payment_reference} copy={copied === order.payment_reference ? t('copied') : t('copy')} onCopy={copy} />{destination?.rip && <CopyValue label="RIP" value={destination.rip} copied={copied === destination.rip} copy={copied === destination.rip ? t('copied') : t('copy')} onCopy={copy} />}{destination?.accountHolder && <p className="py-3"><span className="block text-base text-[var(--studio-text-secondary,#bbb)]">{t('accountHolder')}</span><span className="mt-1 block font-semibold">{destination.accountHolder}</span></p>}{destination?.accountNumber && <CopyValue label={t('accountNumber')} value={destination.accountNumber} copied={copied === destination.accountNumber} copy={copied === destination.accountNumber ? t('copied') : t('copy')} onCopy={copy} />}{destination?.accountKey && <CopyValue label={t('accountKey')} value={destination.accountKey} copied={copied === destination.accountKey} copy={copied === destination.accountKey ? t('copied') : t('copy')} onCopy={copy} />}{destination?.accountAddress && <p className="py-3"><span className="block text-base text-[var(--studio-text-secondary,#bbb)]">{t('accountAddress')}</span><span className="mt-1 block">{destination.accountAddress}</span></p>}<p className="mt-4 leading-relaxed text-[var(--studio-text-secondary,#bbb)]">{t('transferInstructions', { amount: order.amount_dzd.toLocaleString(locale), reference: order.payment_reference })}</p></div><label className="block font-medium">{t('transactionReference')}<input required minLength={2} maxLength={200} value={reference} onChange={(event) => setReference(event.target.value)} placeholder={t('transactionReferencePlaceholder')} className="mt-2 min-h-14 w-full rounded-xl border-2 border-[var(--studio-border,#444)] bg-[var(--studio-surface,#202024)] px-4 text-base outline-none placeholder:text-[var(--studio-text-muted,#888)] focus-visible:border-[var(--studio-accent,#fff)]" /></label><label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-[var(--studio-border,#444)] px-4 focus-within:ring-2 focus-within:ring-[var(--studio-accent,#fff)]"><FileUp className="h-5 w-5 shrink-0" /><span className="min-w-0 flex-1 truncate">{proof?.name ?? t('proofOptional')}</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(event) => setProof(event.target.files?.[0] ?? null)} /></label><p className="text-base leading-relaxed text-[var(--studio-text-secondary,#bbb)]">{t('manualReviewNotice')}</p><a href="mailto:support@vantra.dz" className="inline-flex min-h-12 items-center text-base font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent,#fff)]">{t('contactSupport')}</a>{confirmation && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-4 font-semibold"><CheckCircle2 className="h-5 w-5" />{t('submissionReceived')}</p>}</form>}
          {error && <p role="alert" className="rounded-xl border-2 border-red-400/60 bg-red-400/10 p-4">{error}</p>}
        </>}
      </div>
      <footer className="sticky bottom-0 z-10 shrink-0 border-t border-[var(--studio-border,#444)] bg-[var(--studio-card,#151517)] px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-4">
        {submitted ? <button type="button" onClick={onClose} className={primary}>{t('done')}</button> : step === 1 ? <button type="button" disabled={!selectedPlan || catalogLoading} onClick={() => { if (selectedPlan) void trackFunnelEvent('checkout_started', checkoutAttempt.current, { planId: selectedPlan.id, planCode: selectedPlan.planCode }); setStep(2); setError(null); }} className={primary}>{t('continueToPayment')}</button> : step === 2 ? <button type="button" disabled={!selectedPlan || !available[method] || busy} onClick={continueMethod} className={primary}>{busy && <Loader2 className="h-5 w-5 animate-spin" />}{busy ? t('creatingRequest') : t('continueToDetails')}</button> : manual ? <button type="submit" form="manual-payment-form" disabled={busy || confirmation || !order || reference.trim().length < 2} className={primary}>{busy && <Loader2 className="h-5 w-5 animate-spin" />}{busy ? t('submitting') : t('submitForReview')}</button> : <button type="button" disabled={busy || !available[method]} onClick={() => void startGateway()} className={primary}>{busy && <Loader2 className="h-5 w-5 animate-spin" />}{busy ? t('redirecting') : gatewayFailed ? t('tryAgain') : t('continueToSatim')}</button>}
      </footer>
    </motion.div>
  </div>}</AnimatePresence>;
}

export { TopUpModal };
