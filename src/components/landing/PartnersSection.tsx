'use client';

import { LogoCloud } from '@/components/ui/logo-cloud-3';

const logos = [
  {
    src: 'https://svgl.app/library/nvidia-wordmark-light.svg',
    alt: 'Nvidia Logo',
  },
  {
    src: 'https://svgl.app/library/supabase_wordmark_light.svg',
    alt: 'Supabase Logo',
  },
  {
    src: 'https://svgl.app/library/openai_wordmark_light.svg',
    alt: 'OpenAI Logo',
  },
  {
    src: 'https://svgl.app/library/vercel_wordmark.svg',
    alt: 'Vercel Logo',
  },
  {
    src: 'https://svgl.app/library/github_wordmark_light.svg',
    alt: 'GitHub Logo',
  },
  {
    src: 'https://svgl.app/library/claude-ai-wordmark-icon_light.svg',
    alt: 'Claude AI Logo',
  },
  {
    src: 'https://svgl.app/library/groq_wordmark_light.svg',
    alt: 'Groq Logo',
  },
  {
    src: 'https://svgl.app/library/turso-wordmark-light.svg',
    alt: 'Turso Logo',
  },
];

export default function PartnersSection() {
  return (
    <section
      aria-label='Technology partners'
      className='relative bg-[#050505] py-14 border-b border-white/[0.04] overflow-hidden'
    >
      <p className='text-center text-[10.5px] font-semibold tracking-[0.22em] uppercase text-white/30 mb-8'>
        Powered by
      </p>
      <LogoCloud logos={logos} />
    </section>
  );
}
