'use client';

import { LogoCloud } from '@/components/ui/logo-cloud-3';

const logos = [
  'GPT',
  'Claude',
  'Gemini',
  'Nano Banana',
  'Grok',
  'Kling',
  'DeepSeek',
  'FLUX',
  'Qwen',
  'Seedance',
  'Kimi',
  'Seedream',
  'GLM',
  'Hailuo',
].map((name) => ({
  alt: `${name} wordmark`,
  name,
}));

export default function PartnersSection() {
  return (
    <section
      aria-label='VANTRA AI model ecosystem'
      className='relative -mt-[180px] bg-[#050505] !py-12 md:!py-14 border-b border-white/[0.04] overflow-hidden'
    >
      <p className='text-center text-[10.5px] font-semibold tracking-[0.22em] uppercase text-white/35 mb-7 md:mb-8'>
        One workspace. Many models.
      </p>
      <LogoCloud logos={logos} />
    </section>
  );
}
