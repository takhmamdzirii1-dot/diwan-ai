'use client';

import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type CreditAdjustmentResult = {
  balance: string;
  transaction: {
    id: string;
    transaction_type: string;
    amount: string;
    reason: string;
    created_at: string;
  };
};

export default function AdminCreditAdjustment({ userId, onAdjusted }: {
  userId: string;
  onAdjusted: (result: CreditAdjustmentResult) => void;
}) {
  const t = useTranslations('Admin.users.creditAdjustment');
  const [direction, setDirection] = useState<'add' | 'deduct'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  const resetAttempt = () => {
    idempotencyKey.current = null;
    setState('idle');
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!Number.isSafeInteger(numericAmount) || numericAmount <= 0 || reason.trim().length < 3) {
      setError(t('invalid'));
      return;
    }
    if (direction === 'deduct' && !window.confirm(t('confirmDeduct', { amount: numericAmount }))) return;
    idempotencyKey.current ??= crypto.randomUUID();
    setState('saving');
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/credits/adjust`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          direction,
          amount: numericAmount,
          reason: reason.trim(),
          idempotencyKey: idempotencyKey.current,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'CREDIT_ADJUSTMENT_FAILED');
      onAdjusted(body as CreditAdjustmentResult);
      setAmount('');
      setReason('');
      idempotencyKey.current = null;
      setState('saved');
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'CREDIT_ADJUSTMENT_FAILED';
      setState('idle');
      setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.CREDIT_ADJUSTMENT_FAILED'));
    }
  };

  return <form onSubmit={submit} data-credit-adjustment-state={state} className="mb-4 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-3.5">
    <div className="mb-3"><h3 className="text-[13px] font-semibold text-white">{t('title')}</h3><p className="mt-0.5 text-[11px] leading-relaxed text-[var(--studio-text-secondary)]">{t('description')}</p></div>
    <div className="grid gap-2 sm:grid-cols-[120px_140px_minmax(0,1fr)]">
      <label><span className="mb-1 block text-[10.5px] font-medium text-[var(--studio-text-secondary)]">{t('direction')}</span><select value={direction} onChange={(event) => { setDirection(event.target.value as 'add' | 'deduct'); resetAttempt(); }} className="h-9 w-full rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-2.5 text-[12px] text-white outline-none focus-visible:ring-2 focus-visible:ring-white/50"><option value="add">{t('add')}</option><option value="deduct">{t('deduct')}</option></select></label>
      <label><span className="mb-1 block text-[10.5px] font-medium text-[var(--studio-text-secondary)]">{t('amount')}</span><input inputMode="numeric" value={amount} onChange={(event) => { setAmount(event.target.value); resetAttempt(); }} placeholder="0" className="h-9 w-full rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-2.5 text-[12px] tabular-nums text-white outline-none focus-visible:ring-2 focus-visible:ring-white/50" /></label>
      <label><span className="mb-1 block text-[10.5px] font-medium text-[var(--studio-text-secondary)]">{t('reason')}</span><input value={reason} maxLength={500} onChange={(event) => { setReason(event.target.value); resetAttempt(); }} placeholder={t('reasonPlaceholder')} className="h-9 w-full rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] px-2.5 text-[12px] text-white outline-none placeholder:text-[var(--studio-text-muted)] focus-visible:ring-2 focus-visible:ring-white/50" /></label>
    </div>
    <div className="mt-3 flex items-center justify-between gap-3"><div>{error && <p role="alert" className="text-[11px] text-red-200">{error}</p>}{state === 'saved' && <p role="status" className="text-[11px] text-emerald-200">{t('saved')}</p>}</div><button type="submit" disabled={state === 'saving'} className="inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-lg bg-white px-3 text-[11.5px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">{state === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{t(state === 'saving' ? 'saving' : 'submit')}</button></div>
  </form>;
}
