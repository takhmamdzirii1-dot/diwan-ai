'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

type Logo = {
  src?: string;
  alt: string;
  name?: string;
  width?: number;
  height?: number;
};

type LogoCloudProps = React.ComponentProps<'div'> & {
  logos: Logo[];
};

export function LogoCloud({ className, logos, ...props }: LogoCloudProps) {
  const reduce = useReducedMotion();
  const sequenceRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sequence = sequenceRef.current;
    const track = trackRef.current;

    if (!sequence || !track) return;

    const cycleDuration = 30_000;
    let frameId = 0;
    let lastTime: number | null = null;
    let offset = 0;
    let sequenceWidth = 0;

    const render = () => {
      track.style.transform = `translate3d(${offset - sequenceWidth}px, 0, 0)`;
    };

    const measure = () => {
      const nextWidth = sequence.getBoundingClientRect().width;

      if (nextWidth <= 0 || nextWidth === sequenceWidth) return;

      const progress = sequenceWidth > 0 ? offset / sequenceWidth : 0;
      sequenceWidth = nextWidth;
      offset = progress * sequenceWidth;
      render();
    };

    const animate = (time: number) => {
      if (lastTime === null) lastTime = time;

      const elapsed = time - lastTime;
      lastTime = time;

      if (sequenceWidth > 0) {
        offset =
          (offset + (sequenceWidth * elapsed) / cycleDuration) % sequenceWidth;
        render();
      }

      frameId = requestAnimationFrame(animate);
    };

    measure();

    if (reduce) {
      track.style.transform = 'translate3d(0, 0, 0)';
      return;
    }

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(sequence);
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, [reduce]);

  const logoGroup = (index: number) => (
    <div
      aria-hidden={index > 0 || undefined}
      className='logo-marquee-group'
      ref={index === 0 ? sequenceRef : undefined}
      key={`logo-group-${index}`}
    >
      {logos.map((logo) =>
        logo.src ? (
          <span
            aria-hidden={index > 0 || undefined}
            className='flex shrink-0 items-center gap-3 whitespace-nowrap text-[15px] font-medium tracking-[0.01em] text-[#f5f5f5] md:text-base'
            key={`group-${index}-logo-${logo.alt}`}
          >
            <img
              alt={index > 0 ? '' : logo.alt}
              className='pointer-events-none h-5 w-5 shrink-0 select-none md:h-6 md:w-6'
              height={logo.height || 24}
              loading='eager'
              src={logo.src}
              width={logo.width || 24}
            />
            {logo.name}
          </span>
        ) : (
          <span
            aria-label={index > 0 ? undefined : logo.alt}
            aria-hidden={index > 0 || undefined}
            className='flex shrink-0 items-center gap-3 whitespace-nowrap text-[15px] font-medium tracking-[0.01em] text-[#f5f5f5] md:text-base'
            key={`group-${index}-logo-${logo.alt}`}
          >
            {logo.name}
          </span>
        )
      )}
    </div>
  );

  return (
    <div
      {...props}
      className={cn(
        'overflow-hidden py-3 [mask-image:linear-gradient(to_right,transparent,black,transparent)]',
        className
      )}
    >
      <div className='logo-marquee-track' ref={trackRef}>
        {Array.from({ length: 4 }, (_, index) => logoGroup(index))}
      </div>
      <style jsx global>{`
        .logo-marquee-track {
          direction: ltr;
          display: flex;
          flex-wrap: nowrap;
          width: max-content;
          will-change: transform;
          transform: translate3d(-25%, 0, 0);
          transition: none;
        }

        .logo-marquee-group {
          box-sizing: border-box;
          display: flex;
          flex-shrink: 0;
          align-items: center;
          gap: 4rem;
          padding-right: 4rem;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
