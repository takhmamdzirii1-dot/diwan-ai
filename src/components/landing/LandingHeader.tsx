'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { VantraLogo } from '../VantraLogo';
import { cn } from '@/lib/utils';

interface LandingHeaderProps {
  /** Supabase user (null = guest) */
  user: { email?: string; user_metadata?: { full_name?: string } } | null;
  onSignIn: () => void;
  onOpenStudio: () => void;
  /** Logged-out primary CTA — opens the signup modal (matches hero Start Free) */
  onStartFree: () => void;
}

/** Nav links → landing section anchors */
const NAV_LINKS = [
  { label: 'Models', id: 'models' },
  { label: 'Pricing', id: 'pricing' },
  { label: 'Studio', id: 'showcase' },
  { label: 'FAQ', id: 'faq' },
] as const;

/** Auth-aware glass header. Transparent at top, frosted after scroll.
 *  Desktop: brand · centered nav · auth actions. Mobile: brand · Start Free · menu. */
export default function LandingHeader({ user, onSignIn, onOpenStudio, onStartFree }: LandingHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Active-section tracking — IntersectionObserver band around viewport middle.
     Last intersecting element in DOM order wins (the #models grid sits inside #showcase). */
  useEffect(() => {
    const els = NAV_LINKS
      .map((l) => document.getElementById(l.id))
      .filter((el): el is HTMLElement => !!el)
      .sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      );
    if (!els.length) return;

    const visible = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) =>
          e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)
        );
        let next: string | null = null;
        els.forEach((el) => {
          if (visible.has(el)) next = el.id;
        });
        setActive(next);
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: 0 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* Close the mobile menu if the viewport grows past the md breakpoint */
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => mq.matches && setMenuOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  /* Escape closes the mobile menu and returns focus to the trigger */
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You';

  const primaryBtn =
    'h-11 md:h-9 rounded-xl bg-white text-black text-[12.5px] font-semibold hover:bg-gray-200 transition-colors cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]';

  const navLink = (l: (typeof NAV_LINKS)[number], onNavigate?: () => void) => (
    <a
      key={l.id}
      href={`#${l.id}`}
      onClick={onNavigate}
      aria-current={active === l.id ? 'true' : undefined}
      className={cn(
        'relative py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded px-1',
        active === l.id ? 'text-white' : 'text-white/65 hover:text-white'
      )}
    >
      {l.label}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-x-1 -bottom-0.5 h-px bg-white/50 transition-opacity duration-200',
          active === l.id ? 'opacity-100' : 'opacity-0'
        )}
      />
    </a>
  );

  return (
    <header
      className={cn(
        'fixed top-0 inset-x-0 z-[90] transition-all duration-300',
        scrolled
          ? 'bg-[#050505]/75 backdrop-blur-xl border-b border-white/[0.06]'
          : 'bg-transparent border-b border-transparent'
      )}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        {/* Brand */}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="min-h-11 md:min-h-0 flex items-center gap-2.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-lg"
          aria-label="VANTRA — back to top"
        >
          <span className="h-8 w-8 rounded-lg border border-white/10 bg-white/[0.03] flex items-center justify-center">
            <VantraLogo className="w-4 h-4" />
          </span>
          <span className="text-[13px] font-semibold tracking-[0.16em] text-white">VANTRA</span>
        </button>

        {/* Desktop nav — optically centered between brand and actions */}
        <nav aria-label="Primary" className="hidden md:flex items-center gap-7 mx-auto">
          {NAV_LINKS.map((l) => navLink(l))}
        </nav>

        {/* Desktop auth actions */}
        <div className="hidden md:flex items-center gap-2.5">
          {user ? (
            <>
              <span
                className="flex items-center gap-2 h-9 ps-1.5 pe-3.5 rounded-full border border-white/10 bg-white/[0.04]"
                title={displayName}
              >
                <span className="h-6 w-6 rounded-full bg-white/[0.10] border border-white/10 flex items-center justify-center text-[10.5px] font-bold text-white">
                  {displayName[0].toUpperCase()}
                </span>
                <span className="text-[12px] font-medium text-white/85 max-w-[120px] truncate">
                  {displayName}
                </span>
              </span>
              <button type="button" onClick={onOpenStudio} className={cn(primaryBtn, 'px-3.5')}>
                Open Studio
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onSignIn}
                className="h-9 px-3.5 rounded-xl text-[12.5px] font-medium text-white/75 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Sign In
              </button>
              <button type="button" onClick={onStartFree} className={cn(primaryBtn, 'px-[18px]')}>
                Start Free
              </button>
            </>
          )}
        </div>

        {/* Mobile actions — compact Start Free + menu trigger */}
        <div className="flex md:hidden items-center gap-2">
          {!user && (
            <button type="button" onClick={onStartFree} className={cn(primaryBtn, 'px-3.5 text-[12px]')}>
              Start Free
            </button>
          )}
          {user && (
            <span
              className="h-11 w-11 rounded-full bg-white/[0.10] border border-white/10 flex items-center justify-center text-[11px] font-bold text-white"
              title={displayName}
              aria-label={`Signed in as ${displayName}`}
            >
              {displayName[0].toUpperCase()}
            </span>
          )}
          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="vantra-mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="h-11 w-11 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center text-white/80 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="vantra-mobile-menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="md:hidden absolute top-full inset-x-0 bg-[#050505]/95 backdrop-blur-xl border-b border-white/[0.08]"
          >
            <nav aria-label="Mobile" className="px-6 py-4 flex flex-col">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.id}
                  href={`#${l.id}`}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active === l.id ? 'true' : undefined}
                  className={cn(
                    'min-h-11 flex items-center text-[14.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded px-1',
                    active === l.id ? 'text-white' : 'text-white/75 hover:text-white'
                  )}
                >
                  {l.label}
                </a>
              ))}

              <div className="border-t border-white/[0.06] mt-3 pt-3 flex flex-col gap-2">
                {user ? (
                  <>
                    <span className="flex items-center gap-2.5 min-h-11 px-1">
                      <span className="h-7 w-7 rounded-full bg-white/[0.10] border border-white/10 flex items-center justify-center text-[11px] font-bold text-white">
                        {displayName[0].toUpperCase()}
                      </span>
                      <span className="text-[13px] font-medium text-white/85 truncate">
                        {displayName}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenStudio();
                      }}
                      className={cn(primaryBtn, 'w-full')}
                    >
                      Open Studio
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onSignIn();
                      }}
                      className="min-h-11 rounded-xl text-[14px] font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 text-start px-3"
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onStartFree();
                      }}
                      className={cn(primaryBtn, 'w-full')}
                    >
                      Start Free
                    </button>
                  </>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
