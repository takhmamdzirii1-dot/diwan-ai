'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AuthModal from '../components/AuthModal';
import TopUpModal, { type TopUpPlan } from '../components/TopUpModal';
import { StudioThemeProvider } from './StudioThemeContext';
import useUser from '../hooks/useUser';
import { LANDING_PLAN_INTENT_KEY, saveLandingPlan, takeLandingPlan } from '../content/landing-plan-intent';
import { usePathname } from 'next/navigation';
import { finishSignupTracking } from '../lib/marketing-analytics';

export interface ModalContextType {
  isAuthModalOpen: boolean;
  authMode: 'signin' | 'signup';
  openAuthModal: (mode?: 'signin' | 'signup') => void;
  openPlanSignup: (planId: string) => void;
  closeAuthModal: () => void;
  isTopUpModalOpen: boolean;
  topUpPlan: TopUpPlan;
  openTopUpModal: (plan?: TopUpPlan) => void;
  closeTopUpModal: () => void;
}

const DEFAULT_TOPUP_PLAN: TopUpPlan = {
  id: '',
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children, checkoutThemeLocale }: { children: React.ReactNode; checkoutThemeLocale?: string }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [topUpPlan, setTopUpPlan] = useState<TopUpPlan>(DEFAULT_TOPUP_PLAN);
  const { user } = useUser();
  const pathname = usePathname();
  useEffect(() => { if (user) void finishSignupTracking(); }, [user?.id, pathname]);

  const openAuthModal = useCallback((mode: 'signin' | 'signup' = 'signin') => {
    try { localStorage.removeItem(LANDING_PLAN_INTENT_KEY); } catch {}
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const openPlanSignup = useCallback((planId: string) => {
    try { saveLandingPlan(localStorage, planId); } catch {}
    setAuthMode('signup');
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const openTopUpModal = useCallback((plan?: TopUpPlan) => {
    setTopUpPlan(plan ?? DEFAULT_TOPUP_PLAN);
    setIsTopUpModalOpen(true);
  }, []);

  const closeTopUpModal = useCallback(() => {
    setIsTopUpModalOpen(false);
  }, []);

  useEffect(() => {
    // AuthModal redirects into Studio. Consume there, not in the marketing
    // provider that is about to unmount during the auth redirect.
    if (!user || !pathname?.startsWith('/studio/')) return;
    try {
      const planId = takeLandingPlan(localStorage);
      if (planId) {
        setIsAuthModalOpen(false);
        openTopUpModal({ id: planId });
      }
    } catch {}
  }, [user?.id, pathname, openTopUpModal]);

  // Global window listener & binding for static HTML buttons
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Attach global functions to window object
    (window as any).openAuthModal = (mode?: 'signin' | 'signup') => {
      openAuthModal(mode || 'signin');
    };

    (window as any).openTopupModal = () => {
      openTopUpModal();
    };

    const handleCustomAuth = (e: any) => {
      const mode = e.detail?.mode || 'signin';
      openAuthModal(mode);
    };

    window.addEventListener('vantra-open-auth', handleCustomAuth);
    return () => {
      window.removeEventListener('vantra-open-auth', handleCustomAuth);
    };
  }, [openAuthModal, openTopUpModal]);

  return (
    <ModalContext.Provider
      value={{
        isAuthModalOpen,
        authMode,
        openAuthModal,
        openPlanSignup,
        closeAuthModal,
        isTopUpModalOpen,
        topUpPlan,
        openTopUpModal,
        closeTopUpModal,
      }}
    >
      {children}

      {/* Permanently Mounted Auth Modal with z-[9999] */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        initialMode={authMode}
        onSuccess={closeAuthModal}
      />

      {/* Permanently Mounted Top-Up Modal */}
      {checkoutThemeLocale ? <StudioThemeProvider locale={checkoutThemeLocale} modalOnly><TopUpModal
        isOpen={isTopUpModalOpen}
        onClose={closeTopUpModal}
        plan={topUpPlan}
        onSuccess={closeTopUpModal}
      /></StudioThemeProvider> : <TopUpModal
        isOpen={isTopUpModalOpen}
        onClose={closeTopUpModal}
        plan={topUpPlan}
        onSuccess={closeTopUpModal}
      />}
    </ModalContext.Provider>
  );
}

export function useModal(): ModalContextType {
  const context = useContext(ModalContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      isAuthModalOpen: false,
      authMode: 'signin',
      openAuthModal: (mode?: 'signin' | 'signup') => {
        if (typeof window !== 'undefined' && (window as any).openAuthModal) {
          (window as any).openAuthModal(mode);
        }
      },
      closeAuthModal: () => {},
      openPlanSignup: () => {},
      isTopUpModalOpen: false,
      topUpPlan: DEFAULT_TOPUP_PLAN,
      openTopUpModal: () => {},
      closeTopUpModal: () => {},
    };
  }
  return context;
}

export default ModalContext;
