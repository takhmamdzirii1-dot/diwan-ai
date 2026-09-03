'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

type Logo = {
  src?: string;
  alt: string;
  name?: string;
  mark?: string;
  width?: number;
  height?: number;
};

type LogoCloudProps = React.ComponentProps<'div'> & {
  logos: Logo[];
};

function NeutralBrandMark({ variant }: { variant?: string }) {
  const stroke = 'currentColor';

  if (variant === 'spark') {
    return <svg viewBox='0 0 24 24' fill='none' stroke={stroke} strokeWidth='1.6'><path d='m12 2 1.8 8.2L22 12l-8.2 1.8L12 22l-1.8-8.2L2 12l8.2-1.8L12 2Z' /></svg>;
  }

  if (variant === 'grid') {
    return <svg viewBox='0 0 24 24' fill='none' stroke={stroke} strokeWidth='1.5'><rect x='3' y='3' width='7' height='7' rx='1.5' /><rect x='14' y='3' width='7' height='7' rx='1.5' /><rect x='3' y='14' width='7' height='7' rx='1.5' /><rect x='14' y='14' width='7' height='7' rx='1.5' /></svg>;
  }

  if (variant === 'wave') {
    return <svg viewBox='0 0 24 24' fill='none' stroke={stroke} strokeWidth='1.7'><path d='M3 8c3.2 0 3.2 8 6.4 8s3.2-8 6.4-8 3.2 8 5.2 8' /></svg>;
  }

  if (variant === 'rings') {
    return <svg viewBox='0 0 24 24' fill='none' stroke={stroke} strokeWidth='1.5'><circle cx='12' cy='12' r='8.5' /><circle cx='12' cy='12' r='3.5' /></svg>;
  }

  if (variant === 'split') {
    return <svg viewBox='0 0 24 24' fill='none' stroke={stroke} strokeWidth='1.5'><path d='M4 5h16M4 12h10M4 19h16' /></svg>;
  }

  if (variant === 'orbit') {
    return <svg viewBox='0 0 24 24' fill='none' stroke={stroke} strokeWidth='1.5'><ellipse cx='12' cy='12' rx='9' ry='4.5' /><ellipse cx='12' cy='12' rx='4.5' ry='9' /><circle cx='12' cy='12' r='1.4' fill='currentColor' stroke='none' /></svg>;
  }

  return <svg viewBox='0 0 24 24' fill='none' stroke={stroke} strokeWidth='1.5'><path d='m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z' /><path d='m4 7.5 8 4.5 8-4.5M12 12v9' /></svg>;
}

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
          <img
            alt={index > 0 ? '' : logo.alt}
            className='pointer-events-none h-5 w-auto shrink-0 select-none grayscale opacity-55 md:h-6 md:opacity-60'
            height={logo.height || 'auto'}
            key={`group-${index}-logo-${logo.alt}`}
            loading='eager'
            src={logo.src}
            width={logo.width || 'auto'}
          />
        ) : (
          <span
            aria-label={index > 0 ? undefined : logo.alt}
            aria-hidden={index > 0 || undefined}
            className='flex shrink-0 items-center gap-3 whitespace-nowrap text-[15px] font-medium tracking-[0.01em] text-white/75 md:text-base'
            key={`group-${index}-logo-${logo.alt}`}
          >
            <span aria-hidden='true' className='h-5 w-5 shrink-0 text-white/65 md:h-6 md:w-6'><NeutralBrandMark variant={logo.mark} /></span>
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
