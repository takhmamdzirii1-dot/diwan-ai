'use client';

import { LogoCloud } from '@/components/ui/logo-cloud-3';
import ByteDanceIcon from '@lobehub/icons/es/ByteDance/components/Color';
import ClaudeIcon from '@lobehub/icons/es/Claude/components/Color';
import DeepSeekIcon from '@lobehub/icons/es/DeepSeek/components/Color';
import FluxIcon from '@lobehub/icons/es/Flux/components/Mono';
import GeminiIcon from '@lobehub/icons/es/Gemini/components/Color';
import GrokIcon from '@lobehub/icons/es/Grok/components/Mono';
import HailuoIcon from '@lobehub/icons/es/Hailuo/components/Color';
import KimiIcon from '@lobehub/icons/es/Kimi/components/Color';
import KlingIcon from '@lobehub/icons/es/Kling/components/Color';
import NanoBananaIcon from '@lobehub/icons/es/NanoBanana/components/Color';
import OpenAIIcon from '@lobehub/icons/es/OpenAI/components/Mono';
import QwenIcon from '@lobehub/icons/es/Qwen/components/Color';
import ZAIIcon from '@lobehub/icons/es/ZAI/components/Mono';

const logos = [
  { name: 'GPT', icon: OpenAIIcon },
  { name: 'Claude', icon: ClaudeIcon },
  { name: 'Gemini', icon: GeminiIcon },
  { name: 'Nano Banana', icon: NanoBananaIcon },
  { name: 'Grok', icon: GrokIcon },
  { name: 'Kling', icon: KlingIcon },
  { name: 'DeepSeek', icon: DeepSeekIcon },
  { name: 'FLUX', icon: FluxIcon },
  { name: 'Qwen', icon: QwenIcon },
  { name: 'Kimi', icon: KimiIcon },
  { name: 'GLM', icon: ZAIIcon },
  { name: 'Seedance', icon: ByteDanceIcon },
  { name: 'Seedream', icon: ByteDanceIcon },
  { name: 'Hailuo', icon: HailuoIcon },
].map(({ name, icon }) => ({
  alt: `${name} wordmark`,
  icon,
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
