'use client';

import React, { useCallback, useState } from 'react';
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
import CinematicEnter from './landing/CinematicEnter';
import WhyVantra from './landing/WhyVantra';
import { useModal } from '../context/ModalContext';
import useUser from '../hooks/useUser';

/**
 * VANTRA — Global Landing Experience.
 * Flow: Header → Hero (interactive hook) → Partners → Showcase → Why VANTRA
 *       → Workflow → Signals → Pricing → FAQ → Final CTA → Footer.
 * Cinematic wipe bridges Landing → Studio; guest prompts are stashed and
 * prefilled inside the Studio composer after authentication.
 */
export default function OriginalLandingPage() {
  const locale = useLocale();
  const { user } = useUser();
  const { openAuthModal, openTopUpModal } = useModal();
  const router = useRouter();

  const [entering, setEntering] = useState(false);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.3 });

  /** Cinematic jump into the Studio — optionally carrying a prompt. */
  const enterStudio = useCallback(
    (prompt?: string) => {
      try {
        if (prompt) sessionStorage.setItem('vantra_pending_prompt', prompt);
      } catch {}
      setEntering(true); // CinematicEnter routes to /studio on complete
    },
    []
  );

  const handleGetStarted = () => (user ? openTopUpModal() : openAuthModal('signup'));

  return (
    <div className="min-h-screen bg-[#050505] text-white antialiased">
      {/* Scroll progress — hairline at the very top */}
      <motion.div
        style={{ scaleX: progress }}
        className={`fixed top-0 inset-x-0 h-[2px] ${locale === 'ar' ? 'origin-right' : 'origin-left'} bg-white/70 z-[95]`}
        aria-hidden="true"
      />

      <LandingHeader
        user={user}
        onSignIn={() => openAuthModal('signin')}
        onOpenStudio={() => enterStudio()}
        onStartFree={() => openAuthModal('signup')}
      />

      <HeroSection
        user={user}
        onEnterStudio={enterStudio}
        onRequireAuth={() => openAuthModal('signup')}
      />

      <PartnersSection />
      <CinematicScrollMockup />
      <WhyVantra />
      <HowItWorks />
      <Testimonials />
      <GlobalPricing onGetStarted={handleGetStarted} />
      <Faq />
      <FinalCta onGetStarted={handleGetStarted} />
      <GlobalFooter />

      {/* Cinematic Landing → Studio bridge */}
      <CinematicEnter
        active={entering}
        onComplete={() => {
          router.push('/studio');
          setEntering(false);
        }}
      />
    </div>
  );
}
