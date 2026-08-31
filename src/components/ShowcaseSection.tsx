'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

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

function clampProgress(value: number) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value ** 3
    : 1 - (-2 * value + 2) ** 3 / 2;
}

export default function ShowcaseSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const sectionProgress = useMotionValue(0);
  const viewportWidth = useMotionValue(0);
  const frameY = useTransform(sectionProgress, (progress) =>
    120 * (1 - easeOutCubic(clampProgress(progress / 0.2)))
  );
  const frameScale = useTransform(sectionProgress, (progress) => {
    const entrance = easeOutCubic(clampProgress(progress / 0.2));
    const horizontal = easeInOutCubic(clampProgress((progress - 0.42) / 0.28));

    return 0.94 + 0.06 * entrance - 0.03 * horizontal;
  });
  const frameOpacity = useTransform(sectionProgress, (progress) =>
    easeOutCubic(clampProgress(progress / 0.2))
  );
  const frameX = useTransform([sectionProgress, viewportWidth], ([progress, width]) => {
    const horizontal = easeInOutCubic(
      clampProgress((Number(progress) - 0.42) / 0.28)
    );
    const target = Math.min(260, Math.max(90, Number(width) * 0.18));

    return target * horizontal;
  });

  useEffect(() => {
    let frameId: number | null = null;

    const updateProgress = () => {
      frameId = null;
      const section = sectionRef.current;

      if (!section) return;

      const sectionTop = window.scrollY + section.getBoundingClientRect().top;
      const sectionHeight = section.offsetHeight;
      const viewportHeight = window.innerHeight;
      const nextProgress = clampProgress(
        (window.scrollY - sectionTop) /
          Math.max(1, sectionHeight - viewportHeight)
      );

      sectionProgress.set(nextProgress);
      viewportWidth.set(window.innerWidth);
    };

    const requestProgressUpdate = () => {
      if (frameId === null) frameId = window.requestAnimationFrame(updateProgress);
    };

    requestProgressUpdate();
    window.addEventListener('scroll', requestProgressUpdate, { passive: true });
    window.addEventListener('resize', requestProgressUpdate);

    return () => {
      window.removeEventListener('scroll', requestProgressUpdate);
      window.removeEventListener('resize', requestProgressUpdate);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [sectionProgress, viewportWidth]);

  return (
    <section
      ref={sectionRef}
      id="showcase"
      data-studio-scroll-section
      aria-label="VANTRA Chat, Image, and Video showcase"
      className="relative h-[400vh] bg-[#050505]"
    >
      <div
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
            <div data-tab-rail className="grid grid-cols-3 border-y border-white/[0.08] lg:block lg:border-y-0">
              {MODES.map((mode, index) => {
                const isActive = index === 0;

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

                    <span aria-hidden="true" className="mt-4 block h-px w-full bg-white/10" />
                  </div>
                );
              })}

              <div
                data-showcase-description-container
                className="relative col-span-3 min-h-[72px] border-t border-white/[0.08] py-4 lg:mt-1 lg:min-h-[82px] lg:border-t-0 lg:py-5"
              >
                <p
                  data-showcase-description="chat"
                  className="absolute inset-x-0 top-4 max-w-[245px] text-sm font-medium leading-6 text-white/60 lg:top-5"
                >
                  {MODES[0].description}
                </p>
              </div>
            </div>

            <div
              data-demo-viewport
              className="relative z-10 min-w-0 overflow-hidden"
            >
              <motion.div
                data-demo-frame
                style={{ x: frameX, y: frameY, scale: frameScale, opacity: frameOpacity, willChange: 'transform, opacity' }}
                className="relative w-full overflow-hidden rounded-2xl bg-[#090909] p-1.5 [will-change:transform,opacity] sm:p-2"
              >
                <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[#070707] sm:aspect-[16/9] lg:aspect-[1.8/1]">
                  {MODES.map((mode, index) => {
                    return (
                    <div
                      key={mode.key}
                      data-demo-panel={mode.key}
                      className={cn(
                        'pointer-events-none absolute inset-0',
                        index === 0 ? 'opacity-100' : 'opacity-0'
                      )}
                      style={{ transition: 'none', willChange: 'opacity' }}
                      aria-hidden={index !== 0}
                    >
                      <Image
                        src={mode.image}
                        alt={`${mode.label} preview in VANTRA Studio`}
                        fill
                        loading="eager"
                        sizes="(max-width: 1023px) 100vw, 75vw"
                        className="origin-right scale-[1.28] object-cover object-right"
                      />
                    </div>
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
