'use client';

import { useEffect, useState } from 'react';
import type { StudioAccessState } from '@/lib/access/trial-state';
import { enrollFreeDeviceKey } from '@/src/lib/free-device-key';

export function useStudioAccess(enabled: boolean) {
  const [access, setAccess] = useState<StudioAccessState | null>(null);
  const [loading, setLoading] = useState(enabled);
  useEffect(() => {
    if (!enabled) { setAccess(null); setLoading(false); return; }
    let cancelled = false;
    const load = () => {
      setLoading(true);
      fetch('/api/studio/access', { cache: 'no-store' })
        .then(async (response) => response.ok ? response.json() : null)
        .then((body) => {
          if (cancelled) return;
          const next = body?.access as StudioAccessState | undefined;
          setAccess(next ?? null);
          if (next?.kind === 'trial_active') {
            void enrollFreeDeviceKey().then((state) => {
              if (!cancelled && state && ['eligible', 'review_required', 'ineligible', 'manually_approved'].includes(state)) {
                setAccess((current) => current ? { ...current, freeEligibility: state as StudioAccessState['freeEligibility'] } : current);
              }
            });
          }
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    const paymentUpdated = () => load();
    load();
    window.addEventListener('vantra-payment-updated', paymentUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('vantra-payment-updated', paymentUpdated);
    };
  }, [enabled]);
  return { access, loading };
}
