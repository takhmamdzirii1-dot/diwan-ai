'use client';
import { useEffect, useRef } from 'react';
import { captureLandingAttribution } from '@/src/lib/attribution';
import { markMarketingInteraction, trackLandingEvent } from '@/src/lib/marketing-analytics';
import { analyticsInteractionId, trackProductEvent } from '@/src/lib/product-analytics';

export default function LandingTracking({ variant, locale }: { variant: 'home' | 'all-ai' | 'ai-in-dzd' | 'creators'; locale: string }) {
  const seen = useRef(false);
  const pricingSeen = useRef(false);
  const visitId = useRef('');
  const lang = locale === 'ar' || locale === 'fr' ? locale : 'en';
  useEffect(() => {
    captureLandingAttribution(variant);
    visitId.current ||= analyticsInteractionId();
    if (!seen.current) { seen.current = true; trackLandingEvent({ event: 'landing_view', variant, locale: lang }); }
    const interaction = () => {
      markMarketingInteraction();
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
  return null;
}
