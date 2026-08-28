'use client';

import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export interface AmbientMotionBackgroundProps {
  className?: string;
  intensity?: 'subtle' | 'normal' | 'vibrant';
  interactive?: boolean;
}

export default function AmbientMotionBackground({
  className = '',
  intensity = 'normal',
  interactive = true,
}: AmbientMotionBackgroundProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const smoothX = useSpring(mouseX, { stiffness: 40, damping: 30 });
  const smoothY = useSpring(mouseY, { stiffness: 40, damping: 30 });

  const tealX = useTransform(smoothX, [-500, 500], [-25, 25]);
  const tealY = useTransform(smoothY, [-500, 500], [-20, 20]);
  const violetX = useTransform(smoothX, [-500, 500], [25, -25]);
  const violetY = useTransform(smoothY, [-500, 500], [18, -18]);
  const gridX = useTransform(smoothX, [-500, 500], [-8, 8]);
  const gridY = useTransform(smoothY, [-500, 500], [-8, 8]);

  useEffect(() => {
    if (!interactive) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      mouseX.set(e.clientX - innerWidth / 2);
      mouseY.set(e.clientY - innerHeight / 2);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [interactive, mouseX, mouseY]);

  const opacityMultiplier = intensity === 'subtle' ? 0.7 : intensity === 'vibrant' ? 1.1 : 0.9;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#16181A] select-none ${className}`}
    >
      {/* 1. Subtle Micro Dot Grid */}
      <motion.div
        style={{ x: gridX, y: gridY }}
        className="absolute inset-[-40px] opacity-[0.08]"
      >
        <svg
          className="h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
        >
          <defs>
            <pattern
              id="ambient-dots-grid"
              x="0"
              y="0"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1" fill="#FFFFFF" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ambient-dots-grid)" />
        </svg>
      </motion.div>

      {/* 2. Quiet Ambient Mesh Gradient Orbs (3: Opacity 0.15-0.18, calm ambient light) */}
      
      {/* Primary Teal Ambient Glow */}
      <motion.div
        animate={{
          scale: [1, 1.08, 0.96, 1],
          rotate: [0, 10, -10, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -top-[10%] -left-[5%] h-[550px] w-[550px] rounded-full blur-[100px]"
        style={{
          x: tealX,
          y: tealY,
          background: 'radial-gradient(circle, rgba(31, 216, 184, 0.16) 0%, rgba(31, 216, 184, 0.03) 55%, transparent 70%)',
          opacity: opacityMultiplier,
          transform: 'translateZ(0)',
        }}
      />

      {/* Accent Violet Ambient Glow */}
      <motion.div
        animate={{
          scale: [1, 0.94, 1.06, 1],
          rotate: [0, -15, 15, 0],
        }}
        transition={{
          duration: 24,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
        className="absolute top-[25%] -right-[8%] h-[600px] w-[600px] rounded-full blur-[110px]"
        style={{
          x: violetX,
          y: violetY,
          background: 'radial-gradient(circle, rgba(110, 107, 255, 0.14) 0%, rgba(110, 107, 255, 0.02) 60%, transparent 75%)',
          opacity: opacityMultiplier,
          transform: 'translateZ(0)',
        }}
      />

      {/* Center Vignette for Clean Deep Contrast */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(5, 5, 6, 0.5) 60%, rgba(5, 5, 6, 0.98) 100%)',
        }}
      />
    </div>
  );
}

export { AmbientMotionBackground };
