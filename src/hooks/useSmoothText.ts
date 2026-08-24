'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Smooths chunky token streams into a fluid typewriter reveal.
 * Speed adapts: the further behind the target, the faster it catches up,
 * so it always finishes exactly when the network stream does.
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
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const distance = target.length - shownRef.current;
      if (distance > 0) {
        const cps = Math.max(160, distance * 2.4);
        shownRef.current = Math.min(target.length, shownRef.current + Math.max(1, Math.round(cps * dt)));
        setShown(target.slice(0, shownRef.current));
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);

  return shown;
}
