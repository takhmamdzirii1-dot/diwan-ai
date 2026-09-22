'use client';

import React, { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import GlobalFooter from '../GlobalFooter';
import GlobalPricing from '../GlobalPricing';
import HowItWorks from '../landing/HowItWorks';
import FinalCta from '../landing/FinalCta';
import LandingHeader from '../landing/LandingHeader';
import GoBenefits from './GoBenefits';
import GoFaq from './GoFaq';
import GoHero from './GoHero';
import GoPreview from './GoPreview';
import GoProof from './GoProof';
import GoTrust from './GoTrust';
import { useModal } from '../../context/ModalContext';
import useUser from '../../hooks/useUser';
import { captureLandingAttribution } from '../../lib/attribution';
import { VARIANT_SECONDARY_TARGET, type GoVariant } from '../../go/variants';

/**
 * Paid-ads landing composer. One architecture for every variant:
 * Header → Hero → Benefits → Preview → Proof → How → Pricing → Trust →
 * FAQ → Final CTA → Footer. Copy varies by variant; components do not.
 *
 * CTAs reuse the current account-state flow: guests get the signup modal,
 * signed-in visitors go to Studio (or TopUp for paid plans). Pricing cards
 * render live catalog values with the project's visibility rules intact.
 */
export default function GoLanding({ variant }: { variant: GoVariant }) {
  const locale = useLocale();
  const tNav = useTranslations('go.nav');
  const { user, isLoading } = useUser();
  const { openAuthModal, openTopUpModal } = useModal();
  const router = useRouter();

  useEffect(() => {
    captureLandingAttribution(variant);
  }, [variant]);

  const enterStudio = useCallback(() => {
    router.push('/studio/chat');
  }, [router]);

  const handlePrimaryAction = useCallback(() => {
    if (isLoading) return;
    if (user) enterStudio();
    else openAuthModal('signup');
  }, [isLoading, user, enterStudio, openAuthModal]);

  const handlePricingAction = useCallback(
    (planId?: string) => {
      if (isLoading) return;
      if (user) openTopUpModal(planId ? { id: planId } : undefined);
      else openAuthModal('signup');
    },
    [isLoading, user, openTopUpModal, openAuthModal]
  );

  const handleSecondaryAction = useCallback(() => {
    document
      .getElementById(VARIANT_SECONDARY_TARGET[variant])
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [variant]);

  const navLinks = React.useMemo(
    () => [
      { id: 'how', label: tNav('how') },
      { id: 'models', label: tNav('models') },
      { id: 'pricing', label: tNav('pricing') },
      { id: 'faq', label: tNav('faq') },
    ],
    [tNav]
  );

  return (
    <div className="landing-grid-background min-h-screen text-white antialiased">
      <LandingHeader
        user={user}
        authLoading={isLoading}
        onSignIn={() => !isLoading && openAuthModal('signin')}
        onOpenStudio={() => enterStudio()}
        onStartFree={() => !isLoading && openAuthModal('signup')}
        navLinks={navLinks}
      />

      <main lang={locale}>
        <GoHero
          variant={variant}
          onPrimary={handlePrimaryAction}
          onSecondary={handleSecondaryAction}
        />
        <GoBenefits variant={variant} />
        <GoPreview onPrimary={handlePrimaryAction} />
        <GoProof />
        <HowItWorks />
        <GlobalPricing onGetStarted={handlePricingAction} />
        <GoTrust />
        <GoFaq />
        <FinalCta onGetStarted={handlePrimaryAction} />
      </main>

      <GlobalFooter />
    </div>
  );
}
