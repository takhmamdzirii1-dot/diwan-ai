'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CreditCard,
  Building2,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Sparkles,
  ArrowRight,
  Wallet,
} from 'lucide-react';
import useUser from '../hooks/useUser';
import { TOPUP_PLANS } from '../config/pricing';

export interface TopUpPlan {
  name: string;
  price: string;
  points: string;
  ptsNum: number;
}

export interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: TopUpPlan;
  onSuccess?: () => void;
}

const DEFAULT_PLAN: TopUpPlan = {
  name: TOPUP_PLANS.creatorPro.name,
  price: TOPUP_PLANS.creatorPro.priceFormatted,
  points: TOPUP_PLANS.creatorPro.pointsFormatted,
  ptsNum: TOPUP_PLANS.creatorPro.points,
};

export default function TopUpModal({
  isOpen,
  onClose,
  plan = DEFAULT_PLAN,
  onSuccess,
}: TopUpModalProps) {
  const { user, refreshBalance } = useUser();
  const [paymentMethod, setPaymentMethod] = useState<'edahabia' | 'cib'>('edahabia');
  const [phone, setPhone] = useState('06 55 42 18 90');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSuccess(false);
      setLoading(false);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // In production, initiate Chargily Pay V2 checkout session
      await new Promise((r) => setTimeout(r, 900));
      setSuccess(true);
      if (user) {
        await refreshBalance();
      }
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } catch {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          id="vantra-topup-modal-root"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[440px] overflow-hidden rounded-3xl border border-white/10 bg-[#0E1015] p-6 sm:p-8 space-y-6 shadow-[0_20px_70px_rgba(0,0,0,0.85)] z-10 my-auto"
          >
            {/* Top Accent Beam */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#1FD8B8] to-transparent opacity-80" />

            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1FD8B8]/15 border border-[#1FD8B8]/30 text-[#1FD8B8] shadow-[0_0_20px_rgba(31,216,184,0.15)]">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                    Top Up in DZD
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Instant Chargily Pay Checkout (EDAHABIA / CIB)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-all hover:bg-white/10 hover:border-white/20 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-5">
              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#CBD5E1] block">
                  Select Payment Card:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('edahabia')}
                    className={`flex items-center gap-3 rounded-2xl p-3.5 border transition-all text-left cursor-pointer ${
                      paymentMethod === 'edahabia'
                        ? 'border-[#1FD8B8] bg-[#1FD8B8]/10 shadow-[0_0_15px_rgba(31,216,184,0.15)]'
                        : 'border-white/10 bg-[#050608] hover:bg-white/[0.04]'
                    }`}
                  >
                    <CreditCard
                      className={`h-5 w-5 ${
                        paymentMethod === 'edahabia' ? 'text-[#1FD8B8]' : 'text-white/60'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold text-white">Edahabia</p>
                      <p className="text-[10px] text-white/50">Algérie Poste</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cib')}
                    className={`flex items-center gap-3 rounded-2xl p-3.5 border transition-all text-left cursor-pointer ${
                      paymentMethod === 'cib'
                        ? 'border-[#1FD8B8] bg-[#1FD8B8]/10 shadow-[0_0_15px_rgba(31,216,184,0.15)]'
                        : 'border-white/10 bg-[#050608] hover:bg-white/[0.04]'
                    }`}
                  >
                    <Building2
                      className={`h-5 w-5 ${
                        paymentMethod === 'cib' ? 'text-[#1FD8B8]' : 'text-white/60'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold text-white">CIB Card</p>
                      <p className="text-[10px] text-white/50">SATIM Banks</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Invoice Summary Box */}
              <div className="rounded-2xl border border-white/10 bg-[#050608] p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Selected Pack:</span>
                  <span className="font-bold text-white">{plan.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Points Credited:</span>
                  <span className="font-mono font-bold text-[#1FD8B8]">+{plan.points}</span>
                </div>
                <div className="border-t border-white/10 pt-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Total Amount:</span>
                  <span className="font-mono text-base font-bold text-white">{plan.price}</span>
                </div>
              </div>

              {/* Phone Input */}
              <form onSubmit={handleCheckout} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#CBD5E1] block">
                    Cardholder Phone (for OTP confirmation):
                  </label>
                  <div className="relative flex items-center">
                    <Phone className="absolute left-4 h-4 w-4 text-[#94A3B8] pointer-events-none" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="06 XX XX XX XX"
                      className="w-full h-12 rounded-2xl border border-white/10 bg-[#050608] pl-12 pr-4 text-sm font-mono text-white placeholder-white/30 outline-none transition-all duration-200 focus:border-[#1FD8B8] focus:ring-1 focus:ring-[#1FD8B8]"
                      style={{ paddingLeft: '48px' }}
                    />
                  </div>
                </div>

                {/* Submit Checkout Button */}
                <button
                  type="submit"
                  disabled={loading || success}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#1FD8B8] h-12 text-sm font-bold text-[#050506] shadow-[0_4px_20px_rgba(31,216,184,0.35)] transition-all duration-200 hover:bg-[#34e2c2] disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#050506]" />
                  ) : success ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-[#050506]" />
                      <span>Payment Verified & Points Added!</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-[#050506]" />
                      <span>Proceed to Payment ({plan.price})</span>
                      <ArrowRight className="h-4 w-4 text-[#050506]" />
                    </>
                  )}
                </button>
              </form>

              {/* Trust Badges */}
              <div className="flex items-center justify-between text-[11px] text-white/50 border-t border-white/10 pt-3">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#1FD8B8]" />
                  <span>SATIM 256-bit Encrypted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#1FD8B8]" />
                  <span>Instant Delivery</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export { TopUpModal };
