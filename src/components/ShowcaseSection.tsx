'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from 'framer-motion';

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

function rangeProgress(value: number, start: number, end: number) {
  return clampProgress((value - start) / (end - start));
}

function smoothstep(value: number, start: number, end: number) {
  const progress = rangeProgress(value, start, end);
  return progress * progress * (3 - 2 * progress);
}

export default function ShowcaseSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionProgress = useMotionValue(0);
  const introCenterOffset = useMotionValue(0);
  const frameX = useTransform(
    [sectionProgress, introCenterOffset],
    ([progress, centerOffset]) => {
      const dock = easeInOutCubic(
        rangeProgress(Number(progress), 0.34, 0.5)
      );
      return Number(centerOffset) * (1 - dock);
    }
  );
  const frameY = useTransform(sectionProgress, (progress) => {
    const reveal = easeOutCubic(rangeProgress(progress, 0, 0.22));
    const dock = easeInOutCubic(rangeProgress(progress, 0.34, 0.5));
    return 100 * (1 - reveal) + 8 * dock;
  });
  const frameScale = useTransform(sectionProgress, (progress) => {
    const reveal = easeOutCubic(rangeProgress(progress, 0, 0.22));
    const dock = easeInOutCubic(rangeProgress(progress, 0.34, 0.5));
    return 0.94 + 0.06 * reveal - 0.18 * dock;
  });
  const frameOpacity = useTransform(sectionProgress, (progress) =>
    easeOutCubic(rangeProgress(progress, 0, 0.22))
  );

  const railOpacity = useTransform(sectionProgress, (progress) =>
    smoothstep(progress, 0.38, 0.46)
  );
  const railY = useTransform(railOpacity, (opacity) => 16 * (1 - opacity));
  const chatDescriptionDockOpacity = useTransform(sectionProgress, (progress) =>
    smoothstep(progress, 0.452, 0.5)
  );

  const chatToImage = useTransform(sectionProgress, (progress) =>
    smoothstep(progress, 0.61, 0.68)
  );
  const imageToVideo = useTransform(sectionProgress, (progress) =>
    smoothstep(progress, 0.75, 0.82)
  );

  const chatPanelOpacity = useTransform(chatToImage, (progress) => 1 - progress);
  const chatPanelScale = useTransform(chatToImage, (progress) => 1 - 0.015 * progress);
  const chatPanelY = useTransform(chatToImage, (progress) => -6 * progress);
  const imagePanelOpacity = useTransform(
    [chatToImage, imageToVideo],
    ([enter, exit]) => Number(enter) * (1 - Number(exit))
  );
  const imagePanelScale = useTransform(
    [chatToImage, imageToVideo],
    ([enter, exit]) =>
      0.985 + 0.015 * Number(enter) - 0.015 * Number(exit)
  );
  const imagePanelY = useTransform(
    [chatToImage, imageToVideo],
    ([enter, exit]) => 6 * (1 - Number(enter)) - 6 * Number(exit)
  );
  const videoPanelOpacity = imageToVideo;
  const videoPanelScale = useTransform(
    imageToVideo,
    (progress) => 0.985 + 0.015 * progress
  );
  const videoPanelY = useTransform(imageToVideo, (progress) => 6 * (1 - progress));

  const chatDescriptionOpacity = useTransform(
    [chatDescriptionDockOpacity, chatToImage],
    ([dock, exit]) => Number(dock) * (1 - Number(exit))
  );
  const imageDescriptionOpacity = imagePanelOpacity;
  const videoDescriptionOpacity = videoPanelOpacity;

  const chatRailEmphasis = useTransform(chatToImage, (progress) => 1 - 0.65 * progress);
  const imageRailEmphasis = useTransform(
    [chatToImage, imageToVideo],
    ([enter, exit]) => 0.35 + 0.65 * Number(enter) - 0.65 * Number(exit)
  );
  const videoRailEmphasis = useTransform(
    imageToVideo,
    (progress) => 0.35 + 0.65 * progress
  );
  const chatLineProgress = useTransform(sectionProgress, (progress) =>
    rangeProgress(progress, 0.5, 0.61)
  );
  const imageLineProgress = useTransform(sectionProgress, (progress) =>
    rangeProgress(progress, 0.61, 0.75)
  );
  const videoLineProgress = useTransform(sectionProgress, (progress) =>
    rangeProgress(progress, 0.75, 0.84)
  );

  const compositionY = useTransform(sectionProgress, (progress) =>
    -80 * easeInOutCubic(rangeProgress(progress, 0.84, 1))
  );
  const compositionOpacity = useTransform(sectionProgress, (progress) =>
    1 - smoothstep(progress, 0.84, 1)
  );

  const panelStyles = [
    { opacity: chatPanelOpacity, scale: chatPanelScale, y: chatPanelY },
    { opacity: imagePanelOpacity, scale: imagePanelScale, y: imagePanelY },
    { opacity: videoPanelOpacity, scale: videoPanelScale, y: videoPanelY },
  ];
  const descriptionOpacities = [
    chatDescriptionOpacity,
    imageDescriptionOpacity,
    videoDescriptionOpacity,
  ];
  const railEmphases = [
    chatRailEmphasis,
    imageRailEmphasis,
    videoRailEmphasis,
  ];
  const lineProgresses = [
    chatLineProgress,
    imageLineProgress,
    videoLineProgress,
  ];

  useMotionValueEvent(sectionProgress, 'change', (progress) => {
    const nextIndex = progress < 0.645 ? 0 : progress < 0.785 ? 1 : 2;
    setActiveIndex((current) => (current === nextIndex ? current : nextIndex));
  });

  useEffect(() => {
    let frameId: number | null = null;

    const updateProgress = () => {
      frameId = null;
      const section = sectionRef.current;
      const sticky = stickyRef.current;
      const viewport = viewportRef.current;

      if (!section) return;

      const sectionTop = window.scrollY + section.getBoundingClientRect().top;
      const sectionHeight = section.offsetHeight;
      const viewportHeight = window.innerHeight;
      const nextProgress = clampProgress(
        (window.scrollY - sectionTop) /
          Math.max(1, sectionHeight - viewportHeight)
      );

      sectionProgress.set(nextProgress);

      if (sticky && viewport) {
        const stickyRect = sticky.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        introCenterOffset.set(
          stickyRect.left +
            stickyRect.width / 2 -
            (viewportRect.left + viewportRect.width / 2)
        );
      }
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
  }, [introCenterOffset, sectionProgress]);

  return (
    <section
      ref={sectionRef}
      id="showcase"
      data-studio-scroll-section
      aria-label="VANTRA Chat, Image, and Video showcase"
      className="relative h-[400vh] bg-[#050505]"
    >
      <div
        ref={stickyRef}
        id="models"
        data-sticky-scene
        className="sticky top-0 flex h-[100svh] min-h-[640px] items-center overflow-hidden py-10 lg:py-12"
      >
        <motion.div
          style={{ y: compositionY, opacity: compositionOpacity }}
          className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12"
        >
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
              style={{ opacity: railOpacity, y: railY }}
              className="grid grid-cols-3 border-y border-white/[0.08] lg:block lg:border-y-0"
            >
              {MODES.map((mode, index) => {
                const isActive = index === activeIndex;

                return (
                  <motion.div
                    key={mode.key}
                    aria-current={isActive ? 'step' : undefined}
                    style={{ opacity: railEmphases[index] }}
                    className="relative min-w-0 border-e border-white/[0.08] px-3 py-4 text-white last:border-e-0 lg:border-e-0 lg:border-b lg:px-0 lg:py-6 lg:last:border-b-0"
                  >
                    <p className="text-lg font-medium tracking-tight sm:text-xl lg:text-2xl">
                      {mode.label}
                    </p>

                    <span
                      aria-hidden="true"
                      className="mt-4 block h-px w-full overflow-hidden bg-white/10"
                    >
                      <motion.span
                        style={{ scaleX: lineProgresses[index] }}
                        className="block h-full origin-left bg-white/85"
                      />
                    </span>
                  </motion.div>
                );
              })}

              <div
                data-showcase-description-container
                className="relative col-span-3 min-h-[72px] border-t border-white/[0.08] py-4 lg:mt-1 lg:min-h-[82px] lg:border-t-0 lg:py-5"
              >
                {MODES.map((mode, index) => (
                  <motion.p
                    key={mode.key}
                    data-showcase-description={mode.key}
                    style={{ opacity: descriptionOpacities[index] }}
                    className="absolute inset-x-0 top-4 max-w-[245px] text-sm font-medium leading-6 text-white/60 lg:top-5"
                    aria-hidden={index !== activeIndex}
                  >
                    {mode.description}
                  </motion.p>
                ))}
              </div>
            </motion.div>

            <div
              ref={viewportRef}
              data-demo-viewport
              className="relative z-10 min-w-0 overflow-hidden"
            >
              <motion.div
                data-demo-frame
                style={{
                  x: frameX,
                  y: frameY,
                  scale: frameScale,
                  opacity: frameOpacity,
                  willChange: 'transform, opacity',
                }}
                className="relative w-full overflow-hidden rounded-2xl bg-[#090909] p-1.5 [will-change:transform,opacity] sm:p-2"
              >
                <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[#070707] sm:aspect-[16/9] lg:aspect-[1.8/1]">
                  {MODES.map((mode, index) => {
                    return (
                    <motion.div
                      key={mode.key}
                      data-demo-panel={mode.key}
                      style={{
                        ...panelStyles[index],
                        transition: 'none',
                        willChange: 'opacity, transform',
                      }}
                      className="pointer-events-none absolute inset-0"
                      aria-hidden={index !== activeIndex}
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
        </motion.div>
      </div>
    </section>
  );
}
