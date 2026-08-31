"use client";

import Image from "next/image";
import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

export function CinematicScrollMockup() {
  const containerRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const mockupScale = useTransform(scrollYProgress, [0, 0.5], [1.2, 0.7]);
  const mockupY = useTransform(scrollYProgress, [0, 0.5], ["0%", "-10%"]);
  const textOpacity = useTransform(
    scrollYProgress,
    [0, 0.24, 0.4],
    [0, 0, 1]
  );
  const textY = useTransform(scrollYProgress, [0, 0.4], [50, 0]);

  return (
    <section
      ref={containerRef}
      aria-label="VANTRA unified AI studio"
      className="relative h-[300vh] bg-black"
    >
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden bg-black supports-[height:100svh]:h-[100svh]">
        <motion.div
          data-cinematic-mockup
          style={{
            scale: prefersReducedMotion ? 0.7 : mockupScale,
            y: prefersReducedMotion ? "-10%" : mockupY,
            willChange: "transform",
          }}
          className="relative z-10 w-[min(92vw,1180px)] origin-center"
        >
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/60 p-2 shadow-[0_0_50px_rgba(255,255,255,0.05)] backdrop-blur-xl sm:p-3">
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

            <div className="relative aspect-[16/10] overflow-hidden rounded-b-[20px] bg-[#050505] sm:aspect-video">
              <Image
                src="/showcase/chat-preview.png"
                alt="VANTRA Studio unified AI workspace dashboard"
                fill
                priority
                sizes="(max-width: 1280px) 92vw, 1180px"
                className="object-cover object-center"
              />

              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 border border-white/[0.06]"
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          data-cinematic-copy
          style={{
            opacity: prefersReducedMotion ? 1 : textOpacity,
            y: prefersReducedMotion ? 0 : textY,
            willChange: "transform, opacity",
          }}
          className="pointer-events-none absolute inset-x-5 bottom-[6svh] z-20 mx-auto max-w-3xl text-center sm:bottom-[7svh]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
            One workspace
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
            All your AI models. One unified studio.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/50 sm:text-base">
            Chat, create images, and produce video without leaving your flow.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export default CinematicScrollMockup;
