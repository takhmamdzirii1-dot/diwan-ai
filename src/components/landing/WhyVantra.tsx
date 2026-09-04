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

const MODEL_CHIPS = ['GPT-4o', 'Claude 3.5', 'Gemini 1.5', '+ More models'];

function NumberBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex h-8 min-w-10 self-start items-center justify-center rounded-full border border-white/[0.09] bg-black/30 px-3 text-[10px] font-semibold tracking-[0.18em] text-white/45">
      {children}
    </span>
  );
}

function PaymentVisual() {
  return (
    <div className="relative mx-auto flex min-h-[180px] w-full max-w-[270px] items-center justify-center sm:mx-0 sm:ms-auto">
      <span aria-hidden="true" className="absolute bottom-4 h-7 w-[72%] rounded-[50%] bg-white/[0.07] blur-xl" />
      <div className="relative w-[226px] overflow-hidden rounded-[19px] border border-white/[0.15] bg-[linear-gradient(135deg,#18181a_0%,#0d0d0f_48%,#141416_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_22px_46px_rgba(0,0,0,0.52)] [transform:perspective(900px)_rotate(-2.5deg)_rotateY(-3deg)]">
        <span aria-hidden="true" className="absolute inset-x-5 top-0 h-px bg-white/20" />
        <span aria-hidden="true" className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.38)_24%,rgba(255,255,255,0.08)_48%,transparent_72%)] blur-[1.5px]" />
        <div className="flex items-center justify-between text-[8px] font-semibold tracking-[0.2em] text-white/38">
          <span>VANTRA</span>
          <span>LOCAL</span>
        </div>
        <div className="mt-10 text-[42px] font-semibold leading-none tracking-[-0.06em] text-white">DA</div>
        <div className="mt-6 flex items-center justify-between border-t border-white/[0.08] pt-2.5 text-[7px] font-medium tracking-[0.15em] text-white/28">
          <span>VANTRA STUDIO</span>
          <span>LOCAL ACCESS</span>
        </div>
      </div>
    </div>
  );
}

