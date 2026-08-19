'use client';

import React, { useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'motion/react';

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  borderColor?: string;
  size?: number;
}

/**
 * SpotlightCard - Interactive Glassmorphic Card with cursor-tracking radial glow follower.
 * Features 60fps hardware-accelerated spotlight on surface & border.
 */
export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  spotlightColor = 'rgba(31, 216, 184, 0.14)', // Vantra Teal Glow
  borderColor = 'rgba(31, 216, 184, 0.45)',
  size = 360,
  ...props
}) => {
  const mouseX = useMotionValue(-size);
  const mouseY = useMotionValue(-size);
  const cardRef = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!cardRef.current) return;
    const { left, top } = cardRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
  }

  function handleMouseLeave() {
    mouseX.set(-size);
    mouseY.set(-size);
  }

  const surfaceBackground = useMotionTemplate`radial-gradient(${size}px circle at ${mouseX}px ${mouseY}px, ${spotlightColor}, transparent 80%)`;
  const borderBackground = useMotionTemplate`radial-gradient(${size * 0.75}px circle at ${mouseX}px ${mouseY}px, ${borderColor}, transparent 70%)`;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`group relative rounded-2xl bg-[#0D1017]/80 p-[1px] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_16px_40px_rgba(0,0,0,0.6)] ${className}`}
      {...props}
    >
      {/* 1. Animated Spotlight Border Layer */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: borderBackground }}
        aria-hidden="true"
      />

      {/* 2. Glassmorphic Surface Base */}
      <div className="relative h-full w-full rounded-[15px] bg-[#0A0D14]/90 p-6 backdrop-blur-md transition-colors duration-300 group-hover:bg-[#0D111A]/90">
        {/* Animated Spotlight Surface Glow */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[15px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: surfaceBackground }}
          aria-hidden="true"
        />

        {/* Content Container */}
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
};
