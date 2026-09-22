'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, CircleAlert, Loader2, LockKeyhole } from 'lucide-react';
import { useModal } from '@/src/context/ModalContext';

type ReturnOrder = { plan_id: string; payment_method: string; status: string; plan_name: string; amount_dzd: number };
type Result = 'checking' | 'success' | 'failure' | 'unavailable';

export default function PaymentReturnStatus({ orderId }: { orderId: string | null }) {
  const t = useTranslations('payments');
  const locale = useLocale();
  const { openTopUpModal } = useModal();
  const [result, setResult] = useState<Result>(orderId ? 'checking' : 'unavailable');
  const [order, setOrder] = useState<ReturnOrder | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = async () => {
      try {
        const response = await fetch('/api/payments/orders/' + orderId + '/status', { cache: 'no-store' });
        if (!response.ok) throw new Error('STATUS_UNAVAILABLE');
        const body = await response.json();
        if (cancelled) return;
        const current = body.order as ReturnOrder;
        setOrder(current);
        if (current.payment_method !== 'cib' && current.payment_method !== 'edahabia') setResult('unavailable');
        else if (current.status === 'approved') setResult('success');
        else if (['rejected', 'cancelled', 'expired'].includes(current.status)) setResult('failure');
        else if (++attempts < 10) timer = setTimeout(check, 3000);
        else setResult('unavailable');
      } catch { if (!cancelled) setResult('unavailable'); }
    };
    setResult('checking');
    void check();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [orderId, retry]);

  const tryAgain = () => openTopUpModal(order?.plan_id ? { id: order.plan_id } : undefined);
  return <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 text-[var(--studio-text-primary,#fff)]">
    <div className="w-full max-w-[520px] rounded-3xl border border-[var(--studio-border,#444)] bg-[var(--studio-card,#151517)] p-6 shadow-2xl sm:p-8">
      <p className="flex items-center gap-2 text-base font-semibold"><LockKeyhole className="h-5 w-5" />VANTRA</p>
      <div role="status" aria-live="polite" className="mt-8">
        {result === 'checking' ? <><Loader2 className="h-10 w-10 animate-spin" /><h1 className="mt-4 text-2xl font-semibold">{t('returnCheckingTitle')}</h1><p className="mt-3 text-base leading-relaxed text-[var(--studio-text-secondary,#bbb)]">{t('returnCheckingDescription')}</p></>
          : result === 'success' ? <><CheckCircle2 className="h-10 w-10 text-emerald-300" /><h1 className="mt-4 text-2xl font-semibold">{t('returnSuccessTitle')}</h1><p className="mt-3 text-base leading-relaxed text-[var(--studio-text-secondary,#bbb)]">{t('returnSuccessDescription')}</p></>
          : <><CircleAlert className="h-10 w-10 text-amber-300" /><h1 className="mt-4 text-2xl font-semibold">{result === 'failure' ? t('returnFailureTitle') : t('returnUnavailableTitle')}</h1><p className="mt-3 text-base leading-relaxed text-[var(--studio-text-secondary,#bbb)]">{result === 'failure' ? t('returnFailureDescription') : t('returnUnavailableDescription')}</p></>}
      </div>
      {order && <div className="mt-6 rounded-xl border border-[var(--studio-border,#444)] p-4 text-base"><div className="flex justify-between gap-3"><span className="text-[var(--studio-text-secondary,#bbb)]">{t('selectedPlan')}</span><strong>{order.plan_name}</strong></div><div className="mt-3 flex justify-between gap-3"><span className="text-[var(--studio-text-secondary,#bbb)]">{t('total')}</span><strong dir="ltr">{order.amount_dzd.toLocaleString(locale)} DA</strong></div></div>}
      {result === 'success' ? <a href="/studio" className="mt-8 flex min-h-14 w-full items-center justify-center rounded-xl bg-[var(--studio-accent,#fff)] px-5 text-base font-semibold text-[var(--studio-accent-contrast,#000)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent,#fff)]">{t('returnToStudio')}</a>
        : result === 'checking' ? null
          : <div className="mt-8 space-y-3"><button type="button" onClick={tryAgain} className="flex min-h-14 w-full items-center justify-center rounded-xl bg-[var(--studio-accent,#fff)] px-5 text-base font-semibold text-[var(--studio-accent-contrast,#000)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent,#fff)]">{t('tryAgain')}</button>{result === 'unavailable' && orderId && <button type="button" onClick={() => setRetry((value) => value + 1)} className="min-h-12 w-full rounded-xl border border-[var(--studio-border,#444)] px-4 text-base font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent,#fff)]">{t('checkAgain')}</button>}</div>}
    </div>
  </main>;
}
