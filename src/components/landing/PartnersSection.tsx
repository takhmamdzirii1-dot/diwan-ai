'use client';

import { LogoCloud } from '@/components/ui/logo-cloud-3';

const logos = [
  {
    src: 'https://svgl.app/library/nvidia-wordmark-light.svg',
    alt: 'Nvidia Logo',
    className: '[filter:brightness(0)_saturate(100%)_invert(65%)_sepia(72%)_saturate(548%)_hue-rotate(43deg)_brightness(92%)_contrast(100%)]',
  },
  {
    src: 'https://svgl.app/library/supabase_wordmark_light.svg',
    alt: 'Supabase Logo',
    className: '[filter:brightness(0)_saturate(100%)_invert(73%)_sepia(14%)_saturate(1689%)_hue-rotate(100deg)_brightness(88%)_contrast(84%)]',
  },
  {
    src: 'https://svgl.app/library/openai_wordmark_light.svg',
    alt: 'OpenAI Logo',
    className: 'invert',
  },
  {
    src: 'https://svgl.app/library/vercel_wordmark.svg',
    alt: 'Vercel Logo',
    className: 'invert',
  },
  {
    src: 'https://svgl.app/library/github_wordmark_light.svg',
    alt: 'GitHub Logo',
    className: 'invert',
  },
  {
    src: 'https://svgl.app/library/claude-ai-wordmark-icon_light.svg',
    alt: 'Claude AI Logo',
    className: '[filter:brightness(0)_saturate(100%)_invert(57%)_sepia(37%)_saturate(707%)_hue-rotate(332deg)_brightness(88%)_contrast(89%)]',
  },
  {
    src: 'https://svgl.app/library/groq_wordmark_light.svg',
    alt: 'Groq Logo',
    className: '[filter:brightness(0)_saturate(100%)_invert(42%)_sepia(95%)_saturate(1295%)_hue-rotate(344deg)_brightness(100%)_contrast(93%)]',
  },
  {
    src: 'https://svgl.app/library/turso-wordmark-light.svg',
    alt: 'Turso Logo',
    className: '[filter:brightness(0)_saturate(100%)_invert(82%)_sepia(54%)_saturate(473%)_hue-rotate(110deg)_brightness(101%)_contrast(94%)]',
  },
];

export default function PartnersSection() {
  return (
    <section
      aria-label='Technology partners'
      className='relative -mt-[180px] bg-[#050505] py-14 border-b border-white/[0.04] overflow-hidden'
    >
      <p className='text-center text-[10.5px] font-semibold tracking-[0.22em] uppercase text-white/30 mb-8'>
        Powered by
      </p>
      <LogoCloud logos={logos} />
    </section>
  );
}
