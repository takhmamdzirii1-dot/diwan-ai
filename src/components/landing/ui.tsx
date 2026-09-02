'use client';

import React, { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ── Magnetic — element gravitates toward the cursor ─────── */
export function Magnetic({
  children,
  strength = 0.25,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [pos, setPos] = React.useState({ x: 0, y: 0 });

  const onMove = (e: React.MouseEvent) => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: (e.clientX - (r.left + r.width / 2)) * strength,
      y: (e.clientY - (r.top + r.height / 2)) * strength,
    });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      animate={{ x: reduce ? 0 : pos.x, y: reduce ? 0 : pos.y }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 180, damping: 14, mass: 0.25 }}
      className={cn('inline-block', className)}
    >
      {children}
    </motion.div>
  );
}

/* ── SpotlightCard — border surface that glows under cursor ── */
export function SpotlightCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={cn('relative overflow-hidden group/spot', className)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 group-hover/spot:opacity-100 transition-opacity duration-500"
        style={{
          background:
            'radial-gradient(340px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.07), transparent 65%)',
        }}
      />
      {children}
    </div>
  );
}

/* ── SectionHeading — shared editorial header ────────────── */
export function SectionHeading({
  label,
  title,
  sub,
  align = 'center',
}: {
  label: string;
  title: React.ReactNode;
  sub?: string;
  align?: 'center' | 'start';
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' ? 'mx-auto text-center' : 'text-start')}>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-[11px] font-semibold tracking-widest uppercase text-white/40"
      >
        {label}
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 text-3xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
      >
        {title}
      </motion.h2>
      {sub && (
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mt-5 text-white/50 text-lg leading-relaxed"
        >
          {sub}
        </motion.p>
      )}
    </div>
  );
}
