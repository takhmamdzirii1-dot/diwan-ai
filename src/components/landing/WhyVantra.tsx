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
const FEATURE_EYEBROWS: Record<SupportingFeature['visual'], string> = {
  balance: 'ONE BALANCE',
  models: 'FRONTIER MODELS',
  workspace: 'UNIFIED WORKSPACE',
};

function NumberBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex h-8 min-w-11 items-center justify-center rounded-[13px] border border-white/[0.14] bg-white/[0.015] px-3 text-xs font-medium tracking-[0.12em] text-[#a0a0a0]">
      {children}
    </span>
  );
}

function PaymentVisual() {
  return (
    <div className="relative mx-auto flex min-h-[170px] w-full max-w-[285px] items-center justify-center sm:mx-0 sm:ms-auto">
      <span aria-hidden="true" className="absolute bottom-1 h-14 w-[96%] rounded-[50%] bg-[radial-gradient(ellipse,rgba(255,255,255,0.13)_0%,rgba(255,255,255,0.035)_48%,transparent_74%)] blur-[16px]" />
      <span aria-hidden="true" className="absolute bottom-4 h-7 w-[88%] rounded-[50%] border border-white/[0.035]" />
      <div className="relative h-[154px] w-[232px] overflow-hidden rounded-[14px] border border-white/[0.28] bg-[linear-gradient(145deg,#19191b_0%,#0d0d0f_52%,#151517_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.13),0_18px_34px_rgba(0,0,0,0.42)] [transform:perspective(1000px)_rotateZ(-2deg)_rotateY(-3deg)]">
        <span aria-hidden="true" className="absolute inset-x-5 top-0 h-px bg-white/20" />
        <span aria-hidden="true" className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.46)_22%,rgba(255,255,255,0.1)_48%,transparent_72%)] blur-[3px]" />
        <div className="flex items-center justify-between text-[8px] font-semibold tracking-[0.2em] text-white/38">
          <span>VANTRA</span>
          <span>LOCAL</span>
        </div>
        <div className="mt-7 text-center text-[54px] font-semibold leading-none tracking-[-0.06em] text-[#f7f7f7]">DA</div>
        <div className="mt-4 flex items-center justify-between border-t border-white/[0.1] pt-2 text-[7px] font-medium tracking-[0.15em] text-white/30">
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-3.5 rounded-sm border border-white/20 bg-white/[0.035]" />VANTRA</span>
          <span>•••• 2040</span>
        </div>
      </div>
    </div>
  );
}

function ModeIcon({ index }: { index: number }) {
  if (index === 0) return <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none"><path d="M3 3.5h10v7H7l-3 2v-2H3v-7Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" /></svg>;
  if (index === 1) return <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="3" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.25" /><path d="m4.5 11 2.5-2.5 1.6 1.6L10.5 8l3 3" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" /><circle cx="10.5" cy="6" r="1" fill="currentColor" /></svg>;
  return <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="3" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.25" /><path d="m7 6 4 2-4 2V6Z" fill="currentColor" /></svg>;
}

