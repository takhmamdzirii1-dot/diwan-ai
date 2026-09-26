'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Smooths chunky token streams into a fluid, human-like typewriter reveal.
 * Paces updates on a 12-18ms animation frame throttle so reading remains smooth
 * without jagged jumps or scroll-shaking bursts.
 */
export function useSmoothText(target: string, active: boolean): string {
  const [shown, setShown] = useState(active ? '' : target);
  const shownRef = useRef(active ? 0 : target.length);

  useEffect(() => {
    if (!active) {
      shownRef.current = target.length;
      setShown(target);
      return;
    }

    // New stream started — reset
    if (shownRef.current > target.length) {
      shownRef.current = 0;
    }

    let raf = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - lastTime;
      const distance = target.length - shownRef.current;

      if (distance <= 0) {
        return;
      }

      // Throttle: 14-18ms interval per batch step
      if (elapsed >= 14) {
        lastTime = now;
        // Smooth adaptive step: 1-3 chars for steady typing, ramps up gracefully if stream gets far ahead
        const step = distance > 120
          ? Math.min(distance, Math.ceil(distance / 8))
          : distance > 40
          ? 3
          : distance > 10
          ? 2
          : 1;

        shownRef.current = Math.min(target.length, shownRef.current + step);
        setShown(target.slice(0, shownRef.current));
      }

      if (shownRef.current < target.length) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);

  return shown;
}
