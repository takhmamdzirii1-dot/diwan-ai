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
  name: 'Pro Creator',
  price: '4,500 DZD',
  points: '35,000 Points',
  ptsNum: 35000,
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
      }, 1400);
    } catch {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0A0B0D] shadow-[0_24px_50px_rgba(0,0,0,0.85)] z-10"
          >
            {/* Top Accent Beam */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#1FD8B8] to-transparent opacity-75" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] p-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1FD8B8]/10 border border-[#1FD8B8]/25 text-[#1FD8B8]">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#F5F6F8]">Top Up Points in DZD</h3>
                  <p className="text-xs text-[rgba(245,246,248,0.6)]">
                    Instant Chargily Pay Checkout (EDAHABIA / CIB)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.035] text-[rgba(245,246,248,0.6)] transition hover:border-white/[0.12] hover:bg-white/[0.065] hover:text-[#F5F6F8]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-[rgba(245,246,248,0.6)]">
                  Select Payment Card:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('edahabia')}
                    className={`flex items-center gap-3 rounded-xl p-3 border transition-all text-left ${
                      paymentMethod === 'edahabia'
                        ? 'border-[#1FD8B8] bg-[#1FD8B8]/10 shadow-[0_0_15px_rgba(31,216,184,0.1)]'
                        : 'border-white/[0.06] bg-[#050506] hover:bg-white/[0.03]'
                    }`}
                  >
                    <CreditCard
                      className={`h-5 w-5 ${
                        paymentMethod === 'edahabia' ? 'text-[#1FD8B8]' : 'text-[rgba(245,246,248,0.6)]'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold text-[#F5F6F8]">Edahabia</p>
                      <p className="text-[10px] text-[rgba(245,246,248,0.45)]">Algérie Poste</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cib')}
                    className={`flex items-center gap-3 rounded-xl p-3 border transition-all text-left ${
                      paymentMethod === 'cib'
                        ? 'border-[#1FD8B8] bg-[#1FD8B8]/10 shadow-[0_0_15px_rgba(31,216,184,0.1)]'
                        : 'border-white/[0.06] bg-[#050506] hover:bg-white/[0.03]'
                    }`}
                  >
                    <Building2
                      className={`h-5 w-5 ${
                        paymentMethod === 'cib' ? 'text-[#1FD8B8]' : 'text-[rgba(245,246,248,0.6)]'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold text-[#F5F6F8]">CIB Card</p>
                      <p className="text-[10px] text-[rgba(245,246,248,0.45)]">SATIM Banks</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Invoice Summary Box */}
              <div className="rounded-xl border border-white/[0.06] bg-[#050506] p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[rgba(245,246,248,0.6)]">Selected Pack:</span>
                  <span className="font-bold text-[#F5F6F8]">{plan.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[rgba(245,246,248,0.6)]">Points Credited:</span>
                  <span className="font-mono font-bold text-[#1FD8B8]">+{plan.points}</span>
                </div>
                <div className="border-t border-white/[0.06] pt-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F5F6F8]">Total in DZD:</span>
                  <span className="font-mono text-base font-bold text-[#F5F6F8]">{plan.price}</span>
                </div>
              </div>

              {/* Phone Input */}
              <form onSubmit={handleCheckout} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-[rgba(245,246,248,0.6)]">
                    Cardholder Phone (for OTP confirmation):
                  </label>
                  <div className="relative flex items-center">
                    <Phone className="absolute left-3.5 h-4 w-4 text-[rgba(245,246,248,0.4)] pointer-events-none" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="06 XX XX XX XX"
                      className="w-full rounded-xl border border-white/[0.06] bg-[#050506] py-2.5 pl-10 pr-4 text-xs font-mono text-[#F5F6F8] placeholder-[rgba(245,246,248,0.4)] outline-none transition focus:border-[#1FD8B8]"
                    />
                  </div>
                </div>

                {/* Submit Checkout Button */}
                <button
                  type="submit"
                  disabled={loading || success}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-[#1FD8B8] h-11 text-xs font-bold text-[#050506] shadow-[0_4px_16px_rgba(31,216,184,0.25)] transition-all hover:bg-[#34e2c2] disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#050506]" />
                  ) : success ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-[#050506]" />
                      <span>Payment Verified & Points Added!</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-[#050506]" />
                      <span>Proceed to Payment ({plan.price})</span>
                      <ArrowRight className="h-3.5 w-3.5 text-[#050506]" />
                    </>
                  )}
                </button>
              </form>

              {/* Trust Badges */}
              <div className="flex items-center justify-between text-[10px] text-[rgba(245,246,248,0.4)] border-t border-white/[0.06] pt-3">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#1FD8B8]" />
                  <span>SATIM 256-bit Encrypted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#1FD8B8]" />
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
