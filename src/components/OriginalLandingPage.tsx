'use client';

import React, { useCallback } from 'react';
import type { LandingCatalog } from '@/src/content/landing-catalog';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { motion, useScroll, useSpring } from 'framer-motion';
import { CinematicScrollMockup } from '@/components/ui/cinematic-scroll-mockup';
import HeroSection from './HeroSection';
import HowItWorks from './landing/HowItWorks';
import Testimonials from './landing/Testimonials';
import GlobalPricing from './GlobalPricing';
import Faq from './landing/Faq';
import FinalCta from './landing/FinalCta';
import PartnersSection from './landing/PartnersSection';
import GlobalFooter from './GlobalFooter';
import LandingHeader from './landing/LandingHeader';
import WhyVantra from './landing/WhyVantra';
import { useModal } from '../context/ModalContext';
import useUser from '../hooks/useUser';
import { ProofSection } from './landing/PhaseTwoSections';

/**
 * VANTRA — Global Landing Experience.
 * Flow: Header → Hero (interactive hook) → Partners → Showcase → Why VANTRA
 *       → Workflow → Signals → Pricing → FAQ → Final CTA → Footer.
 * Cinematic wipe bridges Landing → Studio; guest prompts are stashed and
 * prefilled inside the Studio composer after authentication.
 */
export default function OriginalLandingPage({ catalog }: { catalog: LandingCatalog }) {
  const locale = useLocale();
  const { user, isLoading } = useUser();
  const { openAuthModal, openTopUpModal, openPlanSignup } = useModal();
  const router = useRouter();

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.3 });

  /** Cinematic jump into the Studio — optionally carrying a prompt. */
  const enterStudio = useCallback(
    (prompt?: string) => {
      try {
        if (prompt) sessionStorage.setItem('vantra_pending_prompt', prompt);
      } catch {}
      router.push('/studio/chat');
    },
    [router]
  );

  const handlePricingAction = (planId?: string) => {
    if (isLoading) return;
    if (!planId) { handlePrimaryAction(); return; }
    if (!catalog.plans.some(plan => plan.id === planId && plan.publicVisible && plan.active && ['pro', 'max'].includes(plan.planCode))) return;
    if (user) openTopUpModal({ id: planId });
    else openPlanSignup(planId);
  };

  const handlePrimaryAction = () => {
    if (isLoading) return;
    if (user) enterStudio();
    else openAuthModal('signup');
  };

  return (
    <div className="landing-grid-background min-h-screen text-white antialiased">
      {/* Scroll progress — hairline at the very top */}
      <motion.div
        style={{ scaleX: progress }}
        className={`fixed top-0 inset-x-0 h-[2px] ${locale === 'ar' ? 'origin-right' : 'origin-left'} bg-white/70 z-[95]`}
        aria-hidden="true"
      />

      <LandingHeader
        user={user}
        authLoading={isLoading}
        onSignIn={() => !isLoading && openAuthModal('signin')}
        onOpenStudio={() => enterStudio()}
        onStartFree={() => !isLoading && openAuthModal('signup')}
      />

      <HeroSection
        user={user}
        authLoading={isLoading}
        onEnterStudio={enterStudio}
        onRequireAuth={() => !isLoading && openAuthModal('signup')}
      />

      <PartnersSection brands={catalog.brands} />
      <CinematicScrollMockup />
      <ProofSection index={0} />
      <WhyVantra catalog={catalog} />
      <HowItWorks />
      <Testimonials />
      <GlobalPricing catalog={catalog} onGetStarted={handlePricingAction} />
      <Faq gateways={catalog.gateways} />
      <FinalCta onGetStarted={handlePrimaryAction} />
      <GlobalFooter />
    </div>
  );
}