function BalanceVisual({ modes }: { modes: string[] }) {
  return (
    <div dir="ltr" className="relative w-full max-w-[314px] pb-5 pt-2">
      <span aria-hidden="true" className="absolute bottom-0 left-1/2 h-16 w-[92%] -translate-x-1/2 [background-image:linear-gradient(rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:12px_12px] opacity-20 [transform:translateX(-50%)_perspective(130px)_rotateX(60deg)] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.7),transparent)]" />
      <div className="relative rounded-[20px] border border-white/[0.13] bg-[linear-gradient(145deg,rgba(255,255,255,0.065),rgba(255,255,255,0.018))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_18px_38px_rgba(0,0,0,0.32)]">
        <div className="flex items-center justify-between text-[9px] font-semibold tracking-[0.17em] text-white/42">
          <span>VANTRA BALANCE</span>
          <span className="rounded-md border border-white/[0.12] bg-white/[0.06] px-2 py-1 text-white/65">DA</span>
        </div>
        <div className="mt-7 text-[38px] font-semibold leading-none tracking-[-0.055em] text-white">12,450</div>
        <div className="mt-7 grid grid-cols-3 gap-1.5 border-t border-white/[0.1] pt-4">
          {modes.map((mode, index) => (
            <span key={mode} className="flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.045] px-2 py-2.5 text-[10px] text-white/60">
              <span aria-hidden="true" className={`h-2 w-2 rounded-sm border ${index === 0 ? 'border-white/60 bg-white/55' : 'border-white/30 bg-transparent'}`} />
              {mode}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModelsVisual() {
  return (
    <div dir="ltr" className="grid w-full max-w-[300px] grid-cols-2 gap-2.5">
      {MODEL_CHIPS.map((label, index) => (
        <span key={label} className={`flex min-h-[52px] items-center rounded-xl border px-3 text-[11px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${index === 0 ? 'border-white/[0.17] bg-white/[0.09] text-white/90' : 'border-white/[0.1] bg-black/30 text-white/60'}`}>
          <span aria-hidden="true" className={`me-2.5 flex h-4 w-4 items-center justify-center rounded-md border text-[8px] ${index === 0 ? 'border-white/45 bg-white/10 text-white/80' : 'border-white/20 text-white/40'}`}>{index === 0 ? '✦' : '·'}</span>
          {label}
        </span>
      ))}
    </div>
  );
}

function WorkspaceVisual({ modes }: { modes: string[] }) {
  return (
    <div dir="ltr" className="w-full max-w-[328px] rounded-[20px] border border-white/[0.13] bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.018))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_18px_38px_rgba(0,0,0,0.32)]">
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/[0.08] bg-black/35 p-1 text-[10px] text-white/40">
        {modes.map((mode, index) => (
          <span key={mode} className={`rounded-md px-2 py-2 text-center ${index === 0 ? 'bg-white/[0.1] text-white/85' : ''}`}>
            {mode}
          </span>
        ))}
      </div>
      <div className="space-y-2.5 px-1 pb-6 pt-5">
        <span className="block h-1.5 w-3/4 rounded-full bg-white/[0.1]" />
        <span className="block h-1.5 w-1/2 rounded-full bg-white/[0.065]" />
        <span className="block h-1.5 w-2/3 rounded-full bg-white/[0.045]" />
      </div>
      <div className="flex items-center justify-between rounded-xl border border-white/[0.1] bg-white/[0.045] px-3.5 py-3.5">
        <span className="text-[10px] text-white/30">Ask anything...</span>
        <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs text-black">↑</span>
      </div>
    </div>
  );
}

export default function WhyVantra() {
  const t = useTranslations('why');
  const features = t.raw('features') as SupportingFeature[];
  const modes = t.raw('modes') as string[];
  const localTags = t.raw('localTags') as string[];

  return (
    <section id="why-vantra" className="relative overflow-hidden bg-[#050505] py-28 md:py-36">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-64 max-w-4xl -translate-y-1/2 rounded-full border border-white/[0.025] shadow-[0_0_120px_rgba(255,255,255,0.025)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.022)_1px,transparent_1px)] [background-size:56px_56px]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="relative border-t border-white/[0.07] pt-12 md:pt-16">
          <span aria-hidden="true" className="absolute left-1/2 top-0 h-px w-10 -translate-x-1/2 bg-white/70 shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
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

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:gap-6">
            <motion.article
              {...CARD_MOTION}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex min-h-[390px] flex-col overflow-hidden rounded-[28px] border border-white/[0.13] bg-[linear-gradient(145deg,#121214_0%,#0a0a0b_48%,#0e0e10_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_22px_70px_rgba(0,0,0,0.35)] sm:p-8"
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/25" />
              <NumberBadge>01</NumberBadge>
              <div className="mt-8 grid flex-1 gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(210px,0.9fr)] sm:items-center">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-white">{t('localTitle')}</h3>
                  <p className="mt-4 max-w-sm text-sm leading-6 text-white/50">{t('localDescription')}</p>
                </div>
                <PaymentVisual />
              </div>
              <div className="mt-8 inline-flex w-fit max-w-full items-center divide-x divide-white/[0.1] rounded-full border border-white/[0.1] bg-black/30 px-3.5 py-2.5 text-[10px] text-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                <span className="inline-flex items-center gap-2 pe-3.5">
                  <svg aria-hidden="true" className="h-3 w-3 shrink-0 text-white/70" viewBox="0 0 12 12" fill="none"><path d="m2.5 6.1 2.2 2.15 4.8-4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {localTags[0]}
                </span>
                <span className="ps-3.5">{localTags[1]}</span>
              </div>
            </motion.article>

            {features.map((feature, index) => (
              <motion.article
                {...CARD_MOTION}
                key={feature.title}
                transition={{ duration: 0.5, delay: (index + 1) * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex min-h-[330px] flex-col overflow-hidden rounded-[28px] border border-white/[0.1] bg-[linear-gradient(145deg,#111113_0%,#09090a_52%,#0d0d0f_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.085),0_18px_65px_rgba(0,0,0,0.28)] sm:p-8"
              >
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/[0.18]" />
                <NumberBadge>{`0${index + 2}`}</NumberBadge>
                <div className="mt-7 grid flex-1 gap-7 sm:grid-cols-[minmax(0,0.9fr)_minmax(220px,1.1fr)] sm:items-center">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{feature.title}</h3>
                    <p className="mt-4 max-w-sm text-sm leading-6 text-white/50">{feature.description}</p>
                  </div>
                  <div className="flex justify-start sm:justify-end">
                    {feature.visual === 'balance' && <BalanceVisual modes={modes} />}
                    {feature.visual === 'models' && <ModelsVisual />}
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
