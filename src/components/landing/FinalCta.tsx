'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Magnetic } from './ui';

export default function FinalCta({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section className="relative bg-[#050505] py-40 overflow-hidden">
      {/* Center glow */}
      <div
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_45%_45%_at_50%_55%,rgba(255,255,255,0.06),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
        >
          Start building the impossible.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-6 text-white/50 text-lg"
        >
          Your first generations are free. The only thing you'll regret is the time you spent before this.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-10"
        >
          <Magnetic strength={0.2}>
            <button
              type="button"
              onClick={onGetStarted}
              className="h-13 px-10 py-3.5 rounded-xl bg-white text-black text-[15px] font-semibold hover:bg-gray-200 transition-colors cursor-pointer active:scale-[0.98] shadow-[0_0_60px_-10px_rgba(255,255,255,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
            >
              Create your free account
            </button>
          </Magnetic>
        </motion.div>
      </div>
    </section>
  );
}
