'use client';

import { LogoCloud } from '@/components/ui/logo-cloud-3';

const LOBE_ICON = 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons';

const logos = [
  { name: 'GPT', slug: 'openai' },
  { name: 'Claude', slug: 'claude' },
  { name: 'Gemini', slug: 'gemini' },
  { name: 'Nano Banana', slug: 'nanobanana' },
  { name: 'Grok', slug: 'grok' },
  { name: 'Kling', slug: 'kling' },
  { name: 'DeepSeek', slug: 'deepseek' },
  { name: 'FLUX', slug: 'flux' },
  { name: 'Qwen', slug: 'qwen' },
  { name: 'Kimi', slug: 'kimi' },
  { name: 'GLM', slug: 'zai' },
  { name: 'Seedance', slug: 'bytedance' },
  { name: 'Seedream', slug: 'bytedance' },
  { name: 'Hailuo', slug: 'hailuo' },
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
