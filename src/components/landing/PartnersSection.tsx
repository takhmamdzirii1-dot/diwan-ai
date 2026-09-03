'use client';

import { LogoCloud } from '@/components/ui/logo-cloud-3';

const logos = [
  { name: 'GPT', mark: 'orbit' },
  { name: 'Claude', mark: 'rings' },
  { name: 'Gemini', mark: 'spark' },
  { name: 'Nano Banana', mark: 'wave' },
  { name: 'Grok', mark: 'split' },
  { name: 'Kling', mark: 'grid' },
  { name: 'DeepSeek', mark: 'orbit' },
  { name: 'FLUX', mark: 'spark' },
  { name: 'Qwen', mark: 'rings' },
  { name: 'Seedance', mark: 'wave' },
  { name: 'Kimi', mark: 'split' },
  { name: 'Seedream', mark: 'grid' },
  { name: 'GLM', mark: 'orbit' },
  { name: 'Hailuo', mark: 'spark' },
].map(({ name, mark }) => ({
  alt: `${name} wordmark`,
  mark,
  name,
}));

export default function PartnersSection() {
  return (
    <section
      aria-label='VANTRA AI model ecosystem'
      className='relative -mt-[180px] bg-[#050505] !py-9 md:!py-10 border-b border-white/[0.04] overflow-hidden'
    >
      <p className='text-center text-[10.5px] font-semibold tracking-[0.22em] uppercase text-white/35 mb-5 md:mb-6'>
        One workspace. Many models.
      </p>
      <LogoCloud logos={logos} />
    </section>
  );
}
