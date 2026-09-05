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

const getVisiblePrice = (price: string) => price.replace(/\s*DZD\b/gi, ' DA');
const getVisibleCredits = (points: string) => points.replace(/\s*Points\b/gi, '');
const getVisiblePackName = (name: string) =>
  name === TOPUP_PLANS.creatorPro.name ? 'Pro Creator' : name;

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
  const visiblePrice = getVisiblePrice(plan.price);
  const visibleCredits = getVisibleCredits(plan.points);
  const visiblePackName = getVisiblePackName(plan.name);

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
          className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto p-3 sm:p-6"
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
            className="relative z-10 my-auto max-h-[calc(100svh-24px)] w-full max-w-[460px] space-y-6 overflow-y-auto rounded-3xl border border-white/[0.1] bg-[#0a0a0b] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.78)] sm:max-h-[calc(100svh-48px)] sm:p-7"
          >
            {/* Top Accent Beam */}
            <div className="absolute inset-x-[18%] top-0 h-px bg-white/30" />

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] text-white/80">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="min-w-0 space-y-1">
                  <h3 className="text-xl font-bold tracking-tight text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                    Top Up in DA
                  </h3>
                  <p className="text-xs leading-relaxed text-white/45">
                    Secure local checkout with Edahabia or CIB.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-transparent text-white/55 transition-[background-color,border-color,color] duration-200 hover:border-white/20 hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label="Close top up dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-5">
              {/* Payment Method Selector */}
              <fieldset className="space-y-2.5">
                <legend className="text-xs font-medium text-white/65">
                  Payment method
                </legend>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('edahabia')}
                    aria-pressed={paymentMethod === 'edahabia'}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 text-start transition-[background-color,border-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                      paymentMethod === 'edahabia'
                        ? 'border-white/35 bg-white/[0.08]'
                        : 'border-white/[0.08] bg-white/[0.025] hover:border-white/[0.16] hover:bg-white/[0.04]'
                    }`}
                  >
                    <CreditCard
                      className={`h-5 w-5 ${
                        paymentMethod === 'edahabia' ? 'text-[#FFFFFF]' : 'text-white/60'
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
                    aria-pressed={paymentMethod === 'cib'}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 text-start transition-[background-color,border-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                      paymentMethod === 'cib'
                        ? 'border-white/35 bg-white/[0.08]'
                        : 'border-white/[0.08] bg-white/[0.025] hover:border-white/[0.16] hover:bg-white/[0.04]'
                    }`}
                  >
                    <Building2
                      className={`h-5 w-5 ${
                        paymentMethod === 'cib' ? 'text-[#FFFFFF]' : 'text-white/60'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold text-white">CIB Card</p>
                      <p className="text-[10px] text-white/50">SATIM Banks</p>
                    </div>
                  </button>
                </div>
              </fieldset>

              {/* Invoice Summary Box */}
              <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                <div className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-white/45">Selected Pack:</span>
                  <span className="text-end font-semibold text-white/90">{visiblePackName}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-white/45">Credits Added:</span>
                  <span className="text-end font-mono font-semibold text-white/85">+{visibleCredits} Credits</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-white/[0.08] pt-3">
                  <span className="text-xs font-medium text-white/60">Total:</span>
                  <span className="font-mono text-base font-bold text-white">{visiblePrice}</span>
                </div>
              </div>

              {/* Phone Input */}
              <form onSubmit={handleCheckout} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="topup-phone" className="block text-xs font-medium text-white/65">
                    Phone number for OTP confirmation
                  </label>
                  <div className="relative flex items-center">
                    <Phone className="pointer-events-none absolute start-4 h-4 w-4 text-white/40" />
                    <input
                      id="topup-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="06 XX XX XX XX"
                      className="h-12 w-full rounded-2xl border border-white/[0.1] bg-white/[0.025] pe-4 ps-12 font-mono text-sm text-white outline-none transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-white/25 focus:border-white/35 focus:bg-white/[0.04] focus:ring-2 focus:ring-white/[0.08]"
                    />
                  </div>
                </div>

                {/* Submit Checkout Button */}
                <button
                  type="submit"
                  disabled={loading || success}
                  className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-[#050506] transition-[background-color,opacity,transform] duration-200 hover:bg-gray-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b]"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#050506]" />
                  ) : success ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-[#050506]" />
                      <span>Payment confirmed — Credits added</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-[#050506]" />
                      <span>Proceed to Payment ({visiblePrice})</span>
                      <ArrowRight className="h-4 w-4 text-[#050506]" />
                    </>
                  )}
                </button>
              </form>

              {/* Trust Badges */}
              <div className="flex flex-col gap-2.5 border-t border-white/[0.08] pt-3 text-[11px] text-white/45 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-white/65" />
                  <span>Secure payment</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-white/65" />
                  <span>Credits added after payment confirmation</span>
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
