'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Clock3, Loader2 } from 'lucide-react';
import { useModal } from '@/src/context/ModalContext';
import type { PaymentOrder } from '@/lib/payments/types';

export default function PaymentStatusList({ enabled }: { enabled: boolean }) {
  const t = useTranslations('payments');
  const { openTopUpModal } = useModal();
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const response = await fetch('/api/payments/orders');
      const body = await response.json();
      if (!response.ok) throw new Error('unavailable');
      setOrders(body.orders ?? []);
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    } finally { setLoading(false); }
  }, [enabled]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const handler = () => void load();
    window.addEventListener('vantra-payment-updated', handler);
    return () => window.removeEventListener('vantra-payment-updated', handler);
  }, [load]);

  return <section className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-[12px] font-medium text-white/70">{t('paymentStatus')}</h3>
      <button type="button" onClick={() => openTopUpModal()} className="h-9 rounded-xl bg-white px-3.5 text-[11.5px] font-semibold text-black transition-[background-color] duration-150 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">{t('topUpAction')}</button>
    </div>
    {loading ? <div role="status" className="flex h-16 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02]"><Loader2 className="h-4 w-4 animate-spin text-white/45" /><span className="sr-only">{t('loadingOrders')}</span></div>
      : unavailable ? <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-[11.5px] text-white/45">{t('ordersUnavailable')}</p>
      : orders.length ? <div className="space-y-2">{orders.slice(0, 5).map((order) => <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-start"><span className="min-w-0"><span className="block truncate text-[11.5px] text-white/70">{order.plan_name}</span><code dir="ltr" className="block truncate text-[9.5px] text-white/35">{order.payment_reference}</code></span><span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/55"><Clock3 className="h-3 w-3" />{t.has(`status.${order.status}`) ? t(`status.${order.status}`) : order.status}</span></div>)}</div>
      : <p className="rounded-xl border border-dashed border-white/[0.08] p-4 text-center text-[11.5px] text-white/40">{t('noOrders')}</p>}
  </section>;
}
