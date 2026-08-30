'use client';

import { LogoCloud } from '@/components/ui/logo-cloud-3';

const logos = [
  {
    src: 'https://cdn.simpleicons.org/nvidia/76B900',
    alt: 'Nvidia Logo',
  },
  {
    src: 'https://cdn.simpleicons.org/supabase/3FCF8E',
    alt: 'Supabase Logo',
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
    src: 'https://cdn.simpleicons.org/anthropic/D97757',
    alt: 'Claude AI Logo',
  },
  {
    src: 'https://svgl.app/library/groq_wordmark_light.svg',
    alt: 'Groq Logo',
    className: '[filter:brightness(0)_saturate(100%)_invert(42%)_sepia(95%)_saturate(1295%)_hue-rotate(344deg)_brightness(100%)_contrast(93%)]',
  },
  {
    src: 'https://cdn.simpleicons.org/turso/4FF8D2',
    alt: 'Turso Logo',
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