function BalanceVisual({ modes }: { modes: string[] }) {
  return (
    <div dir="ltr" className="relative w-full max-w-[314px] pb-5 pt-2">
      <span aria-hidden="true" className="absolute bottom-0 left-1/2 h-16 w-[92%] -translate-x-1/2 [background-image:linear-gradient(rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:12px_12px] opacity-20 [transform:translateX(-50%)_perspective(130px)_rotateX(60deg)] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.7),transparent)]" />
      <div className="relative rounded-[19px] border border-white/[0.2] bg-[linear-gradient(180deg,#111113_0%,#0b0b0c_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_14px_28px_rgba(0,0,0,0.28)]">
        <div className="flex items-center justify-between text-[9px] font-semibold tracking-[0.17em] text-white/42">
          <span>VANTRA BALANCE</span>
          <span className="rounded-md border border-white/[0.12] bg-white/[0.06] px-2 py-1 text-white/65">DA</span>
        </div>
        <div className="mt-5 text-[38px] font-semibold leading-none tracking-[-0.055em] text-white">12,450</div>
        <div className="mt-5 grid grid-cols-3 gap-1.5 border-t border-white/[0.1] pt-3">
          {modes.map((mode, index) => (
            <span key={mode} className="flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.035] px-2 py-2.5 text-[10px] text-white/60">
              <ModeIcon index={index} />
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
    <div dir="ltr" className="grid w-full max-w-[310px] grid-cols-2 gap-3">
      {MODEL_CHIPS.map((label, index) => (
        <span key={label} className={`flex min-h-[64px] items-center rounded-[13px] border px-3.5 text-[11px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] ${index === 0 ? 'border-white/[0.2] bg-white/[0.07] text-white/90' : 'border-white/[0.18] bg-[#0a0a0a] text-white/65'}`}>
          <span aria-hidden="true" className="me-2.5 flex h-5 w-5 items-center justify-center text-[13px] text-white/60">{index === 0 ? '◎' : index === 1 ? '✳' : index === 2 ? '✦' : '+'}</span>
          {label}
        </span>
      ))}
    </div>
  );
}

function WorkspaceVisual({ modes }: { modes: string[] }) {
  return (
    <div dir="ltr" className="w-full max-w-[304px] rounded-[19px] border border-white/[0.19] bg-[linear-gradient(180deg,#111113_0%,#0a0a0b_100%)] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]">
      <div className="mb-3 flex items-center justify-between px-1 text-white/35"><span aria-hidden="true" className="grid h-4 w-4 place-items-center rounded border border-white/20 text-[8px]">V</span><span aria-hidden="true" className="text-xs tracking-[0.2em]">•••</span></div>
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
    <section id="why-vantra" className="relative overflow-hidden bg-[#050505] py-28 md:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-20 mx-auto h-80 max-w-4xl bg-[radial-gradient(ellipse,rgba(255,255,255,0.045)_0%,rgba(255,255,255,0.012)_48%,transparent_74%)] blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] [background-size:56px_56px]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="relative border-t border-white/[0.12] pt-12 md:pt-14">
          <span aria-hidden="true" className="absolute left-1/2 top-0 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85 shadow-[0_0_7px_rgba(255,255,255,0.65)]" />
          <motion.header
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-3xl text-center"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#969696]">{t('label')}</p>
            <h2 className="mt-6 text-4xl font-bold leading-[1.05] tracking-[-0.045em] text-[#f6f6f6] sm:text-5xl md:text-[64px]">
              {t('title')}
            </h2>
            <p className="mx-auto mt-5 max-w-[800px] text-base leading-[1.5] text-[#a3a3a3] md:text-[19px]">
              {t('subtitle')}
            </p>
          </motion.header>

          <div className="mt-11 grid gap-6 md:grid-cols-2">
            <motion.article
              {...CARD_MOTION}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex min-h-[324px] flex-col overflow-hidden rounded-[25px] border border-white/[0.18] bg-[#080808] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] [background-image:linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0.005))] sm:p-8 md:h-[324px]"
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-[22%] top-0 h-px bg-[radial-gradient(ellipse,rgba(255,255,255,0.3),transparent_72%)]" />
              <div className="absolute left-7 top-7 sm:left-8 sm:top-8"><NumberBadge>01</NumberBadge></div>
              <div className="grid flex-1 gap-7 pb-12 pt-14 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.9fr)] sm:items-center">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#8f8f8f]">LOCAL PAYMENTS</p>
                  <h3 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.035em] text-[#f3f3f3]">{t('localTitle')}</h3>
                  <p className="mt-3 max-w-[330px] text-[15px] leading-[1.55] text-[#a3a3a3]">{t('localDescription')}</p>
                </div>
                <PaymentVisual />
              </div>
              <div className="absolute bottom-7 left-7 inline-flex h-10 w-fit max-w-[calc(100%-3.5rem)] items-center divide-x divide-white/[0.12] rounded-[20px] border border-white/[0.14] bg-white/[0.015] px-3.5 text-[10px] text-white/60 sm:bottom-8 sm:left-8">
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
                className="relative flex min-h-[324px] flex-col overflow-hidden rounded-[25px] border border-white/[0.18] bg-[#080808] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] [background-image:linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0.005))] sm:p-8 md:h-[324px]"
              >
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-[22%] top-0 h-px bg-[radial-gradient(ellipse,rgba(255,255,255,0.25),transparent_72%)]" />
                <div className="absolute left-7 top-7 sm:left-8 sm:top-8"><NumberBadge>{`0${index + 2}`}</NumberBadge></div>
                <div className="grid flex-1 gap-7 pt-14 sm:grid-cols-[minmax(0,0.9fr)_minmax(220px,1.1fr)] sm:items-center">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#8f8f8f]">{FEATURE_EYEBROWS[feature.visual]}</p>
                    <h3 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.035em] text-[#f3f3f3]">{feature.title}</h3>
                    <p className="mt-3 max-w-[330px] text-[15px] leading-[1.55] text-[#a3a3a3]">{feature.description}</p>
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

          <div className="mt-10 flex items-center gap-5 text-center text-[10px] font-medium uppercase tracking-[0.24em] text-white/30">
            <span aria-hidden="true" className="h-px flex-1 bg-white/[0.1]" />
            <span>Built for Algeria&nbsp; • &nbsp;Powered by global AI</span>
            <span aria-hidden="true" className="h-px flex-1 bg-white/[0.1]" />
          </div>
        </div>
      </div>
    </section>
  );
}
