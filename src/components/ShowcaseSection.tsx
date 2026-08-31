'use client';

import Image from 'next/image';
import React, { useEffect, useRef, useState } from 'react';

const MODES = [
  {
    key: 'chat',
    label: 'Chat',
    description: 'Ask questions, learn, research, and get help with everyday tasks.',
    image: '/showcase/chat-preview.png',
  },
  {
    key: 'image',
    label: 'Image',
    description: 'Create, refine, and edit visual ideas with AI.',
    image: '/showcase/image-preview.png',
  },
  {
    key: 'video',
    label: 'Video',
    description: 'Turn prompts and images into cinematic video content.',
    image: '/showcase/video-preview.png',
  },
] as const;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** Maps a raw progress value through a sub-range and applies smooth easing */
function phase(raw: number, start: number, end: number) {
  const t = clamp((raw - start) / (end - start), 0, 1);
  return 1 - Math.pow(1 - t, 3); // easeOutCubic
}

export default function ShowcaseSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const imgPanelRef = useRef<HTMLDivElement>(null);
  const videoPanelRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const [activeFeature, setActiveFeature] = useState(0);

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

      // ═══ PHASE BREAKDOWN ═══
      // Phase 1 (0.00–0.15):  Chat alone, large, centered, stable
      // Phase 2 (0.15–0.30):  Chat crossfades into Image
      // Phase 3 (0.30–0.48):  Image stays centered
      // Phase 4 (0.48–0.62):  Image slides right + scales down
      // Phase 5 (0.55–0.68):  Feature explanation panel fades in
      // Phase 6 (0.68–0.95):  Chat → Image → Video explanations cycle
      // Phase 7 (0.95–1.00):  Release

      // ── Chat panel (first visual) ──
      // Visible alone at start, crossfades out during Phase 2
      const chatFade = phase(raw, 0.15, 0.30);
      const chatScale = 1 - chatFade * 0.04;
      const chatShift = chatFade * -30; // subtle drift left

      if (chatPanelRef.current) {
        chatPanelRef.current.style.opacity = (1 - chatFade).toFixed(3);
        chatPanelRef.current.style.transform =
          `translateX(${chatShift.toFixed(1)}px) scale(${chatScale.toFixed(4)})`;
      }

      // ── Image panel (second visual) ──
      // Crossfades in during Phase 2, then slides right during Phase 4
      const imgFadeIn = phase(raw, 0.15, 0.30);
      const imgSlide = phase(raw, 0.48, 0.62);
      const imgScaleDown = phase(raw, 0.48, 0.62);

      if (imgPanelRef.current) {
        imgPanelRef.current.style.opacity = imgFadeIn.toFixed(3);
        imgPanelRef.current.style.transform =
          `translateX(${(imgSlide * 260).toFixed(1)}px) scale(${(1 - imgScaleDown * 0.18).toFixed(4)})`;
      }

      // ── Video panel (third visual) ──
      // Crossfades in on top of the moved Image, inside the main area
      const vidFadeIn = phase(raw, 0.58, 0.70);

      if (videoPanelRef.current) {
        videoPanelRef.current.style.opacity = vidFadeIn.toFixed(3);
      }

      // ── Feature explanation panel reveal ──
      // Appears only after Image has started moving right
      const featuresReveal = phase(raw, 0.52, 0.66);
      if (featuresRef.current) {
        featuresRef.current.style.opacity = featuresReveal.toFixed(3);
        featuresRef.current.style.transform =
          `translateX(${((1 - featuresReveal) * -40).toFixed(1)}px)`;
      }

      // ── Active feature cycling (Chat → Image → Video) ──
      // Starts only after the features panel is visible
      const featureWindow = clamp((raw - 0.68) / 0.27, 0, 1);
      const featIdx = featureWindow < 0.334 ? 0 : featureWindow < 0.667 ? 1 : 2;
      setActiveFeature((prev) => {
        // Clamp: don't activate features before the reveal phase
        if (featuresReveal < 0.5) return 0;
        return prev === featIdx ? prev : featIdx;
      });
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
      aria-label='VANTRA Studio showcase — Chat, Image, and Video'
      className='relative h-[500vh] bg-[#050505]'
    >
      {/* ── Sticky scene ── */}
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

          <div className='grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-10 xl:gap-14'>
            {/* ── Left: Feature explanations (revealed after Image moves right) ── */}
            <div
              ref={featuresRef}
              className='relative min-h-[280px] opacity-0'
            >
              {MODES.map((mode, index) => {
                const isActive = index === activeFeature;
                return (
                  <div
                    key={mode.key}
                    className={cn(
                      'absolute inset-x-0 top-0 space-y-3 transition-opacity duration-300',
                      isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    )}
                  >
                    <span className='text-[10.5px] font-mono uppercase tracking-[0.22em] text-white/30'>
                      0{index + 1}
                    </span>
                    <h3
                      className={cn(
                        'text-2xl font-semibold tracking-tight transition-colors duration-200',
                        isActive ? 'text-white' : 'text-white/30'
                      )}
                    >
                      {mode.label}
                    </h3>
                    <p
                      className={cn(
                        'max-w-sm text-[14px] leading-relaxed transition-colors duration-200',
                        isActive ? 'text-white/60' : 'text-white/25'
                      )}
                    >
                      {mode.description}
                    </p>
                  </div>
                );
              })}

              {/* Progress dots */}
              <div className='absolute bottom-0 left-0 flex gap-2' role='tablist' aria-label='Feature progress'>
                {MODES.map((_, i) => (
                  <span
                    key={i}
                    aria-hidden='true'
                    className={cn(
                      'h-1 rounded-full transition-all duration-300',
                      i === activeFeature ? 'w-6 bg-white' : 'w-2 bg-white/20'
                    )}
                  />
                ))}
              </div>
            </div>

            {/* ── Right: Visual stage — all three images layered ── */}
            <div className='relative min-w-0'>
              <div className='relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#090909] p-1.5 sm:p-2'>
                <div className='relative aspect-[16/10] overflow-hidden rounded-xl bg-[#070707] sm:aspect-[16/9] lg:aspect-[1.8/1]'>
                  {/* Chat — initial visual, crossfades out */}
                  <div
                    ref={chatPanelRef}
                    className='absolute inset-0 will-change-transform'
                    style={{ opacity: 1 }}
                  >
                    <Image
                      src={MODES[0].image}
                      alt='Chat preview in VANTRA Studio'
                      fill
                      loading='eager'
                      sizes='(max-width: 1023px) 100vw, 60vw'
                      className='object-cover object-center'
                    />
                  </div>

                  {/* Image — crossfades in, then slides right */}
                  <div
                    ref={imgPanelRef}
                    className='absolute inset-0 will-change-transform'
                    style={{ opacity: 0 }}
                  >
                    <Image
                      src={MODES[1].image}
                      alt='Image preview in VANTRA Studio'
                      fill
                      loading='lazy'
                      sizes='(max-width: 1023px) 100vw, 60vw'
                      className='object-cover object-center'
                    />
                  </div>

                  {/* Video — crossfades in on top of the moved Image */}
                  <div
                    ref={videoPanelRef}
                    className='absolute inset-0 will-change-transform'
                    style={{ opacity: 0 }}
                  >
                    <Image
                      src={MODES[2].image}
                      alt='Video preview in VANTRA Studio'
                      fill
                      loading='lazy'
                      sizes='(max-width: 1023px) 100vw, 60vw'
                      className='object-cover object-center'
                    />
                  </div>
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
