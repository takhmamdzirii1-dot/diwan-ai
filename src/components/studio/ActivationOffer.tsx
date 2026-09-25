'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Loader2, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useModal } from '@/src/context/ModalContext';
import type { PaymentPlan } from '@/lib/payments/types';
import type { StudioModality } from '@/src/config/studio-registry';
import type { ModelPlanCode } from '@/lib/models/plan-entitlements';
import { trackFunnelEvent } from '@/src/lib/funnel-analytics';

export type ActivationReason = 'free_access_restricted' | 'free_media_expired' | 'image_allowance_exhausted' | 'video_allowance_exhausted'
  | 'video_duration_limit' | 'lite_video_duration_limit' | 'model_locked' | 'model_trial_exhausted' | 'paid_lapsed';
export type ActivationPrompt = { reason: ActivationReason; modality: StudioModality; modelId?: string; modelName?: string; currentPlan: ModelPlanCode; requiredPlan?: ModelPlanCode | null; renewalPlanId?: string | null; renewalPlanName?: string | null };

export default function ActivationOffer({ prompt, onClose }: { prompt: ActivationPrompt | null; onClose: () => void }) {
  const t = useTranslations('studio.paywall');
  const { openTopUpModal } = useModal();
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [lite, setLite] = useState<PaymentPlan | null>(null);
  const [offer, setOffer] = useState<'pro' | 'lite' | 'renewal'>('pro');
  const [loading, setLoading] = useState(false);
  const pro = useMemo(() => plans.find((plan) => plan.planCode === 'pro') ?? null, [plans]);
  const renewal = useMemo(() => plans.find((plan) => plan.id === prompt?.renewalPlanId) ?? null, [plans, prompt?.renewalPlanId]);
  const selected = offer === 'lite' ? lite : offer === 'renewal' ? renewal : pro;
  const closeOffer = useCallback(() => {
    if (prompt && offer === 'lite') {
      void trackFunnelEvent('lite_declined', `media:${prompt.reason}`, { surface: 'studio', modality: prompt.modality });
    }
    onClose();
  }, [offer, onClose, prompt]);

  useEffect(() => {
    if (!prompt) return;
    setOffer(prompt.reason === 'paid_lapsed' ? 'renewal' : 'pro'); setLite(null); setLoading(true);
    Promise.all([
      fetch('/api/payments/plans', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null),
      prompt.reason === 'paid_lapsed' ? fetch('/api/payments/retention', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null) : Promise.resolve(null),
    ]).then(([catalog, retention]) => {
      const base = (catalog?.plans ?? []) as PaymentPlan[];
      const retentionLite = retention?.liteOffer as PaymentPlan | null | undefined;
      setPlans(retentionLite ? [...base, retentionLite] : base);
    }).finally(() => setLoading(false));
    const key = `${prompt.reason}:${prompt.modality}:${prompt.modelId ?? 'media'}`;
    void trackFunnelEvent('media_upgrade_prompt_shown', key, { model: prompt.modelId ?? '', modality: prompt.modality, currentPlan: prompt.currentPlan, requiredPlan: prompt.requiredPlan ?? '', accessState: prompt.reason });
    void trackFunnelEvent('paywall_shown', `media:${key}`, { surface: 'studio_media', modality: prompt.modality, accessState: prompt.reason });
  }, [prompt]);

  useEffect(() => {
    if (!prompt) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeOffer(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [closeOffer, prompt]);

  const anotherOption = async () => {
    if (!prompt) return;
    setLoading(true);
    await trackFunnelEvent('pro_declined', `media:${prompt.reason}`, { surface: 'studio', modality: prompt.modality, model: prompt.modelId ?? '' });
    const response = await fetch('/api/payments/retention', { cache: 'no-store' });
    const body = response.ok ? await response.json() : null;
    const next = body?.liteOffer as PaymentPlan | null | undefined;
    if (next) { setLite(next); setOffer('lite'); void trackFunnelEvent('lite_shown', `media:${prompt.reason}`, { surface: 'studio', modality: prompt.modality }); }
    setLoading(false);
  };
  const activate = () => {
    if (!selected || !prompt) return;
    if (prompt.reason !== 'paid_lapsed') {
      void trackFunnelEvent(selected.planCode === 'lite' ? 'lite_accepted' : 'pro_accepted', `media:${prompt.reason}`, { planId: selected.id, planCode: selected.planCode, modality: prompt.modality });
    }
    onClose(); openTopUpModal({ id: selected.id });
  };
  const title = !prompt ? '' : prompt.reason === 'free_access_restricted' ? t('freeAccessRestrictedTitle') : prompt.reason === 'free_media_expired' ? t('mediaExpiredTitle') : prompt.reason === 'image_allowance_exhausted' ? t('imageExhaustedTitle') : prompt.reason === 'video_allowance_exhausted' ? t('videoExhaustedTitle') : prompt.reason === 'video_duration_limit' ? t('videoDurationTitle') : prompt.reason === 'lite_video_duration_limit' ? t('liteVideoDurationTitle') : prompt.reason === 'model_trial_exhausted' ? t('modelTrialExhaustedTitle', { model: prompt.modelName ?? '' }) : prompt.reason === 'paid_lapsed' ? t('reactivateTitle') : t('modelLockedTitle', { model: prompt.modelName ?? '' });
  const body = !prompt ? '' : prompt.reason === 'free_access_restricted' ? t('freeAccessRestrictedSupport') : prompt.reason === 'free_media_expired' || prompt.reason.endsWith('_exhausted') ? t('mediaExpiredSupport') : prompt.reason === 'video_duration_limit' ? t('videoDurationSupport') : prompt.reason === 'lite_video_duration_limit' ? t('liteVideoDurationSupport') : prompt.reason === 'paid_lapsed' ? t('reactivateSupport') : t('modelLockedSupport', { plan: prompt.requiredPlan ?? 'Pro' });

  return <AnimatePresence>{prompt && <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="activation-title">
    <motion.button type="button" aria-label={t('close')} onClick={closeOffer} className="absolute inset-0 bg-[var(--studio-overlay)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
    <motion.div initial={{ opacity: 0, y: 18, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.985 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} className="relative w-full rounded-t-2xl border border-[var(--studio-border)] bg-[var(--studio-popover)] p-5 text-[var(--studio-text-primary)] shadow-[var(--studio-shadow)] sm:max-w-[480px] sm:rounded-2xl sm:p-6">
      <button type="button" onClick={closeOffer} aria-label={t('close')} className="absolute end-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]"><X className="h-4 w-4" /></button>
      <h2 id="activation-title" className="pe-12 text-xl font-semibold tracking-tight">{title}</h2><p className="mt-2 text-sm leading-6 text-[var(--studio-text-secondary)]">{body}</p>
      <div className="mt-5 rounded-xl border-2 border-[var(--studio-border-strong)] bg-[var(--studio-surface-raised)] p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--studio-text-muted)]">{offer === 'renewal' ? t('reactivation') : t('recommended')}</p><h3 className="mt-1 text-lg font-semibold">{selected?.name ?? (offer === 'lite' ? 'Lite' : prompt.renewalPlanName ?? 'Pro')}</h3></div>{selected && <strong dir="ltr" className="text-sm">{selected.priceDzd.toLocaleString()} DA</strong>}</div>{selected && <p className="mt-2 text-sm text-[var(--studio-text-secondary)]">{t('credits', { credits: selected.unifiedCredits.toLocaleString() })}</p>}<p className="mt-3 flex items-center gap-2 text-xs text-[var(--studio-text-muted)]"><ShieldCheck className="h-4 w-4" />{t('oneTimeActivation')}</p></div>
      <button type="button" disabled={!selected || loading} onClick={activate} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--studio-accent)] px-4 text-sm font-semibold text-[var(--studio-accent-contrast)] hover:opacity-90 disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : offer === 'lite' ? t('activateLite') : offer === 'renewal' ? t('reactivate', { plan: selected?.name ?? prompt.renewalPlanName ?? '' }) : t('activatePro')} {!loading && <ArrowRight className="h-4 w-4 rtl:rotate-180" />}</button>
      {offer === 'pro' && prompt.reason !== 'paid_lapsed' && <button type="button" disabled={loading} onClick={anotherOption} className="mt-2 min-h-12 w-full rounded-xl text-sm font-medium text-[var(--studio-text-secondary)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]">{t('seeAnotherOption')}</button>}
    </motion.div>
  </div>}</AnimatePresence>;
}
