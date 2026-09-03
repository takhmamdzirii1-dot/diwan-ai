'use client';

import { LogoCloud } from '@/components/ui/logo-cloud-3';

const LOBE_ICON = 'https://unpkg.com/@lobehub/icons-static-png@latest';

const logos = [
  { name: 'GPT', asset: 'dark/openai.png' },
  { name: 'Claude', asset: 'dark/claude-color.png' },
  { name: 'Gemini', asset: 'dark/gemini-color.png' },
  { name: 'Nano Banana', asset: 'dark/nanobanana-color.png' },
  { name: 'Grok', asset: 'dark/grok.png' },
  { name: 'Kling', asset: 'dark/kling-color.png' },
  { name: 'DeepSeek', asset: 'dark/deepseek-color.png' },
  { name: 'FLUX', asset: 'dark/flux.png' },
  { name: 'Qwen', asset: 'dark/qwen-color.png' },
  { name: 'Seedance', asset: 'dark/bytedance-brand-color.png' },
  { name: 'Kimi', asset: 'dark/kimi-color.png' },
  { name: 'GLM', asset: 'dark/zai.png' },
  { name: 'Hailuo', asset: 'dark/hailuo-color.png' },
  { name: 'Seedream', asset: 'dark/bytedance-brand-color.png' },
].map(({ name, asset }) => ({
  alt: `${name} wordmark`,
  name,
  src: `${LOBE_ICON}/${asset}`,
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
