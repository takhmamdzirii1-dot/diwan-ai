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
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-xl p-[1px] font-semibold text-black shadow-2xl transition-all ${className}`}
    >
      <span className="absolute inset-0 bg-gradient-to-r from-[#1FD8B8] via-[#6E6BFF] to-[#1FD8B8] bg-[length:200%_auto] animate-gradient" />
      <span className="relative flex h-full w-full items-center justify-center gap-2 rounded-[11px] bg-[#1FD8B8] px-6 py-3 transition-colors hover:bg-opacity-95">
        <span className="font-bold text-[#08090C]">{text}</span>
      </span>
    </motion.button>
  );
}

export { ShimmerButton };
