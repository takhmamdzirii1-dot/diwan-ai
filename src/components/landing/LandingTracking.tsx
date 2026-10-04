'use client';
import { useEffect, useRef, useState } from 'react';
import { captureLandingAttribution } from '@/src/lib/attribution';
import { CONSENT_KEY, markMarketingInteraction, setMarketingConsent, trackLandingEvent } from '@/src/lib/marketing-analytics';
import { analyticsInteractionId, productAnalyticsConfigured, trackProductEvent } from '@/src/lib/product-analytics';

const consentCopy = {
  en: ['Allow optional analytics and advertising measurement?', 'Allow', 'Not now'],
  fr: ['Autoriser la mesure facultative des visites et de la publicité ?', 'Autoriser', 'Pas maintenant'],
  ar: ['السماح بقياس الزيارات والإعلانات الاختياري؟', 'السماح', 'ليس الآن'],
};
// Retained pending cleanup approval. Meta consent helpers/state are NOT removed.
const consentPromptEnabled = false;

export default function LandingTracking({ variant, locale }: { variant: 'home' | 'all-ai' | 'ai-in-dzd' | 'creators'; locale: string }) {
  const seen = useRef(false);
  const pricingSeen = useRef(false);
  const visitId = useRef('');
  const [showConsent, setShowConsent] = useState(false);
  const lang = locale === 'ar' || locale === 'fr' ? locale : 'en';
  useEffect(() => {
    captureLandingAttribution(variant);
    visitId.current ||= analyticsInteractionId();
    if (!seen.current) { seen.current = true; trackLandingEvent({ event: 'landing_view', variant, locale: lang }); }
    const interaction = () => {
      markMarketingInteraction();
      if (consentPromptEnabled && (productAnalyticsConfigured() || /^\d{5,30}$/.test(process.env.NEXT_PUBLIC_META_PIXEL_ID ?? ''))) {
        try { if (!localStorage.getItem(CONSENT_KEY)) setShowConsent(true); } catch {}
      }
    };
    window.addEventListener('pointerdown', interaction, { once: true, passive: true });
    window.addEventListener('keydown', interaction, { once: true });
    const pricing = document.getElementById('pricing');
    const observer = pricing && typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      if (!pricingSeen.current && entries.some(entry => entry.isIntersecting)) {
        pricingSeen.current = true;
        trackProductEvent('pricing_view', visitId.current, { landing_variant: variant, locale: lang });
      }
    }, { threshold: 0.1 }) : null;
    if (pricing) observer?.observe(pricing);
    return () => { observer?.disconnect(); window.removeEventListener('pointerdown', interaction); window.removeEventListener('keydown', interaction); };
  }, [variant, lang]);
  if (!showConsent) return null;
  const choose = (value: boolean) => { setMarketingConsent(value); setShowConsent(false); };
  return <aside dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-label={consentCopy[lang][0]}
    className="fixed bottom-4 inset-x-4 z-[100] mx-auto flex max-w-lg flex-wrap items-center justify-center gap-3 rounded-xl border border-white/15 bg-zinc-950 p-4 text-sm text-white shadow-sm">
    <p>{consentCopy[lang][0]}</p>
    <button type="button" onClick={() => choose(true)} className="min-h-11 rounded-lg border border-white/30 px-4 focus-visible:outline-2 focus-visible:outline-white">{consentCopy[lang][1]}</button>
    <button type="button" onClick={() => choose(false)} className="min-h-11 rounded-lg px-4 text-white/80 focus-visible:outline-2 focus-visible:outline-white">{consentCopy[lang][2]}</button>
  </aside>;
}
