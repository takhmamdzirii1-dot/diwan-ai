'use client';

import React from 'react';
import { motion, type Variants } from 'motion/react';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const childVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 28,
    filter: 'blur(10px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1], // Custom fluid luxury cubic-bezier
    },
  },
};

export interface HeroEntranceProps {
  badge?: React.ReactNode;
  heading: React.ReactNode;
  subtitle: React.ReactNode;
  actions: React.ReactNode;
  media?: React.ReactNode;
  className?: string;
}

/**
 * HeroEntrance - Staggered layout sequence wrapper with custom fluid easing for luxury SaaS hero sections.
 */
export const HeroEntrance: React.FC<HeroEntranceProps> = ({
  badge,
  heading,
  subtitle,
  actions,
  media,
  className = '',
}) => {
  return (
    <motion.section
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`relative mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-20 text-center lg:py-28 ${className}`}
    >
      {/* 1. Badge Element */}
      {badge && (
        <motion.div variants={childVariants} className="mb-6">
          {badge}
        </motion.div>
      )}

      {/* 2. Main Hero Heading */}
      <motion.h1
        variants={childVariants}
        className="max-w-4xl font-sans text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
      >
        {heading}
      </motion.h1>

      {/* 3. Subtitle Description */}
      <motion.p
        variants={childVariants}
        className="mt-6 max-w-2xl text-base text-gray-400 sm:text-lg md:text-xl"
      >
        {subtitle}
      </motion.p>

      {/* 4. Action Buttons */}
      <motion.div
        variants={childVariants}
        className="mt-10 flex flex-wrap items-center justify-center gap-4"
      >
        {actions}
      </motion.div>

      {/* 5. Live Interactive Showcase Device / Media */}
      {media && (
        <motion.div
          variants={childVariants}
          className="mt-16 w-full max-w-5xl"
        >
          {media}
        </motion.div>
      )}
    </motion.section>
  );
};
