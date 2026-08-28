'use client';

import React from 'react';
import { motion } from 'motion/react';

export interface AmbientMeshGlowProps {
  className?: string;
  opacity?: number;
}

/**
 * AmbientMeshGlow - High-performance quiet background component containing floating, blurred color orbs.
 * Operates purely with GPU-accelerated transform/opacity to prevent layout shifts (CLS) and keep 60fps.
 */
export const AmbientMeshGlow: React.FC<AmbientMeshGlowProps> = ({
  className = '',
  opacity = 0.5,
}) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#050506] ${className}`}
      style={{ opacity }}
    >
      {/* Orb 1: Vantra Primary Teal (#FFFFFF) */}
      <motion.div
        animate={{
          x: [0, 25, -20, 0],
          y: [0, -30, 20, 0],
          scale: [1, 1.08, 0.95, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -top-[12%] left-[8%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,#FFFFFF_0%,transparent_70%)] opacity-18 blur-[100px] will-change-transform"
      />

      {/* Orb 2: Vantra Primary Violet (#6E6BFF) */}
      <motion.div
        animate={{
          x: [0, -30, 25, 0],
          y: [0, 25, -25, 0],
          scale: [1, 0.95, 1.08, 1],
        }}
        transition={{
          duration: 24,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
        className="absolute top-[25%] right-[5%] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle_at_center,#6E6BFF_0%,transparent_70%)] opacity-14 blur-[110px] will-change-transform"
      />

      {/* Subtle Matrix Micro-Grid Texture */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff06_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
    </div>
  );
};
