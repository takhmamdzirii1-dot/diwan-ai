"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

const FEATURE_IMAGES = [
  "/showcase/chat-preview.png",
  "/showcase/image-preview.png",
  "/showcase/video-preview.png",
] as const;

export function CinematicScrollMockup() {
  const t = useTranslations("showcase");
  const isRtl = useLocale() === "ar";
  const features = (t.raw("features") as { label: string; description: string; alt: string }[]).map(
    (feature, index) => ({ ...feature, image: FEATURE_IMAGES[index] })
  );
  const containerRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const scale = useTransform(scrollYProgress, [0, 0.2], [1.3, 0.9]);
  const x = useTransform(scrollYProgress, [0, 0.2], ["0%", isRtl ? "-20%" : "20%"]);
  const textOpacity = useTransform(scrollYProgress, [0.1, 0.2, 1], [0, 1, 1], {
    clamp: true,
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (latest < 0.33) setActiveIndex(0);
    else if (latest >= 0.33 && latest < 0.65) setActiveIndex(1);
    else setActiveIndex(2);
  });

  return (
    <section
      ref={containerRef}
      aria-label={t("aria")}
      className="relative h-[400vh] bg-black"
    >
      <div className="sticky top-0 flex h-screen w-full max-w-[100vw] items-center justify-center overflow-hidden bg-black supports-[height:100svh]:h-[100svh]">
        <motion.div
          data-cinematic-copy
          style={{
            opacity: prefersReducedMotion ? 1 : textOpacity,
            willChange: "opacity",
          }}
          className="absolute start-[max(5vw,24px)] z-20 w-[min(30vw,390px)]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
            {t("eyebrow")}
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white lg:text-5xl">
            {t("titleOne")}
            <br />
            {t("titleTwo")}
          </h2>

          <div className="mt-10 space-y-0" aria-live="polite">
            {features.map((feature, index) => {
              const isActive = activeIndex === index;

              return (
                <div
                  key={feature.label}
                  data-active={isActive || undefined}
                  className="border-t border-white/10 py-5"
                >
                  <div className="flex items-baseline gap-4">
                    <span
                      className={`font-mono text-[10px] transition-[color] duration-200 ${
                        isActive ? "text-white/70" : "text-white/25"
                      }`}
                    >
                      0{index + 1}
                    </span>
                    <h3
                      className={`text-xl font-medium tracking-tight transition-[color] duration-200 ${
                        isActive ? "text-white" : "text-white/30"
                      }`}
                    >
                      {feature.label}
                    </h3>
                  </div>
                  <p
                    className={`ms-8 mt-2 max-w-xs text-sm leading-6 transition-[color,opacity] duration-200 ${
                      isActive ? "text-white/55 opacity-100" : "text-white/30 opacity-0"
                    }`}
                  >
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          data-cinematic-mockup
          data-active-index={activeIndex}
          style={{
            scale: prefersReducedMotion ? 0.9 : scale,
            x: prefersReducedMotion ? (isRtl ? "-20%" : "20%") : x,
            willChange: "transform",
          }}
          className="relative z-10 aspect-video w-[95vw] max-w-6xl origin-center overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-[0_0_50px_rgba(255,255,255,0.05)] backdrop-blur-xl md:w-[70vw] lg:w-[55vw]"
        >
          <div className="flex h-full flex-col p-2 sm:p-3">
            <div className="flex h-10 items-center justify-between border-b border-white/[0.06] px-3 sm:h-12 sm:px-4">
              <div aria-hidden="true" className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-white/15" />
                <span className="size-2 rounded-full bg-white/15" />
                <span className="size-2 rounded-full bg-white/15" />
              </div>

              <p className="text-[9px] font-semibold uppercase tracking-[0.32em] text-white/45 sm:text-[10px]">
                VANTRA Studio
              </p>

              <span aria-hidden="true" className="w-10" />
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden rounded-b-xl bg-[#050505]">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.label}
                  aria-hidden={activeIndex !== index}
                  animate={{ opacity: activeIndex === index ? 1 : 0 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0"
                >
                  <Image
                    src={feature.image}
                    alt={feature.alt}
                    fill
                    priority={index === 0}
                    sizes="(max-width: 1280px) 92vw, 1180px"
                    className="object-cover object-center"
                  />
                </motion.div>
              ))}

              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 border border-white/[0.06]"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default CinematicScrollMockup;
