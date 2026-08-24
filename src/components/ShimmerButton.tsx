'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface ShimmerButtonProps {
  text: string;
  onClick?: () => void;
  className?: string;
}

export default function ShimmerButton({ text, onClick, className = '' }: ShimmerButtonProps) {
  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full p-[1px] font-semibold text-black shadow-[0_4px_16px_rgba(31,216,184,0.25)] transition-all duration-[250ms] ${className}`}
    >
      <span className="absolute inset-0 bg-gradient-to-r from-[#1FD8B8] via-[#8583FF] to-[#1FD8B8] bg-[length:200%_auto] animate-gradient" />
      <span className="relative flex h-full w-full items-center justify-center gap-2 rounded-full bg-[#1FD8B8] px-6 py-3 transition-colors hover:bg-[#34e2c2]">
        <span className="font-bold text-[#050506]">{text}</span>
      </span>
    </motion.button>
  );
}

export { ShimmerButton };
