'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock3, Image as ImageIcon, ShieldCheck, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useModal } from '@/src/context/ModalContext';
import type { PaymentPlan } from '@/lib/payments/types';
import type { StudioAccessState } from '@/lib/access/trial-state';
import { trackFunnelEvent } from '@/src/lib/funnel-analytics';

type Offer = 'pro' | 'lite' | 'renewal';

export default function TrialPaywall({
  access,
  purchasedBalance = 0,
  media,
}: {
  access: StudioAccessState;
  purchasedBalance?: number;
  media?: 'image' | 'video';
}) {
  const t = useTranslations('studio.paywall');
  const { openTopUpModal } = useModal();
  const returning = access.kind === 'paid_lapsed';
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [lite, setLite] = useState<PaymentPlan | null>(null);
  const [offer, setOffer] = useState<Offer>(returning ? 'renewal' : 'pro');
  const [declined, setDeclined] = useState(false);
  const pro = useMemo(() => plans.find((plan) => plan.planCode === 'pro') ?? null, [plans]);
  const renewal = useMemo(() => plans.find((plan) => plan.id === access.paidPlanId) ?? null, [plans, access.paidPlanId]);
  const selected = offer === 'lite' ? lite : offer === 'renewal' ? renewal : pro;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/payments/plans', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null),
      returning ? fetch('/api/payments/retention', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null) : Promise.resolve(null),
    ]).then(([catalog, retention]) => {
      if (cancelled) return;
      const next = (catalog?.plans ?? []) as PaymentPlan[];
      const retentionPlan = retention?.liteOffer as PaymentPlan | null | undefined;
      setPlans(retentionPlan ? [...next, retentionPlan] : next);
    });
    return () => { cancelled = true; };
  }, [returning]);

  useEffect(() => {
    const surface = media ? `${media}_exhausted` : access.kind;
    void trackFunnelEvent('paywall_shown', surface, { surface });
  }, [access.kind, media]);

  const declinePro = async () => {
    await trackFunnelEvent('pro_declined', 'free_trial_expired', { surface: 'studio' });
    const response = await fetch('/api/payments/retention', { cache: 'no-store' });
    const body = response.ok ? await response.json() : null;
    const next = body?.liteOffer as PaymentPlan | null | undefined;
    if (next) {
      setLite(next);
      setOffer('lite');
      void trackFunnelEvent('lite_shown', 'free_trial_expired', { surface: 'studio' });
    } else {
      setDeclined(true);
    }
  };

  const declineLite = async () => {
    await trackFunnelEvent('lite_declined', 'free_trial_expired', { surface: 'studio' });
    setDeclined(true);
  };

  const activate = () => {
    if (!selected) return;
    const event = selected.planCode === 'lite' ? 'lite_accepted' : 'pro_accepted';
    if (!returning) void trackFunnelEvent(event, 'free_trial_expired', { planId: selected.id, planCode: selected.planCode });
    openTopUpModal({ id: selected.id });
  };

  const Icon = media === 'image' ? ImageIcon : media === 'video' ? Video : Clock3;
  const title = media ? t(`${media}ExhaustedTitle`) : returning ? t('reactivateTitle') : t('expiredTitle');
  const support = media ? t(`${media}ExhaustedSupport`) : returning ? t('reactivateSupport') : t('expiredSupport');

  return <div className="flex h-full min-h-0 items-center justify-center overflow-y-auto px-5 py-10">
    <section className="w-full max-w-[520px] rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-card)] p-5 shadow-[var(--studio-shadow)] sm:p-7" aria-labelledby="trial-paywall-title">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface-raised)] text-[var(--studio-text-primary)]"><Icon className="h-5 w-5" /></div>
      <h1 id="trial-paywall-title" className="mt-5 text-2xl font-semibold tracking-tight text-[var(--studio-text-primary)]">{title}</h1>
      <p className="mt-2 text-[15px] leading-6 text-[var(--studio-text-secondary)]">{support}</p>
      {returning && purchasedBalance > 0 && <p className="mt-4 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-recessed)] p-3 text-sm text-[var(--studio-text-secondary)]">{t('bankedCredits', { credits: purchasedBalance.toLocaleString() })}</p>}

      {!declined && <div className="mt-6 rounded-xl border-2 border-[var(--studio-border-strong)] bg-[var(--studio-surface-raised)] p-4">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--studio-text-muted)]">{returning ? t('reactivation') : t('recommended')}</p><h2 className="mt-1 text-xl font-semibold text-[var(--studio-text-primary)]">{selected?.name ?? (offer === 'lite' ? 'Lite' : access.paidPlanName ?? 'Pro')}</h2></div>
          {selected && <strong dir="ltr" className="text-base text-[var(--studio-text-primary)]">{selected.priceDzd.toLocaleString()} DA</strong>}
        </div>
        {selected && <p className="mt-2 text-sm text-[var(--studio-text-secondary)]">{t('credits', { credits: selected.unifiedCredits.toLocaleString() })}</p>}
        <div className="mt-4 flex items-center gap-2 text-xs text-[var(--studio-text-muted)]"><ShieldCheck className="h-4 w-4" />{t('oneTimeActivation')}</div>
      </div>}

      {declined ? <p role="status" className="mt-6 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-recessed)] p-4 text-sm leading-6 text-[var(--studio-text-secondary)]">{t('stillLocked')}</p> : <>
        <button type="button" disabled={!selected} onClick={activate} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--studio-accent)] px-4 text-sm font-semibold text-[var(--studio-accent-contrast)] transition-opacity hover:opacity-90 disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]">
          {returning ? t('reactivate', { plan: selected?.name ?? access.paidPlanName ?? '' }) : t(offer === 'lite' ? 'activateLite' : 'activatePro')}<ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </button>
        {!returning && !media && <button type="button" onClick={offer === 'lite' ? declineLite : declinePro} className="mt-2 min-h-12 w-full rounded-xl text-sm font-medium text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]">{t('maybeLater')}</button>}
      </>}
    </section>
  </div>;
}
