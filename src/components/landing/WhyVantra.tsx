'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

type SupportingFeature = {
  title: string;
  description: string;
  visual: 'balance' | 'models' | 'workspace';
};

const CARD_MOTION = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-70px' },
};

function NumberBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex h-8 min-w-10 self-start items-center justify-center rounded-full border border-white/[0.09] bg-black/30 px-3 text-[10px] font-semibold tracking-[0.18em] text-white/45">
      {children}
    </span>
  );
}

function PaymentVisual({ tags }: { tags: string[] }) {
  return (
    <div className="flex h-full flex-col justify-between gap-8">
      <div className="relative mx-auto flex min-h-40 w-full max-w-[260px] items-center justify-center sm:mx-0 sm:ms-auto">
        <span className="absolute bottom-3 h-8 w-3/4 rounded-full bg-white/[0.04] blur-xl" />
        <div className="relative w-[220px] rotate-[3deg] rounded-2xl border border-white/[0.14] bg-[#0d0d0e] p-5 shadow-[0_20px_55px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between text-[9px] font-semibold tracking-[0.2em] text-white/35">
            <span>VANTRA</span>
            <span>LOCAL</span>
          </div>
          <div className="mt-10 text-4xl font-semibold tracking-[-0.04em] text-white">DA</div>
          <div className="mt-5 h-px w-full bg-white/[0.08]" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[11px] text-white/50">
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-white/50" />
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function BalanceVisual({ modes }: { modes: string[] }) {
  return (
    <div dir="ltr" className="w-full max-w-[270px] rounded-2xl border border-white/[0.1] bg-black/35 p-4">
      <div className="flex items-center justify-between text-[9px] font-semibold tracking-[0.17em] text-white/35">
        <span>VANTRA BALANCE</span>
        <span className="rounded-md border border-white/[0.09] bg-white/[0.04] px-2 py-1 text-white/55">DA</span>
      </div>
      <div className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-white">12,450</div>
      <div className="mt-5 grid grid-cols-3 gap-1.5 border-t border-white/[0.07] pt-3">
        {modes.map((mode, index) => (
          <span key={mode} className="flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.035] px-2 py-2 text-[10px] text-white/50">
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${index === 0 ? 'bg-white/75' : 'bg-white/25'}`} />
            {mode}
          </span>
        ))}
      </div>
    </div>
  );
}

function ModelsVisual({ labels }: { labels: string[] }) {
  return (
    <div dir="ltr" className="grid w-full max-w-[280px] grid-cols-2 gap-2">
      {labels.map((label, index) => (
        <span key={label} className={`flex min-h-12 items-center rounded-xl border px-3 text-[11px] font-medium ${index === 0 ? 'border-white/[0.15] bg-white/[0.08] text-white/85' : 'border-white/[0.08] bg-black/25 text-white/50'}`}>
          <span aria-hidden="true" className="me-2 h-2 w-2 rounded-full border border-white/30" />
          {label}
        </span>
      ))}
    </div>
  );
}

function WorkspaceVisual({ modes }: { modes: string[] }) {
  return (
    <div dir="ltr" className="w-full max-w-[290px] rounded-2xl border border-white/[0.1] bg-black/35 p-3.5">
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/[0.06] bg-black/30 p-1 text-[9px] text-white/35">
        {modes.map((mode, index) => (
          <span key={mode} className={`rounded-md px-2 py-2 text-center ${index === 0 ? 'bg-white/[0.1] text-white/85' : ''}`}>
            {mode}
          </span>
        ))}
      </div>
      <div className="space-y-2 px-1 pb-5 pt-4">
        <span className="block h-1.5 w-3/4 rounded-full bg-white/[0.08]" />
        <span className="block h-1.5 w-1/2 rounded-full bg-white/[0.05]" />
      </div>
      <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-3">
        <span className="text-[9px] text-white/25">Ask anything...</span>
        <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs text-black">↑</span>
      </div>
    </div>
  );
}

export default function WhyVantra() {
  const t = useTranslations('why');
  const features = t.raw('features') as SupportingFeature[];
  const modelLabels = t.raw('modelLabels') as string[];
  const modes = t.raw('modes') as string[];
  const localTags = t.raw('localTags') as string[];

  return (
    <section id="why-vantra" className="relative overflow-hidden bg-[#050505] py-28 md:py-36">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-64 max-w-4xl -translate-y-1/2 rounded-full border border-white/[0.025] shadow-[0_0_120px_rgba(255,255,255,0.025)]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="border-t border-white/[0.07] pt-12 md:pt-16">
          <motion.header
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-3xl text-center"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">{t('label')}</p>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl md:text-6xl">
              {t('title')}
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-7 text-white/45 md:text-base">
              {t('subtitle')}
            </p>
          </motion.header>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-[1.06fr_0.94fr] lg:gap-6">
            <motion.article
              {...CARD_MOTION}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="flex min-h-[360px] flex-col rounded-[28px] border border-white/[0.11] bg-[#0a0a0b] p-6 shadow-[0_18px_70px_rgba(0,0,0,0.28)] sm:p-8"
            >
              <NumberBadge>01</NumberBadge>
              <div className="mt-7 grid flex-1 gap-7 sm:grid-cols-[minmax(0,0.9fr)_minmax(220px,1.1fr)] sm:items-center">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-white">{t('localTitle')}</h3>
                  <p className="mt-4 max-w-sm text-sm leading-6 text-white/50">{t('localDescription')}</p>
                </div>
                <PaymentVisual tags={localTags} />
              </div>
            </motion.article>

            {features.map((feature, index) => (
              <motion.article
                {...CARD_MOTION}
                key={feature.title}
                transition={{ duration: 0.5, delay: (index + 1) * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="flex min-h-[320px] flex-col rounded-[28px] border border-white/[0.08] bg-[#09090a] p-6 shadow-[0_18px_65px_rgba(0,0,0,0.22)] sm:p-8"
              >
                <NumberBadge>{`0${index + 2}`}</NumberBadge>
                <div className="mt-7 grid flex-1 gap-7 sm:grid-cols-[minmax(0,0.9fr)_minmax(220px,1.1fr)] sm:items-center">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{feature.title}</h3>
                    <p className="mt-4 max-w-sm text-sm leading-6 text-white/50">{feature.description}</p>
                  </div>
                  <div className="flex justify-start sm:justify-end">
                    {feature.visual === 'balance' && <BalanceVisual modes={modes} />}
                    {feature.visual === 'models' && <ModelsVisual labels={modelLabels} />}
                    {feature.visual === 'workspace' && <WorkspaceVisual modes={modes} />}
                  </div>
                </div>
              </motion.article>
            ))}
          </div>

          <div className="mt-6 border-b border-white/[0.07]" />
        </div>
      </div>
    </section>
  );
}
