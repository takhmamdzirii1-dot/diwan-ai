'use client';

import { useEffect, useState } from 'react';
import type { StudioAccessState } from '@/lib/access/trial-state';

export function useStudioAccess(enabled: boolean) {
  const [access, setAccess] = useState<StudioAccessState | null>(null);
  const [loading, setLoading] = useState(enabled);
  useEffect(() => {
    if (!enabled) { setAccess(null); setLoading(false); return; }
    let cancelled = false;
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;
    const load = () => {
      setLoading(true);
      fetch('/api/studio/access', { cache: 'no-store' })
        .then(async (response) => response.ok ? response.json() : null)
        .then((body) => {
          if (cancelled) return;
          const next = body?.access as StudioAccessState | undefined;
          setAccess(next ?? null);
          if (next?.kind === 'trial_active') {
            const remaining = new Date(next.trialExpiresAt).getTime() - Date.now();
            if (remaining > 0) expiryTimer = setTimeout(load, Math.min(remaining + 250, 2_147_000_000));
          }
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    const paymentUpdated = () => load();
    load();
    window.addEventListener('vantra-payment-updated', paymentUpdated);
    return () => {
      cancelled = true;
      if (expiryTimer) clearTimeout(expiryTimer);
      window.removeEventListener('vantra-payment-updated', paymentUpdated);
    };
  }, [enabled]);
  return { access, loading };
}
