'use client';

import React, { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { LandingCatalog, GatewayAvailability } from '@/src/content/landing-catalog';
import { CREATOR_SHOWCASE, MODEL_SCREENSHOTS, LANDING_PROOF, landingCopy, usableAsset, usableProof, type LandingAsset } from '@/src/content/landing-phase-two';
import { SITE_LINKS } from '@/src/content/site';
import { paymentCopy } from './PaymentCopy';

const button = 'min-h-11 rounded-xl border border-white/15 px-4 text-sm text-white/80 transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50';
const localeKey = (locale: string) => locale === 'ar' || locale === 'fr' ? locale : 'en';

export function ProofSection({ index }: { index: number }) {
  const locale = localeKey(useLocale());
  const item = LANDING_PROOF.filter(usableProof)[index];
  if (!item) return null;
  return <figure className="mx-auto my-8 max-w-[960px] rounded-2xl border border-white/10 bg-white/[0.025] p-6" data-verified-proof>
    {'src' in item.asset ? item.type === 'video'
      ? <video controls preload="none" width={item.asset.width} height={item.asset.height} className="h-auto w-full rounded-xl" aria-label={item.caption[locale]} src={item.asset.src} />
      : <img loading="lazy" src={item.asset.src} width={item.asset.width} height={item.asset.height} alt={item.caption[locale]} className="h-auto w-full rounded-xl" />
      : <blockquote className="text-lg leading-relaxed text-white/80">{item.asset[locale]}</blockquote>}
    <figcaption className="mt-4 text-sm text-white/65">{item.caption[locale]} · <time dateTime={item.date}>{item.date}</time></figcaption>
  </figure>;
}

function AssetGallery({ assets }: { assets: readonly LandingAsset[] }) {
  const locale = localeKey(useLocale());
  const valid = assets.filter(usableAsset);
  if (!valid.length) return null;
  return <div className="mt-6 grid gap-4 sm:grid-cols-2">{valid.map(asset => <figure key={asset.src}>
    <img src={asset.src} loading="lazy" width={asset.width} height={asset.height} alt={asset.caption[locale]} className="h-auto w-full rounded-xl border border-white/10" />
    <figcaption className="mt-2 text-sm text-white/65">{asset.caption[locale]}</figcaption>
  </figure>)}</div>;
}

export function VariantContent({ variant, catalog }: { variant: string; catalog: LandingCatalog }) {
  const copy = landingCopy(useLocale());
  const [selected, setSelected] = useState(catalog.modelNames[0] ?? '');
  if (variant === 'ai-in-dzd') return <PaymentSteps gateways={catalog.gateways} />;
  return <section className="mx-auto max-w-[1120px] px-6 py-10 md:py-14">
    <h2 className="text-center text-3xl font-bold tracking-tight text-[#f5f5f5]">{variant === 'creators' ? copy.creatorTitle : copy.modelDemo}</h2>
    {variant === 'creators' ? <><ul className="mt-6 flex flex-wrap justify-center gap-3">{copy.creatorCases.map(label => <li key={label} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/75">{label}</li>)}</ul><AssetGallery assets={CREATOR_SHOWCASE} /></>
      : catalog.modelNames.length > 0 ? <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-white/10 bg-white/[0.025] p-5">
        <label className="block text-sm text-white/70" htmlFor="landing-model-demo">{copy.modelDemo}</label>
        <select id="landing-model-demo" value={selected} onChange={event => setSelected(event.target.value)} className="mt-3 min-h-11 w-full rounded-xl border border-white/15 bg-[#0b0c0e] px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">{catalog.modelNames.map(name => <option key={name}>{name}</option>)}</select>
        <p aria-live="polite" dir="auto" className="mt-5 text-xl font-semibold text-white">{selected}</p>
        <p className="mt-3 text-xs leading-relaxed text-white/65">{copy.demoNote}</p>
        <AssetGallery assets={MODEL_SCREENSHOTS} />
      </div> : null}
  </section>;
}

export function PaymentSteps({ gateways }: { gateways: GatewayAvailability }) {
  const copy = landingCopy(useLocale());
  const payment = useTranslations('payment');
  const checkout = useTranslations('payments');
  return <section data-payment-steps className="mx-auto max-w-[1120px] px-6 py-10 md:py-14">
    <h2 className="text-center text-3xl font-bold tracking-tight text-[#f5f5f5]">{copy.paymentTitle}</h2>
    <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-white/65">{paymentCopy(payment, gateways)}</p>
    <ol className="mt-6 grid gap-5 md:grid-cols-3">{copy.steps.map((step, index) => <li key={step} className="flex gap-3 border-t border-white/10 pt-4 text-sm leading-relaxed text-white/75"><span className="font-semibold text-white">{index + 1}.</span>{step}</li>)}</ol>
    <p className="mt-5 text-center text-sm text-white/65">{checkout('reviewedWithinHours')}</p>
    {SITE_LINKS.support && <a href={SITE_LINKS.support} className={button + ' mx-auto mt-3 flex w-fit items-center'}>{copy.support}</a>}
  </section>;
}

export function PricingReassurance({ gateways }: { gateways: GatewayAvailability }) {
  const copy = landingCopy(useLocale());
  const payment = useTranslations('payment');
  const checkout = useTranslations('payments');
  return <div className="mt-3 space-y-1 text-center text-[11px] leading-relaxed text-white/65" data-pricing-reassurance>
    <p>{paymentCopy(payment, gateways)}</p><p>{payment('period')}</p><p>{checkout('reviewedWithinHours')}</p>
    {SITE_LINKS.support && <a href={SITE_LINKS.support} className="inline-flex min-h-11 items-center underline underline-offset-4">{copy.support}</a>}
  </div>;
}

export function ComparePlans({ catalog }: { catalog: LandingCatalog }) {
  const locale = useLocale();
  const copy = landingCopy(locale);
  const [expanded, setExpanded] = useState(false);
  const plans = ['free', 'pro', 'max'].map(code => catalog.plans.find(plan => plan.planCode === code && plan.publicVisible));
  const values = (row: number, index: number) => {
    const plan = plans[index];
    if (!plan) return '—';
    if (row === 0) return copy.best[index];
    if (row === 1) return catalog.modelAccessCounts ? `${catalog.modelAccessCounts[plan.planCode as 'free' | 'pro' | 'max'].toLocaleString(locale)} · ${copy.models}` : copy.models;
    if (row === 2) return copy.chat[index];
    if (row === 3) return index === 0 ? copy.trial : `${plan.unifiedCredits.toLocaleString(locale)} ${copy.credits}`;
    return plan.accessPeriodDays ? `${plan.accessPeriodDays} ${copy.period}` : copy.trial;
  };
  return <div data-plan-comparison className="mx-auto mt-12 max-w-[1240px] px-6">
    <h3 className="mb-6 text-center text-2xl font-semibold text-white">{copy.compare}</h3>
    <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-white/10">
      {['Free', 'Pro', 'MAX'].map((name, index) => <div key={name} className={'min-w-0 p-3 text-center text-sm font-semibold ' + (index === 1 ? 'bg-white/[0.065] text-white' : 'text-white/70')}>{name}</div>)}
      {copy.rows.map((label, row) => <React.Fragment key={label}>{plans.map((plan, index) => <div key={`${label}-${index}`} className={(row >= 4 && !expanded ? 'hidden md:block ' : '') + 'min-w-0 border-t border-white/10 p-3 text-center text-[11px] leading-relaxed [overflow-wrap:anywhere] sm:p-4 sm:text-sm ' + (index === 1 ? 'bg-white/[0.065] text-white/85' : 'text-white/70')}>
        <span className="mb-2 block text-[10px] font-medium text-white/60 sm:text-xs">{label}</span>{values(row, index)}
      </div>)}</React.Fragment>)}
    </div>
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className={button + ' mx-auto mt-4 block md:hidden'}>{expanded ? copy.less : copy.more}</button>
  </div>;
}

/** Shared fact-based order. No refund/SLA/support guarantees invented here. */
export function useLandingFaq(gateways: GatewayAvailability) {
  const locale = useLocale();
  const copy = landingCopy(locale);
  const payment = useTranslations('payment');
  const checkout = useTranslations('payments');
  return [
    { question: copy.faq[0], answer: paymentCopy(payment, gateways) },
    { question: copy.faq[1], answer: `${checkout('reviewedWithinHours')} ${copy.steps[2]}.` },
    { question: copy.faq[2], answer: payment('period') },
    ...(SITE_LINKS.support ? [{ question: copy.faq[3], answer: <a href={SITE_LINKS.support} className="underline underline-offset-4">{copy.support}</a> }] : []),
    { question: copy.faq[4], answer: <>{copy.privacy} <a href={`/${locale}/privacy`} className="underline underline-offset-4">{copy.privacyLink}</a></> },
  ];
}
