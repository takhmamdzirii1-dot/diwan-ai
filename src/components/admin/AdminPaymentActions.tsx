'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Loader2, X } from 'lucide-react';

export default function AdminPaymentActions({ paymentId }: { paymentId: string }) {
  const t = useTranslations('Admin.payments');
  const router = useRouter();
  const [note, setNote] = useState('');
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState(false);

  const run = async (action: 'approve' | 'reject') => {
    const prompt = action === 'approve' ? t('confirmApprove') : t('confirmReject');
    if (!window.confirm(prompt)) return;
    setPendingAction(action);
    setError(false);
    try {
      const response = await fetch(`/api/admin/payments/${paymentId}/${action}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ note }),
      });
      if (!response.ok) throw new Error('request failed');
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPendingAction(null);
    }
  };

  return <div className="min-w-56 space-y-2">
    <label className="block text-[10.5px] text-white/45">
      <span className="sr-only">{t('reviewNote')}</span>
      <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000}
        placeholder={t('reviewNote')} className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.025] px-3 text-[11px] text-white outline-none placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-white/50" />
    </label>
    <div className="flex gap-2">
      <button type="button" disabled={pendingAction !== null} onClick={() => run('approve')}
        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-[11px] font-semibold text-black transition-[background-color,opacity] duration-150 hover:bg-white/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
        {pendingAction === 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{t('approve')}
      </button>
      <button type="button" disabled={pendingAction !== null} onClick={() => run('reject')}
        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/12 px-3 text-[11px] font-semibold text-white/70 transition-[background-color,opacity] duration-150 hover:bg-white/[0.06] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
        {pendingAction === 'reject' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}{t('reject')}
      </button>
    </div>
    {error && <p role="alert" className="text-[10.5px] text-red-200">{t('actionFailed')}</p>}
  </div>;
}
