'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Banknote, Building2, CheckCircle2, Clock3, CreditCard, FileUp, Loader2, Wallet, X } from 'lucide-react';
import type { ManualTransferDestination, PaymentMethod, PaymentOrder, PaymentPlan } from '@/lib/payments/types';

export interface TopUpPlan { id: string; }
export interface TopUpModalProps { isOpen: boolean; onClose: () => void; plan?: TopUpPlan; onSuccess?: () => void; }

export default function TopUpModal({ isOpen, onClose, plan }: TopUpModalProps) {
  const t = useTranslations('payments');
  const locale = useLocale();
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [method, setMethod] = useState<PaymentMethod>('baridimob');
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [destination, setDestination] = useState<ManualTransferDestination | null>(null);
  const [transactionReference, setTransactionReference] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedPlan = useMemo(() => plans.find((item) => item.id === selectedPlanId) ?? null, [plans, selectedPlanId]);
  const manualMethod = method === 'baridimob' || method === 'ccp';

  useEffect(() => {
    if (!isOpen) return;
    setMethod('baridimob'); setOrder(null); setDestination(null); setTransactionReference('');
    setProof(null); setLoading(false); setSubmitted(false); setError(null); setCatalogLoading(true);
    fetch('/api/payments/plans').then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'PAYMENT_CATALOG_UNAVAILABLE');
      const nextPlans = (body.plans ?? []) as PaymentPlan[];
      setPlans(nextPlans);
      setSelectedPlanId(nextPlans.find((item) => item.id === plan?.id)?.id ?? nextPlans.find((item) => item.featured)?.id ?? nextPlans[0]?.id ?? '');
    }).catch((cause) => setError(translateError(cause instanceof Error ? cause.message : 'PAYMENT_CATALOG_UNAVAILABLE')))
      .finally(() => setCatalogLoading(false));
  // translateError intentionally depends only on the current locale provider.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, plan?.id]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const translateError = (code: string) => t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.generic');
  const resetOrder = (nextMethod: PaymentMethod) => {
    setMethod(nextMethod); setOrder(null); setDestination(null); setTransactionReference(''); setProof(null); setError(null);
  };

  const createOrder = async () => {
    if (!selectedPlan || !manualMethod) return;
    setLoading(true); setError(null);
    try {
      const response = await fetch('/api/payments/orders', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlan.id, method }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'PAYMENT_ORDER_CREATE_FAILED');
      setOrder(body.order); setDestination(body.destination);
    } catch (cause) { setError(translateError(cause instanceof Error ? cause.message : 'PAYMENT_ORDER_CREATE_FAILED')); }
    finally { setLoading(false); }
  };

  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!order) return;
    setLoading(true); setError(null);
    const form = new FormData(); form.set('customerReference', transactionReference); if (proof) form.set('proof', proof);
    try {
      const response = await fetch(`/api/payments/orders/${order.id}/submit`, { method: 'POST', body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'PAYMENT_SUBMISSION_FAILED');
      setOrder(body.order); setSubmitted(true); window.dispatchEvent(new Event('vantra-payment-updated'));
    } catch (cause) { setError(translateError(cause instanceof Error ? cause.message : 'PAYMENT_SUBMISSION_FAILED')); }
    finally { setLoading(false); }
  };

  const methods: { id: PaymentMethod; label: string; detail: string; icon: React.ElementType }[] = [
    { id: 'baridimob', label: t('baridimob'), detail: t('manualBadge'), icon: Banknote },
    { id: 'ccp', label: t('ccp'), detail: t('manualBadge'), icon: Building2 },
    { id: 'edahabia', label: t('edahabia'), detail: t('automaticSoon'), icon: CreditCard },
    { id: 'cib', label: t('cib'), detail: t('automaticSoon'), icon: CreditCard },
  ];

  return <AnimatePresence>{isOpen && <div id="vantra-topup-modal-root" className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="topup-title">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={onClose} className="fixed inset-0 bg-black/80 backdrop-blur-xl" />
    <motion.div initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12 }} transition={{ duration: 0.2 }} className="relative z-10 my-auto max-h-[calc(100svh-24px)] w-full max-w-[540px] space-y-6 overflow-y-auto rounded-3xl border border-white/[0.1] bg-[#0a0a0b] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.78)] sm:max-h-[calc(100svh-48px)] sm:p-7">
      <div className="absolute inset-x-[18%] top-0 h-px bg-white/30" />
      <header className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3.5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] text-white/80"><Wallet className="h-5 w-5" /></span><span className="min-w-0"><h3 id="topup-title" className="text-xl font-bold tracking-tight text-white">{t('title')}</h3><p className="mt-1 text-xs leading-relaxed text-white/50">{t('subtitle')}</p></span></div><button type="button" onClick={onClose} aria-label={t('close')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.1] text-white/55 transition-[background-color,color] duration-150 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"><X className="h-4 w-4" /></button></header>

      {submitted ? <div role="status" className="rounded-2xl border border-white/15 bg-white/[0.045] p-5 text-center"><Clock3 className="mx-auto h-7 w-7 text-white/75" /><h4 className="mt-3 text-base font-semibold text-white">{t('pendingTitle')}</h4><p className="mt-2 text-xs leading-relaxed text-white/55">{t('pendingDescription')}</p><code dir="ltr" className="mt-4 block rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80">{order?.payment_reference}</code></div> : <div className="space-y-5">
        <fieldset className="space-y-2.5"><legend className="text-xs font-medium text-white/65">{t('selectPlan')}</legend>{catalogLoading ? <div className="flex h-16 items-center justify-center rounded-xl border border-white/10"><Loader2 className="h-4 w-4 animate-spin text-white/50" /></div> : plans.length ? <div className="grid gap-2 sm:grid-cols-2">{plans.map((item) => <button key={item.id} type="button" disabled={Boolean(order)} onClick={() => setSelectedPlanId(item.id)} aria-pressed={selectedPlanId === item.id} className={`rounded-xl border p-3 text-start transition-[background-color,border-color] duration-150 ${selectedPlanId === item.id ? 'border-white/35 bg-white/[0.08]' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/15'} disabled:opacity-60`}><span className="block text-xs font-semibold text-white/85">{item.name}</span>{item.description && <span className="mt-1 block line-clamp-2 text-[10px] text-white/45">{item.description}</span>}<span dir="ltr" className="mt-2 block text-[11px] text-white/65">{item.priceDzd.toLocaleString(locale)} DA · {item.unifiedCredits.toLocaleString(locale)} {t('creditsShort')}</span></button>)}</div> : <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-white/45">{t('catalogEmpty')}</p>}</fieldset>
        <fieldset className="space-y-2.5"><legend className="text-xs font-medium text-white/65">{t('paymentMethod')}</legend><div className="grid grid-cols-2 gap-2.5">{methods.map(({ id, label, detail, icon: Icon }) => <button key={id} type="button" disabled={Boolean(order)} onClick={() => resetOrder(id)} aria-pressed={method === id} className={`flex items-center gap-3 rounded-2xl border p-3 text-start transition-[background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${method === id ? 'border-white/35 bg-white/[0.08]' : 'border-white/[0.08] bg-white/[0.025] hover:border-white/[0.16]'} disabled:opacity-60`}><Icon className="h-4 w-4 shrink-0 text-white/70" /><span className="min-w-0"><span className="block truncate text-[11px] font-bold text-white">{label}</span><span className="block text-[9px] text-white/45">{detail}</span></span></button>)}</div></fieldset>

        {selectedPlan && <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"><div className="flex items-center justify-between gap-4 text-xs"><span className="text-white/45">{t('selectedPlan')}</span><span className="text-end font-semibold text-white/90">{selectedPlan.name}</span></div><div className="flex items-center justify-between gap-4 text-xs"><span className="text-white/45">{t('creditsAdded')}</span><span dir="ltr" className="font-mono font-semibold text-white/85">+{selectedPlan.unifiedCredits.toLocaleString(locale)}</span></div><div className="flex items-center justify-between gap-4 border-t border-white/[0.08] pt-3"><span className="text-xs font-medium text-white/60">{t('total')}</span><span dir="ltr" className="font-mono text-base font-bold text-white">{selectedPlan.priceDzd.toLocaleString(locale)} DA</span></div></div>}

        {!manualMethod ? <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-start"><p className="text-sm font-medium text-white/80">{t('gatewayUnavailableTitle')}</p><p className="mt-2 text-xs leading-relaxed text-white/50">{t('gatewayUnavailableDescription')}</p><button type="button" onClick={() => resetOrder('baridimob')} className="mt-4 flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-black">{t('useManual')}<ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" /></button></div> : !order ? <div><p className="mb-3 text-xs leading-relaxed text-white/50">{t('manualReviewNotice')}</p><button type="button" disabled={loading || !selectedPlan} onClick={createOrder} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-black transition-[background-color,opacity,transform] duration-150 hover:bg-gray-200 active:scale-[0.99] disabled:opacity-55">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Banknote className="h-4 w-4" />}{t('createRequest')}</button></div> : <form onSubmit={submitPayment} className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-start"><p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">{t('transferReference')}</p><code dir="ltr" className="mt-2 block text-base font-semibold text-white">{order.payment_reference}</code>{destination?.rip && <><p className="mt-4 text-[11px] text-white/45">RIP</p><code dir="ltr" className="mt-1 block text-xs text-white/75">{destination.rip}</code></>}{destination?.accountHolder && <><p className="mt-4 text-[11px] text-white/45">{t('accountHolder')}</p><p className="mt-1 text-xs text-white/75">{destination.accountHolder}</p></>}{destination?.accountNumber && <><p className="mt-3 text-[11px] text-white/45">{t('accountNumber')}</p><code dir="ltr" className="mt-1 block text-xs text-white/75">{destination.accountNumber}</code></>}{destination?.accountKey && <><p className="mt-3 text-[11px] text-white/45">{t('accountKey')}</p><code dir="ltr" className="mt-1 block text-xs text-white/75">{destination.accountKey}</code></>}{destination?.accountAddress && <><p className="mt-3 text-[11px] text-white/45">{t('accountAddress')}</p><p className="mt-1 text-xs text-white/75">{destination.accountAddress}</p></>}<p className="mt-4 text-xs leading-relaxed text-white/55">{t('transferInstructions', { amount: order.amount_dzd.toLocaleString(locale), reference: order.payment_reference })}</p></div>
          <label className="block space-y-1.5 text-start"><span className="text-xs font-medium text-white/65">{t('transactionReference')}</span><input required minLength={2} maxLength={200} value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)} placeholder={t('transactionReferencePlaceholder')} className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.025] px-4 text-sm text-white outline-none placeholder:text-white/25 focus-visible:ring-2 focus-visible:ring-white/40" /></label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-4 text-xs text-white/55 focus-within:ring-2 focus-within:ring-white/40"><FileUp className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{proof?.name ?? t('proofOptional')}</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(event) => setProof(event.target.files?.[0] ?? null)} /></label>
          <button type="submit" disabled={loading || transactionReference.trim().length < 2} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-black transition-[background-color,opacity,transform] duration-150 hover:bg-gray-200 active:scale-[0.99] disabled:opacity-55">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{t('submitForReview')}</button>
        </form>}
        {error && <p role="alert" className="rounded-xl border border-red-400/15 bg-red-400/[0.05] p-3 text-xs text-red-100">{error}</p>}
      </div>}
    </motion.div>
  </div>}</AnimatePresence>;
}

export { TopUpModal };
