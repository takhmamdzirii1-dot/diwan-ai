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

  // Smooth physics-based spring follower for cursor interaction
  const smoothX = useSpring(mouseX, { stiffness: 45, damping: 25 });
  const smoothY = useSpring(mouseY, { stiffness: 45, damping: 25 });

  // Transform offsets for floating orbs and grid parallax
  const tealX = useTransform(smoothX, [-500, 500], [-35, 35]);
  const tealY = useTransform(smoothY, [-500, 500], [-25, 25]);
  const violetX = useTransform(smoothX, [-500, 500], [30, -30]);
  const violetY = useTransform(smoothY, [-500, 500], [20, -20]);
  const amberX = useTransform(smoothX, [-500, 500], [-15, 15]);
  const amberY = useTransform(smoothY, [-500, 500], [15, -15]);
  const gridX = useTransform(smoothX, [-500, 500], [-12, 12]);
  const gridY = useTransform(smoothY, [-500, 500], [-12, 12]);

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

  const opacityMultiplier = intensity === 'subtle' ? 0.6 : intensity === 'vibrant' ? 1.2 : 1;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#0A0B0F] select-none ${className}`}
    >
      {/* 1. Interactive Micro Dot Grid Layer */}
      <motion.div
        style={{ x: gridX, y: gridY }}
        className="absolute inset-[-40px] opacity-[0.14] transition-opacity duration-700"
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
              <circle cx="2" cy="2" r="1" fill="#1FD8B8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ambient-dots-grid)" />
        </svg>
      </motion.div>

      {/* 2. Floating Mesh Gradient Orbs (GPU accelerated blur & transform) */}
      
      {/* Primary Vantra Teal Orb (#1FD8B8) */}
      <motion.div
        animate={{
          scale: [1, 1.15, 0.95, 1],
          rotate: [0, 15, -15, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -top-[15%] -left-[10%] h-[650px] w-[650px] rounded-full blur-[140px]"
        style={{
          x: tealX,
          y: tealY,
          background: 'radial-gradient(circle, rgba(31, 216, 184, 0.22) 0%, rgba(31, 216, 184, 0.05) 55%, transparent 70%)',
          opacity: opacityMultiplier,
          transform: 'translateZ(0)',
        }}
      />

      {/* Accent Violet Orb (#6E6BFF) */}
      <motion.div
        animate={{
          scale: [1, 0.9, 1.12, 1],
          rotate: [0, -20, 20, 0],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
        className="absolute top-[20%] -right-[12%] h-[720px] w-[720px] rounded-full blur-[160px]"
        style={{
          x: violetX,
          y: violetY,
          background: 'radial-gradient(circle, rgba(110, 107, 255, 0.20) 0%, rgba(110, 107, 255, 0.04) 60%, transparent 75%)',
          opacity: opacityMultiplier,
          transform: 'translateZ(0)',
        }}
      />

      {/* Warm Amber / Gold Glow (#F5B942) */}
      <motion.div
        animate={{
          scale: [0.95, 1.1, 0.9, 0.95],
          rotate: [0, 10, -10, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 4,
        }}
        className="absolute bottom-[-10%] left-[25%] h-[580px] w-[580px] rounded-full blur-[150px]"
        style={{
          x: amberX,
          y: amberY,
          background: 'radial-gradient(circle, rgba(245, 185, 66, 0.12) 0%, rgba(245, 185, 66, 0.02) 50%, transparent 70%)',
          opacity: opacityMultiplier,
          transform: 'translateZ(0)',
        }}
      />

      {/* Deep Center Radial Vignette to maintain crisp luxury contrast */}
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(10, 11, 15, 0.4) 50%, rgba(10, 11, 15, 0.95) 100%)',
        }}
      />

      {/* Subtle Film Grain Noise Texture */}
      <div
        className="absolute inset-0 opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

export { AmbientMotionBackground };
