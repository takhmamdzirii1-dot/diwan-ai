'use client';

import React from 'react';
import { motion } from 'motion/react';

export interface AmbientMeshGlowProps {
  className?: string;
  opacity?: number;
}

/**
 * AmbientMeshGlow - High-performance background component containing floating, blurred color orbs.
 * Operates purely with GPU-accelerated transform/opacity to prevent layout shifts (CLS) and keep 60fps.
 */
export const AmbientMeshGlow: React.FC<AmbientMeshGlowProps> = ({
  className = '',
  opacity = 0.6,
}) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`}
      style={{ opacity }}
    >
      {/* Orb 1: Vantra Primary Teal (#1FD8B8) */}
      <motion.div
        animate={{
          x: [0, 40, -30, 0],
          y: [0, -50, 30, 0],
          scale: [1, 1.15, 0.9, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -top-[15%] left-[10%] h-[550px] w-[550px] rounded-full bg-[radial-gradient(circle_at_center,#1FD8B8_0%,transparent_70%)] opacity-35 blur-[120px] will-change-transform"
      />

      {/* Orb 2: Vantra Primary Violet (#6E6BFF) */}
      <motion.div
        animate={{
          x: [0, -50, 40, 0],
          y: [0, 40, -40, 0],
          scale: [1, 0.95, 1.18, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
        className="absolute top-[25%] right-[5%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,#6E6BFF_0%,transparent_70%)] opacity-30 blur-[140px] will-change-transform"
      />

      {/* Orb 3: Deep Gold / Amber Pulse for Algerian Payment Accent (#F5B942) */}
      <motion.div
        animate={{
          x: [0, 30, -40, 0],
          y: [0, -30, 50, 0],
          scale: [0.9, 1.1, 0.95, 0.9],
        }}
        transition={{
          duration: 26,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 4,
        }}
        className="absolute bottom-[10%] left-[25%] h-[450px] w-[450px] rounded-full bg-[radial-gradient(circle_at_center,#F5B942_0%,transparent_70%)] opacity-15 blur-[130px] will-change-transform"
      />

      {/* Subtle Matrix Micro-Grid Texture */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
    </div>
  );
};
