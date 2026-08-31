'use client';

import Image from 'next/image';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';

import { cn } from '@/lib/utils';

const MODES = [
  {
    key: 'chat',
    label: 'Chat',
    description: 'For questions, writing, research, and everyday help.',
    image: '/showcase/chat-preview.png',
  },
  {
    key: 'image',
    label: 'Image',
    description: 'Create, refine, and edit images with leading models.',
    image: '/showcase/image-preview.png',
  },
  {
    key: 'video',
    label: 'Video',
    description: 'Turn prompts or images into cinematic video clips.',
    image: '/showcase/video-preview.png',
  },
] as const;

const INTRO_END = 0.2;
const CHAT_END = 0.46;
const IMAGE_END = 0.73;

type ShowcasePhase = 'intro' | 'chat' | 'image' | 'video';

function ModeProgressLine({
  progress,
  range,
}: {
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const localProgress = useTransform(progress, range, [0, 1], { clamp: true });

  return (
    <span
      aria-hidden="true"
      className="mt-4 block h-px w-full overflow-hidden bg-white/10"
    >
      <motion.span
        style={{ scaleX: localProgress }}
        className="block h-full origin-left bg-white/85"
      />
    </span>
  );
}

export default function ShowcaseSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [activePhase, setActivePhase] = useState<ShowcasePhase>('intro');
  const reduceMotion = useReducedMotion();
  const introX = useMotionValue(0);
  const introScale = useMotionValue(1);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });
  const introProgress = useTransform(scrollYProgress, [0, INTRO_END], [0, 1], {
    clamp: true,
  });
  const previewX = useTransform(
    [introProgress, introX],
    ([progress, startX]) => Number(startX) * (1 - Number(progress))
  );
  const previewY = useTransform(introProgress, [0, 1], [-12, 0]);
  const previewScale = useTransform(
    [introProgress, introScale],
    ([progress, startScale]) =>
      1 + (Number(startScale) - 1) * (1 - Number(progress))
  );
  const navigationOpacity = useTransform(introProgress, [0.2, 0.88], [0, 1], {
    clamp: true,
  });
  const navigationX = useTransform(introProgress, [0.2, 0.88], [-20, 0], {
    clamp: true,
  });

  useLayoutEffect(() => {
    const sticky = stickyRef.current;
    const preview = previewRef.current;

    if (!sticky || !preview) return;

    const measure = () => {
      const stickyRect = sticky.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      const isDesktop = stickyRect.width >= 1024;

      if (!isDesktop) {
        introX.set(0);
        introScale.set(1.06);
        return;
      }

      const targetWidth = Math.min(stickyRect.width * 0.82, 1320);
      introX.set(stickyRect.left + stickyRect.width / 2 - (previewRect.left + previewRect.width / 2));
      introScale.set(Math.min(1.35, Math.max(1, targetWidth / previewRect.width)));
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(sticky);
    resizeObserver.observe(preview);

    return () => resizeObserver.disconnect();
  }, [introScale, introX]);

  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    const nextPhase: ShowcasePhase =
      progress < INTRO_END
        ? 'intro'
        : progress < CHAT_END
          ? 'chat'
          : progress < IMAGE_END
            ? 'image'
            : 'video';

    setActivePhase((current) => (current === nextPhase ? current : nextPhase));
  });

  const activeIndex =
    activePhase === 'image' ? 1 : activePhase === 'video' ? 2 : 0;
  const activeMode = MODES[activeIndex];
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const };
  const descriptionTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <section
      ref={sectionRef}
      id="showcase"
      data-studio-scroll-section
      data-showcase-phase={activePhase}
      aria-label="VANTRA Chat, Image, and Video showcase"
      className="relative h-[400vh] bg-[#050505]"
    >
      <div
        ref={stickyRef}
        id="models"
        data-sticky-scene
        className="sticky top-0 flex h-[100svh] min-h-[640px] items-center overflow-hidden py-10 lg:py-12"
      >
        <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <header data-scene-header className="mb-7 text-center lg:mb-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">
              The VANTRA workspace
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl xl:text-5xl">
              One studio. Every medium.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/45 sm:text-base">
              Chat, generate images, and create video in one workspace.
            </p>
          </header>

          <div className="grid items-center gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12 xl:gap-16">
            <motion.div
              data-tab-rail
              style={reduceMotion ? undefined : { opacity: navigationOpacity, x: navigationX }}
              className="grid grid-cols-3 border-y border-white/[0.08] lg:block lg:border-y-0"
            >
              {MODES.map((mode, index) => {
                const isActive = activePhase !== 'intro' && index === activeIndex;
                const progressRange =
                  index === 0
                    ? ([INTRO_END, CHAT_END] as [number, number])
                    : index === 1
                      ? ([CHAT_END, IMAGE_END] as [number, number])
                      : ([IMAGE_END, 1] as [number, number]);

                return (
                  <div
                    key={mode.key}
                    aria-current={isActive ? 'step' : undefined}
                    className={cn(
                      'relative min-w-0 border-e border-white/[0.08] px-3 py-4 last:border-e-0 lg:border-e-0 lg:border-b lg:px-0 lg:py-6 lg:last:border-b-0',
                      isActive ? 'font-semibold text-white' : 'font-medium text-white/35'
                    )}
                  >
                    <p className="text-lg font-medium tracking-tight transition-colors duration-300 sm:text-xl lg:text-2xl">
                      {mode.label}
                    </p>

                    <ModeProgressLine
                      progress={scrollYProgress}
                      range={progressRange}
                    />
                  </div>
                );
              })}

              <div
                data-showcase-description-container
                className="relative col-span-3 min-h-[72px] border-t border-white/[0.08] py-4 lg:mt-1 lg:min-h-[82px] lg:border-t-0 lg:py-5"
              >
                <AnimatePresence initial={false} mode="sync">
                  {activePhase !== 'intro' && (
                    <motion.p
                      key={`${activeMode.key}-description`}
                      data-showcase-description={activeMode.key}
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={descriptionTransition}
                      className="absolute inset-x-0 top-4 max-w-[245px] text-sm font-medium leading-6 text-white/60 lg:top-5"
                    >
                      {activeMode.description}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            <div
              ref={previewRef}
              data-demo-viewport
              className="relative z-10 min-w-0"
            >
              <motion.div
                data-demo-frame
                style={
                  reduceMotion
                    ? undefined
                    : { x: previewX, y: previewY, scale: previewScale }
                }
                className="relative w-full overflow-hidden rounded-2xl bg-[#090909] p-1.5 sm:p-2"
              >
                <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[#070707] sm:aspect-[16/9] lg:aspect-[1.8/1]">
                  {MODES.map((mode, index) => {
                    const isActivePanel = index === activeIndex;

                    return (
                    <motion.div
                      key={mode.key}
                      data-demo-panel={mode.key}
                      initial={false}
                      animate={
                        isActivePanel
                          ? { opacity: 1, y: 0, scale: 1 }
                          : reduceMotion
                            ? { opacity: 0 }
                            : { opacity: 0, y: -8, scale: 0.98 }
                      }
                      transition={transition}
                      className="absolute inset-0 pointer-events-none"
                      aria-hidden={!isActivePanel}
                    >
                      <Image
                        src={mode.image}
                        alt={`${mode.label} preview in VANTRA Studio`}
                        fill
                        loading="eager"
                        sizes="(max-width: 1023px) 100vw, 75vw"
                        className="origin-right scale-[1.28] object-cover object-right"
                      />
                    </motion.div>
                    );
                  })}
                </div>
                <div
                  aria-hidden="true"
                  data-frame-overlay
                  className="pointer-events-none absolute inset-0 rounded-2xl border border-white/10"
                />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
