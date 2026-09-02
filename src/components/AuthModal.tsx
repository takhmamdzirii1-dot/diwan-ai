'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Mail, Lock, User, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export interface AuthModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialMode?: 'signin' | 'signup';
  onSuccess?: () => void;
}

export default function AuthModal({
  isOpen: propIsOpen,
  onClose: propOnClose,
  initialMode = 'signin',
  onSuccess,
}: AuthModalProps) {
  const supabase = createClient();
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(false);
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync with prop if provided
  useEffect(() => {
    if (typeof propIsOpen === 'boolean') {
      setInternalIsOpen(propIsOpen);
    }
  }, [propIsOpen]);

  // Sync mode with prop
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
    setError(null);
    setSuccessMsg(null);
  }, [initialMode]);

  const handleClose = useCallback(() => {
    setInternalIsOpen(false);
    if (propOnClose) {
      propOnClose();
    }
  }, [propOnClose]);

  // Global window event listeners (dual-trigger guarantee)
  useEffect(() => {
    const handleOpenEvent = (e: any) => {
      const targetMode = e.detail?.mode === 'signup' ? 'signup' : 'signin';
      setMode(targetMode);
      setError(null);
      setSuccessMsg(null);
      setInternalIsOpen(true);
    };

    const handleCloseEvent = () => {
      handleClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('open-auth-modal', handleOpenEvent);
    window.addEventListener('vantra-open-auth', handleOpenEvent);
    window.addEventListener('close-auth-modal', handleCloseEvent);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('open-auth-modal', handleOpenEvent);
      window.removeEventListener('vantra-open-auth', handleOpenEvent);
      window.removeEventListener('close-auth-modal', handleCloseEvent);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClose]);

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo:
            typeof window !== 'undefined' ? `${window.location.origin}/auth/callback?next=/studio` : undefined,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in with Google');
      setGoogleLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (mode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          setSuccessMsg('Successfully signed in! Opening AI Studio...');
          setTimeout(() => {
            onSuccess?.();
            handleClose();
            if (typeof window !== 'undefined') {
              window.location.href = '/studio';
            }
          }, 400);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim() || undefined,
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          setSuccessMsg('Account created successfully! Opening AI Studio...');
          setTimeout(() => {
            onSuccess?.();
            handleClose();
            if (typeof window !== 'undefined') {
              window.location.href = '/studio';
            }
          }, 400);
        } else {
          setSuccessMsg('Verification link sent. Please check your inbox.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const isVisible = typeof propIsOpen === 'boolean' ? propIsOpen : internalIsOpen;

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <div
        id="vantra-auth-modal-root"
        className="vantra-modal-overlay"
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop Blur Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={handleClose}
          className="vantra-modal-backdrop"
        />

        {/* Modal Card Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="vantra-modal-card"
        >
          {/* Top Emerald Accent Beam */}
          <div className="vantra-modal-beam" />

          {/* Modal Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFFFFF]/15 border border-[#FFFFFF]/30 text-[#FFFFFF] shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                  {mode === 'signin' ? 'Sign in to VANTRA' : 'Create VANTRA Account'}
                </h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  {mode === 'signin'
                    ? 'Access your unified Algerian AI balance'
                    : 'Bring Chat, Image and Video into one workspace'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-all hover:bg-white/10 hover:border-white/20 hover:text-white cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Segmented Control Pill Switcher */}
          <div className="vantra-tab-track mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`vantra-tab-btn ${mode === 'signin' ? 'active' : 'inactive'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`vantra-tab-btn ${mode === 'signup' ? 'active' : 'inactive'}`}
            >
              Create Account
            </button>
          </div>

          {/* Error / Success Feedback Alerts */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 rounded-2xl border border-red-500/25 bg-red-500/10 p-3.5 text-xs text-red-400 mb-4"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 rounded-2xl border border-[#FFFFFF]/30 bg-[#FFFFFF]/10 p-3.5 text-xs text-[#FFFFFF] mb-4"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </motion.div>
          )}

          {/* Google OAuth Button - Monochrome */}
          <button
            type="button"
            disabled={googleLoading || loading}
            onClick={handleGoogleSignIn}
            className="w-full h-11 rounded-xl bg-[#1A1C20] border border-white/10 text-white font-medium text-[14px] flex items-center justify-center gap-3 transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 active:bg-white/10"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            ) : (
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span className="font-medium">Continue with Google</span>
          </button>

          {/* Clean Horizontal Divider */}
          <div className="flex items-center gap-4 my-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              or email
            </span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Email & Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="text-xs font-semibold text-[#CBD5E1] block mb-1.5">
                  Full Name
                </label>
                <div className="vantra-input-wrap">
                  <User className="vantra-input-icon" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Karim Meziani"
                    className="vantra-input-field"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-[#CBD5E1] block mb-1.5">
                Email Address
              </label>
              <div className="vantra-input-wrap">
                <Mail className="vantra-input-icon" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="developer@vantra.dz"
                  className="vantra-input-field"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#CBD5E1] block mb-1.5">
                Password
              </label>
              <div className="vantra-input-wrap">
                <Lock className="vantra-input-icon" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="vantra-input-field"
                />
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="vantra-btn-submit mt-2"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#050506]" />
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In to Account' : 'Create Account'}</span>
                  <ArrowRight className="h-4 w-4 text-[#050506]" />
                </>
              )}
            </button>
          </form>

          {/* Bottom Switch Note */}
          <div className="text-center pt-4 mt-4 border-t border-white/[0.08]">
            <p className="text-xs text-[#64748B]">
              {mode === 'signin' ? "Don't have an account yet?" : 'Already have an account?'}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="ml-1.5 font-bold text-[#FFFFFF] hover:underline cursor-pointer"
              >
                {mode === 'signin' ? 'Create Account' : 'Sign In'}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export { AuthModal };
