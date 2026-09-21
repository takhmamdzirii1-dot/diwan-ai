'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Ban, Check, Loader2, X } from 'lucide-react';

export default function AdminPaymentActions({ paymentId, creditsAmount, allowReview = true, onResolved }: {
  paymentId: string;
  creditsAmount: string | null;
  allowReview?: boolean;
  onResolved?: (status: 'approved' | 'rejected' | 'cancelled') => void;
}) {
  const t = useTranslations('Admin.payments');
  const router = useRouter();
  const [note, setNote] = useState('');
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | 'cancel' | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const run = async (action: 'approve' | 'reject' | 'cancel') => {
    if (pendingAction) return;
    if (action === 'reject' && !note.trim()) {
      setFeedback({ tone: 'error', message: t('rejectionReasonRequired') });
      return;
    }
    const confirmation = action === 'approve'
      ? creditsAmount ? t('confirmApprove', { credits: creditsAmount }) : t('confirmApproveUnknown')
      : action === 'reject' ? t('confirmReject') : t('confirmCancel');
    if (!window.confirm(confirmation)) return;
    setPendingAction(action);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/payments/${paymentId}/${action}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ note: note.trim() }),
      });
      const body = await response.json().catch(() => null);
      const status = body?.result?.status;
      const expectedStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'cancelled';
      if (!response.ok || status !== expectedStatus) throw new Error('request failed');
      onResolved?.(status);
      const successKey = action === 'approve' ? 'approvedSuccess'
        : action === 'reject' ? 'rejectedSuccess' : 'cancelledSuccess';
      setFeedback({ tone: 'success', message: t(successKey) });
      router.refresh();
    } catch {
      setFeedback({ tone: 'error', message: t('actionFailed') });
    } finally { setPendingAction(null); }
  };

  return <div className="space-y-1.5 rounded-lg border border-[var(--studio-border-strong)] bg-[var(--studio-surface-elevated)] p-2.5 shadow-[0_18px_45px_-24px_rgba(0,0,0,0.95)]">
    <label className="block text-start text-[12px] font-semibold text-white">
      {t('reviewNote')}
      <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000}
        placeholder={t('reviewNotePlaceholder')}
        className="mt-1 h-9 w-full rounded-lg border border-[var(--studio-border)] bg-black/25 px-3 text-[12px] text-white outline-none placeholder:text-[var(--studio-text-muted)] focus-visible:border-[var(--studio-border-strong)]" />
    </label>
    <p className="text-start text-[11px] leading-relaxed text-[var(--studio-text-secondary)]">{t(allowReview ? 'reviewHelp' : 'cancelHelp')}</p>
    <div className="flex gap-2">
      {allowReview && <button type="button" disabled={pendingAction !== null} onClick={() => void run('reject')}
        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-300/25 bg-red-300/[0.04] px-3 text-[12px] font-semibold text-red-100 transition-[background-color,opacity] duration-150 hover:bg-red-300/[0.1] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none">
        {pendingAction === 'reject' ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}{pendingAction === 'reject' ? t('rejecting') : t('reject')}
      </button>}
      {allowReview && <button type="button" disabled={pendingAction !== null} onClick={() => void run('approve')}
        className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--studio-accent)] px-3 text-[12px] font-semibold text-[var(--studio-accent-contrast)] transition-[background-color,opacity] duration-150 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none">
        {pendingAction === 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}{pendingAction === 'approve' ? t('approving') : 'Approve Payment'}
      </button>}
    </div>
    <div className="flex justify-end">
      <button type="button" disabled={pendingAction !== null} onClick={() => void run('cancel')}
        className="flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] text-[var(--studio-text-muted)] hover:text-[var(--studio-text-primary)] disabled:cursor-not-allowed disabled:opacity-50">
        {pendingAction === 'cancel' ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Ban className="h-3.5 w-3.5" aria-hidden="true" />}{pendingAction === 'cancel' ? t('cancelling') : t('cancel')}
      </button>
    </div>
    {feedback && <p role={feedback.tone === 'error' ? 'alert' : 'status'} className={`text-start text-[11.5px] font-medium ${feedback.tone === 'error' ? 'text-red-100' : 'text-emerald-100'}`}>{feedback.message}</p>}
  </div>;
}
