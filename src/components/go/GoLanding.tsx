'use client';

import React, { useCallback, useEffect } from 'react';
import type { LandingCatalog } from '@/src/content/landing-catalog';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
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
import { VARIANT_SECONDARY_TARGET, VARIANT_SECTIONS, type GoSectionKey, type GoVariant } from '../../go/variants';
import { ProofSection, VariantContent } from '../landing/PhaseTwoSections';

/**
 * Paid-ads landing composer. One architecture for every variant:
 * Header → Hero → Benefits → Preview → Proof → How → Pricing → Trust →
 * FAQ → Final CTA → Footer. Copy varies by variant; components do not.
 *
 * CTAs reuse the current account-state flow: guests get the signup modal,
 * signed-in visitors go to Studio (or TopUp for paid plans). Pricing cards
 * render live catalog values with the project's visibility rules intact.
 */
export default function GoLanding({ variant, catalog }: { variant: GoVariant; catalog: LandingCatalog }) {
  const locale = useLocale();
  const { user, isLoading } = useUser();
  const { openAuthModal, openTopUpModal, openPlanSignup } = useModal();
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
      if (!planId) { handlePrimaryAction(); return; }
      if (!catalog.plans.some(plan => plan.id === planId && plan.publicVisible && plan.active && ['pro', 'max'].includes(plan.planCode))) return;
      if (user) openTopUpModal({ id: planId });
      else openPlanSignup(planId);
    },
    [isLoading, user, openTopUpModal, openPlanSignup, catalog.plans, handlePrimaryAction]
  );

  const handleSecondaryAction = useCallback(() => {
    document
      .getElementById(VARIANT_SECONDARY_TARGET[variant])
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [variant]);

  /**
   * Shared homepage sections keep their own rhythm untouched; landing-only
   * compress wrappers tighten them for paid traffic without affecting the
   * homepage. Each section below still renders exactly once.
   */
  const sections: Record<GoSectionKey, React.ReactNode> = {
    benefits: <GoBenefits variant={variant} />,
    preview: <><GoPreview onPrimary={handlePrimaryAction} />{variant !== 'ai-in-dzd' && <VariantContent variant={variant} catalog={catalog} />}<ProofSection index={0} /></>,
    proof: <GoProof brands={catalog.brands} />,
    how: (
      <div className="-mt-10 -mb-14 md:-mt-12 md:-mb-16">
        <HowItWorks />
      </div>
    ),
    pricing: (
      <div className="-my-8 md:-my-12">
        {variant === 'ai-in-dzd' && <VariantContent variant={variant} catalog={catalog} />}
        <GlobalPricing catalog={catalog} onGetStarted={handlePricingAction} />
      </div>
    ),
    trust: <GoTrust gateways={catalog.gateways} />,
    faq: <GoFaq gateways={catalog.gateways} />,
  };

  return (
    <div className="landing-grid-background min-h-screen text-white antialiased">
      <LandingHeader
        user={user}
        authLoading={isLoading}
        onSignIn={() => !isLoading && openAuthModal('signin')}
        onOpenStudio={() => enterStudio()}
        onStartFree={handlePrimaryAction}
        compact
      />

      <main lang={locale}>
        <GoHero
          variant={variant}
          onPrimary={handlePrimaryAction}
          onSecondary={handleSecondaryAction}
        />
        {VARIANT_SECTIONS[variant].map((key) => (
          <React.Fragment key={key}>{sections[key]}</React.Fragment>
        ))}
        <div className="-mt-10 -mb-8 md:-mt-14 md:-mb-10">
          <FinalCta onGetStarted={handlePrimaryAction} />
        </div>
      </main>

      <GlobalFooter legalOnly />
    </div>
  );
}
