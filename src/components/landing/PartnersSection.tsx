'use client';

import { LogoCloud } from '@/components/ui/logo-cloud-3';

const LOBE_ICON = 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons';

const logos = [
  { name: 'GPT', slug: 'openai' },
  { name: 'Claude', slug: 'claude-color' },
  { name: 'Gemini', slug: 'gemini-color' },
  { name: 'Nano Banana', slug: 'nanobanana-color' },
  { name: 'Grok', slug: 'grok' },
  { name: 'Kling', slug: 'kling-color' },
  { name: 'DeepSeek', slug: 'deepseek-color' },
  { name: 'FLUX', slug: 'flux' },
  { name: 'Qwen', slug: 'qwen-color' },
  { name: 'Kimi', slug: 'kimi-color' },
  { name: 'GLM', slug: 'zai' },
  { name: 'Seedance', slug: 'bytedance-brand-color' },
  { name: 'Seedream', slug: 'bytedance-brand-color' },
  { name: 'Hailuo', slug: 'hailuo-color' },
].map(({ name, slug }) => ({
  alt: `${name} wordmark`,
  name,
  src: `${LOBE_ICON}/${slug}.svg`,
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
