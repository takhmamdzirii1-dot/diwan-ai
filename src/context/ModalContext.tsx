'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AuthModal from '../components/AuthModal';
import TopUpModal, { type TopUpPlan } from '../components/TopUpModal';

export interface ModalContextType {
  isAuthModalOpen: boolean;
  authMode: 'signin' | 'signup';
  openAuthModal: (mode?: 'signin' | 'signup') => void;
  closeAuthModal: () => void;
  isTopUpModalOpen: boolean;
  topUpPlan: TopUpPlan;
  openTopUpModal: (plan?: TopUpPlan) => void;
  closeTopUpModal: () => void;
}

const DEFAULT_TOPUP_PLAN: TopUpPlan = {
  name: 'Pro Creator',
  price: '4,500 DZD',
  points: '35,000 Points',
  ptsNum: 35000,
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [topUpPlan, setTopUpPlan] = useState<TopUpPlan>(DEFAULT_TOPUP_PLAN);

  const openAuthModal = useCallback((mode: 'signin' | 'signup' = 'signin') => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const openTopUpModal = useCallback((plan?: TopUpPlan) => {
    if (plan) {
      setTopUpPlan(plan);
    }
    setIsTopUpModalOpen(true);
  }, []);

  const closeTopUpModal = useCallback(() => {
    setIsTopUpModalOpen(false);
  }, []);

  // Global window listener & binding for static HTML buttons
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Attach global functions to window object
    (window as any).openAuthModal = (mode?: 'signin' | 'signup') => {
      openAuthModal(mode || 'signin');
    };

    (window as any).openTopupModal = (planKey?: string) => {
      let selectedPlan = DEFAULT_TOPUP_PLAN;
      if (planKey === 'starter') {
        selectedPlan = {
          name: 'Starter Pack',
          price: '1,500 DZD',
          points: '10,000 Points',
          ptsNum: 10000,
        };
      } else if (planKey === 'enterprise') {
        selectedPlan = {
          name: 'Enterprise / Agency',
          price: '12,000 DZD',
          points: '100,000 Points',
          ptsNum: 100000,
        };
      }
      openTopUpModal(selectedPlan);
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
      <TopUpModal
        isOpen={isTopUpModalOpen}
        onClose={closeTopUpModal}
        plan={topUpPlan}
        onSuccess={closeTopUpModal}
      />
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
      isTopUpModalOpen: false,
      topUpPlan: DEFAULT_TOPUP_PLAN,
      openTopUpModal: () => {},
      closeTopUpModal: () => {},
    };
  }
  return context;
}

export default ModalContext;
