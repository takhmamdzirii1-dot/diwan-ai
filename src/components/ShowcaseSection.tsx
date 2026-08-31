'use client';

import Image from 'next/image';
import React, { useEffect, useRef, useState } from 'react';

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

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** Maps raw progress through a sub-range and applies easeOutCubic */
function phase(raw: number, start: number, end: number) {
  return easeOut(clamp((raw - start) / (end - start), 0, 1));
}

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export default function ShowcaseSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);

  useEffect(() => {
    let raf: number | null = null;

    const update = () => {
      raf = null;
      const section = sectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;

      const raw = clamp(-rect.top / scrollable, 0, 1);

      // Active index for text labels
      const idx = raw < 0.42 ? 0 : raw < 0.85 ? 1 : 2;
      if (idx !== activeIndexRef.current) {
        activeIndexRef.current = idx;
        setActiveIndex(idx);
      }

      const isMobile = window.innerWidth < 768;
      const push = isMobile ? 120 : 280;

      // ── Chat (index 0) ──
      // Phase 1 (0.08–0.32): moves right alone, stays visible
      // Phase 2 (0.35–0.50): dims slightly as Image takes over
      const chatMove = phase(raw, 0.08, 0.32);
      const chatDim = phase(raw, 0.35, 0.50);

      // ── Image (index 1) ──
      // Appears (0.30–0.42) while Chat is pushed right
      // Moves right (0.52–0.76) alone before Video appears
      // Dims (0.78–0.88) as Video takes over
      const imgAppear = phase(raw, 0.30, 0.42);
      const imgMove = phase(raw, 0.52, 0.76);
      const imgDim = phase(raw, 0.78, 0.88);

      // ── Video (index 2) ──
      // Appears (0.78–0.90) while Image is pushed right
      const vidAppear = phase(raw, 0.78, 0.90);

      // Apply transforms per panel
      for (let i = 0; i < 3; i++) {
        const el = panelRefs.current[i];
        if (!el) continue;

        let translateX = 0;
        let opacity = 0;
        let scale = 1;

        if (i === 0) {
          // Chat
          translateX = chatMove * push;
          scale = 1 - chatMove * 0.04;
          opacity = 1 - chatDim * 0.4; // dims but never fully disappears
        } else if (i === 1) {
          // Image
          opacity = imgAppear;
          translateX = imgMove * push;
          scale = 1 - imgMove * 0.04;
          opacity = opacity * (1 - imgDim * 0.4);
        } else {
          // Video
          opacity = vidAppear;
          translateX = 0;
          scale = 1;
        }

        el.style.transform = `translateX(${translateX.toFixed(2)}px) scale(${scale.toFixed(4)})`;
        el.style.opacity = clamp(opacity, 0, 1).toFixed(3);
      }
    };

    const onScroll = () => {
      if (raf === null) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id='showcase'
      data-studio-scroll-section
      aria-label='VANTRA Chat, Image, and Video showcase'
      className='relative h-[500vh] bg-[#050505]'
    >
      {/* Sticky scene — pinned for the full 500vh */}
      <div className='sticky top-0 flex h-[100svh] min-h-[640px] items-center overflow-hidden py-10 lg:py-12'>
        <div className='mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12'>
          <header className='mb-7 text-center lg:mb-8'>
            <p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35'>
              The VANTRA workspace
            </p>
            <h2 className='mt-3 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl xl:text-5xl'>
              One studio. Every medium.
            </h2>
            <p className='mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/45 sm:text-base'>
              Chat, generate images, and create video in one workspace.
            </p>
          </header>

          <div className='grid items-center gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12 xl:gap-16'>
            {/* ── Left: feature rail ── */}
            <div className='grid grid-cols-3 border-y border-white/[0.08] lg:block lg:border-y-0'>
              {MODES.map((mode, index) => {
                const isActive = index === activeIndex;
                return (
                  <div
                    key={mode.key}
                    aria-current={isActive ? 'step' : undefined}
                    className={cn(
                      'relative min-w-0 border-e border-white/[0.08] px-3 py-4 last:border-e-0 lg:border-e-0 lg:border-b lg:px-0 lg:py-6 lg:last:border-b-0 transition-colors duration-300',
                      isActive
                        ? 'font-semibold text-white'
                        : 'font-medium text-white/35'
                    )}
                  >
                    <p className='text-lg font-medium tracking-tight transition-colors duration-300 sm:text-xl lg:text-2xl'>
                      {mode.label}
                    </p>

                    <span
                      aria-hidden='true'
                      className={cn(
                        'absolute bottom-0 start-0 h-[2px] bg-white transition-all duration-300 lg:bottom-6',
                        isActive ? 'w-full' : 'w-0'
                      )}
                    />

                    <span
                      aria-hidden='true'
                      className={cn(
                        'mt-4 block h-px w-full bg-white/10 transition-opacity duration-300',
                        isActive && 'opacity-0'
                      )}
                    />
                  </div>
                );
              })}

              {/* Description — crossfade per active */}
              <div className='relative col-span-3 min-h-[72px] border-t border-white/[0.08] py-4 lg:mt-1 lg:min-h-[82px] lg:border-t-0 lg:py-5'>
                {MODES.map((mode, index) => (
                  <p
                    key={mode.key}
                    className={cn(
                      'absolute inset-x-0 top-4 max-w-[245px] text-sm font-medium leading-6 transition-opacity duration-300 lg:top-5',
                      index === activeIndex
                        ? 'text-white/60 opacity-100'
                        : 'opacity-0'
                    )}
                  >
                    {mode.description}
                  </p>
                ))}
              </div>
            </div>

            {/* ── Right: visual stage — all three images layered ── */}
            <div className='relative z-10 min-w-0'>
              <div className='relative w-full overflow-hidden rounded-2xl bg-[#090909] p-1.5 sm:p-2'>
                <div className='relative aspect-[16/10] overflow-hidden rounded-xl bg-[#070707] sm:aspect-[16/9] lg:aspect-[1.8/1]'>
                  {MODES.map((mode, index) => (
                    <div
                      key={mode.key}
                      ref={(el) => {
                        panelRefs.current[index] = el;
                      }}
                      className='absolute inset-0 will-change-transform'
                      style={{
                        opacity: index === 0 ? 1 : 0,
                      }}
                      aria-hidden={index !== 0}
                    >
                      <Image
                        src={mode.image}
                        alt={`${mode.label} preview in VANTRA Studio`}
                        fill
                        loading={index === 0 ? 'eager' : 'lazy'}
                        sizes='(max-width: 1023px) 100vw, 75vw'
                        className='object-cover object-center'
                      />
                    </div>
                  ))}
                </div>
                <div
                  aria-hidden='true'
                  className='pointer-events-none absolute inset-0 rounded-2xl border border-white/10'
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}
