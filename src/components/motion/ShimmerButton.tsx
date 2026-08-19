'use client';

import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

export interface ShimmerButtonProps extends HTMLMotionProps<'button'> {
  children: React.ReactNode;
  className?: string;
  variant?: 'teal' | 'violet';
  glow?: boolean;
}

/**
 * ShimmerButton - Primary action button featuring an animated gradient border and a moving linear shimmer sweep.
 */
export const ShimmerButton: React.FC<ShimmerButtonProps> = ({
  children,
  className = '',
  variant = 'teal',
  glow = true,
  ...props
}) => {
  const isTeal = variant === 'teal';

  return (
    <motion.button
      whileHover={{ scale: 1.03, y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`group relative inline-flex items-center justify-center overflow-hidden rounded-full p-[1px] font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0A0B0F] ${
        isTeal ? 'focus:ring-[#1FD8B8]' : 'focus:ring-[#6E6BFF]'
      } ${className}`}
      {...props}
    >
      {/* 1. Animated Border Gradient Ring */}
      <span
        className={`absolute inset-0 h-full w-full rounded-full transition-all duration-500 ${
          glow
            ? isTeal
              ? 'bg-gradient-to-r from-[#1FD8B8] via-[#6E6BFF] to-[#1FD8B8] opacity-80 group-hover:opacity-100 group-hover:blur-[2px]'
              : 'bg-gradient-to-r from-[#6E6BFF] via-[#1FD8B8] to-[#6E6BFF] opacity-80 group-hover:opacity-100 group-hover:blur-[2px]'
            : 'bg-white/10'
        }`}
      />

      {/* 2. Inner Button Core Surface */}
      <span className="relative flex h-full w-full items-center justify-center gap-2 rounded-full bg-[#0D1017] px-6 py-3.5 text-sm font-medium tracking-wide text-white transition-colors duration-300 group-hover:bg-[#121622]">
        {/* 3. Linear Shimmer Light Sweep */}
        <span
          aria-hidden="true"
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 ease-in-out group-hover:translate-x-full"
        />

        {/* Button Content */}
        <span className="relative z-10 flex items-center gap-2">
          {children}
        </span>
      </span>
    </motion.button>
  );
};
