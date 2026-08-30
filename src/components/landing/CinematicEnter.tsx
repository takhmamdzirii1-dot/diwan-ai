'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VantraLogo } from '../VantraLogo';

/**
 * Fullscreen cinematic wipe shown while navigating Landing → Studio.
 * Mount at page level; `active` starts the sequence, then onComplete routes.
 */
export default function CinematicEnter({
  active,
  onComplete,
}: {
  active: boolean;
  onComplete: () => void;
}) {
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(onComplete, 1350);
    return () => clearTimeout(t);
  }, [active, onComplete]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed inset-0 z-[200] bg-[#050505] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          role="status"
          aria-label="Entering VANTRA Studio"
        >
          {/* Expanding ring */}
          <motion.div
            className="absolute rounded-full border border-white/20"
            initial={{ width: 0, height: 0, opacity: 0.9 }}
            animate={{ width: 640, height: 640, opacity: 0 }}
            transition={{ duration: 1.15, ease: 'easeOut' }}
            aria-hidden="true"
          />
          <motion.div
            className="absolute rounded-full border border-white/10"
            initial={{ width: 0, height: 0, opacity: 0.7 }}
            animate={{ width: 900, height: 900, opacity: 0 }}
            transition={{ duration: 1.3, ease: 'easeOut', delay: 0.12 }}
            aria-hidden="true"
          />

          {/* Emblem */}
          <motion.div
            className="relative flex flex-col items-center gap-7"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <div className="h-16 w-16 rounded-2xl border border-white/15 bg-white/[0.04] flex items-center justify-center shadow-[0_0_90px_-12px_rgba(255,255,255,0.45)]">
              <VantraLogo className="w-8 h-8" />
            </div>

            <p className="text-[11px] font-mono uppercase tracking-[0.34em] text-white/50">
              Entering Studio
            </p>

            <div className="w-44 h-px rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full w-full bg-white"
                initial={{ x: '-100%' }}
                animate={{ x: '0%' }}
                transition={{ duration: 1.05, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
