'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, LogOut, Wallet, User as UserIcon, ChevronDown } from 'lucide-react';
import useUser from '../hooks/useUser';
import { useModal } from '../context/ModalContext';
import ShimmerButton from './ShimmerButton';

export interface NavbarProps {
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
  onOpenTopUp?: () => void;
}

export default function Navbar({ onOpenAuth, onOpenTopUp }: NavbarProps) {
  const { user, balance, signOut, isLoading } = useUser();
  const { openAuthModal, openTopUpModal } = useModal();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleOpenAuth = (mode: 'signin' | 'signup' = 'signin') => {
    console.log('Button clicked: opening auth modal', mode);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode } }));
      window.dispatchEvent(new CustomEvent('vantra-open-auth', { detail: { mode } }));
    }
    if (onOpenAuth) {
      onOpenAuth(mode);
    } else {
      openAuthModal(mode);
    }
  };

  const handleOpenTopUp = () => {
    console.log('Button clicked: opening top-up modal');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-topup-modal'));
    }
    if (onOpenTopUp) {
      onOpenTopUp();
    } else {
      openTopUpModal();
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userInitial = (
    user?.user_metadata?.full_name?.[0] ||
    user?.email?.[0] ||
    'U'
  ).toUpperCase();

  const userDisplayName =
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'VANTRA User';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#050506]/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex h-20 items-center justify-between px-4 md:px-8">
        {/* Brand Logo */}
        <a href="#" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFFFFF] p-2 transition-transform duration-200 group-hover:scale-105">
            <Sparkles className="h-5 w-5 text-[#050506]" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-wider text-white font-heading">VANTRA</span>
            <span className="block text-[10px] uppercase font-semibold tracking-widest text-[#FFFFFF]">
              Algerian AI Gateway
            </span>
          </div>
        </a>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[rgba(245,246,248,0.6)]">
          <a href="#hero" className="transition hover:text-white">Home</a>
          <a href="#models" className="transition hover:text-white">AI Models</a>
          <a href="#pricing" className="transition hover:text-white">Pricing & DZD</a>
          <a href="#faq" className="transition hover:text-white">FAQ</a>
        </nav>

        {/* Auth / User Action State */}
        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="h-9 w-24 rounded-full bg-white/[0.04] animate-pulse" />
          ) : user ? (
            /* Logged-in State */
            <div className="flex items-center gap-3">
              {/* Live Point Balance Pill */}
              <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.035] px-3.5 py-1.5 backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FFFFFF] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FFFFFF]" />
                </span>
                <span className="font-mono text-xs font-bold text-[#FFFFFF]">
                  {balance.toLocaleString()}
                </span>
                <span className="text-[10px] font-semibold text-[rgba(245,246,248,0.6)] font-mono">
                  PTS
                </span>
              </div>

              {/* User Avatar & Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.035] p-1.5 pr-3 transition hover:border-white/[0.12] hover:bg-white/[0.065]"
                >
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt={userDisplayName}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFFFFF] font-bold text-xs text-[#050506]">
                      {userInitial}
                    </div>
                  )}
                  <span className="max-w-[100px] truncate text-xs font-semibold text-[#F5F6F8]">
                    {userDisplayName}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-[rgba(245,246,248,0.4)] transition-transform duration-200 ${
                      dropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-60 rounded-2xl border border-white/[0.06] bg-[#0A0B0D] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl z-50"
                    >
                      <div className="border-b border-white/[0.06] p-3 pb-2.5">
                        <p className="text-xs font-bold text-[#F5F6F8] truncate">{userDisplayName}</p>
                        <p className="text-[11px] text-[rgba(245,246,248,0.45)] truncate">{user.email}</p>
                      </div>

                      <div className="p-2 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setDropdownOpen(false);
                            handleOpenTopUp();
                          }}
                          className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[rgba(245,246,248,0.8)] transition hover:bg-white/[0.06] hover:text-[#FFFFFF]"
                        >
                          <Wallet className="h-4 w-4 text-[#FFFFFF]" />
                          <span>Top Up DZD Points</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDropdownOpen(false);
                            signOut();
                          }}
                          className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            /* Logged-out State */
            <>
              <button
                type="button"
                onClick={() => handleOpenAuth('signin')}
                className="hidden sm:inline-flex items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.035] px-4 py-2.5 text-xs font-medium text-[#F5F6F8] hover:bg-white/[0.065] transition duration-[250ms]"
              >
                <UserIcon className="h-3.5 w-3.5 mr-1.5 text-[#FFFFFF]" />
                <span>Sign In</span>
              </button>

              <ShimmerButton
                text="Get Started & Top Up"
                onClick={() => handleOpenAuth('signup')}
                className="text-xs px-4 py-2"
              />
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export { Navbar };
