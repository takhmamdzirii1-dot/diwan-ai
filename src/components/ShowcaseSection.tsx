'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
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

export default function ShowcaseSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    const nextIndex = Math.min(MODES.length - 1, Math.floor(progress * MODES.length));
    setActiveIndex((current) => (current === nextIndex ? current : nextIndex));
  });

  const activeMode = MODES[activeIndex];
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <section
      ref={sectionRef}
      id="showcase"
      aria-label="VANTRA Chat, Image, and Video showcase"
      className="relative h-[300vh] bg-[#050505]"
    >
      <div id="models" className="sticky top-0 flex h-screen min-h-[640px] items-center overflow-hidden py-10 lg:py-12">
        <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <header className="mb-7 text-center lg:mb-8">
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
            <div className="grid grid-cols-3 border-y border-white/[0.08] lg:block lg:border-y-0">
              {MODES.map((mode, index) => {
                const isActive = index === activeIndex;

                return (
                  <div
                    key={mode.key}
                    aria-current={isActive ? 'step' : undefined}
                    className={cn(
                      'relative min-w-0 border-e border-white/[0.08] px-3 py-4 last:border-e-0 lg:border-e-0 lg:border-b lg:px-0 lg:py-6 lg:last:border-b-0',
                      isActive ? 'text-white' : 'text-white/35'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute start-0 top-0 h-px bg-white transition-[width,opacity] duration-300 lg:top-auto lg:bottom-0',
                        isActive ? 'w-16 opacity-100' : 'w-0 opacity-0'
                      )}
                    />
                    <p className="text-lg font-medium tracking-tight transition-colors duration-300 sm:text-xl lg:text-2xl">
                      {mode.label}
                    </p>

                    <AnimatePresence initial={false} mode="wait">
                      {isActive && (
                        <motion.p
                          key={`${mode.key}-description`}
                          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                          transition={transition}
                          className="mt-3 hidden max-w-[245px] text-sm font-medium leading-6 text-white/60 lg:block"
                        >
                          {mode.description}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              <AnimatePresence initial={false} mode="wait">
                <motion.p
                  key={`${activeMode.key}-mobile-description`}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={transition}
                  className="col-span-3 border-t border-white/[0.08] py-4 text-sm leading-6 text-white/55 lg:hidden"
                >
                  {activeMode.description}
                </motion.p>
              </AnimatePresence>
            </div>

            <div className="relative min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#090909] p-1.5 sm:p-2">
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[#070707] sm:aspect-[16/9] lg:aspect-[1.8/1]">
                {MODES.map((mode, index) => {
                  const isActive = index === activeIndex;

                  return (
                    <motion.div
                      key={mode.key}
                      aria-hidden={!isActive}
                      initial={false}
                      animate={
                        isActive
                          ? { opacity: 1, y: 0, scale: 1 }
                          : { opacity: 0, y: index < activeIndex ? -10 : 14, scale: 0.99 }
                      }
                      transition={transition}
                      className={cn('absolute inset-0', isActive ? 'z-10' : 'pointer-events-none z-0')}
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
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2" aria-hidden="true">
            {MODES.map((mode, index) => (
              <span
                key={`${mode.key}-progress`}
                className={cn(
                  'h-1 rounded-full transition-[width,background-color] duration-300',
                  index === activeIndex ? 'w-8 bg-white/80' : 'w-2 bg-white/15'
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
