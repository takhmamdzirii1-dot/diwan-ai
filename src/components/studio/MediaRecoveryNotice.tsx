'use client';

import { useEffect, useState } from 'react';
import type { MediaStatus } from '@/lib/ai/media-recovery';
import { waitForOwnedMedia, mediaFailureText, MediaExecutionError } from './media-recovery-client';

export default function MediaRecoveryNotice({ userId, locale, refreshBalance, onOpenLibrary }: { userId?: string; locale: string; refreshBalance: () => Promise<unknown>; onOpenLibrary: () => void }) {
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    const finish = (status: MediaStatus) => {
      if (controller.signal.aborted) return;
      void refreshBalance();
      if (status.state === 'completed' && status.result) {
        window.dispatchEvent(new CustomEvent('vantra:media-completed', { detail: { kind: status.modality, item: { ...status.result, thumbnail: null } } }));
        setNotice(locale === 'ar' ? 'النتيجة جاهزة في المكتبة.' : locale === 'fr' ? 'Le résultat est disponible dans la bibliothèque.' : 'Your result is ready in Library.');
      } else if (status.state === 'failed') {
        setNotice(mediaFailureText(new MediaExecutionError(status), locale, locale === 'ar' ? 'فشل التوليد.' : locale === 'fr' ? 'La génération a échoué.' : 'Generation failed.'));
      }
    };
    void fetch('/api/generate/media/status', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) return;
        const payload = await response.json() as { executions: Array<MediaStatus | null> };
        for (const status of payload.executions) {
          if (!status || controller.signal.aborted) continue;
          if (status.state === 'failed' || status.state === 'completed') finish(status);
          else {
            setNotice(locale === 'ar' ? 'التوليد جارٍ…' : locale === 'fr' ? 'Génération en cours…' : 'Generation in progress…');
            void waitForOwnedMedia(status.executionId, controller.signal).then(finish).catch(cause => {
              if (cause instanceof MediaExecutionError) finish(cause.execution);
            });
          }
        }
      }).catch(() => undefined);
    return () => controller.abort();
  }, [userId, locale, refreshBalance]);
  if (!notice) return null;
  return <div role="status" className="absolute bottom-3 start-3 z-30 max-w-[calc(100%-1.5rem)] rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 py-2 text-sm text-[var(--studio-text-primary)]">
    {notice}<button type="button" onClick={onOpenLibrary} className="ms-3 min-h-11 underline">{locale === 'ar' ? 'المكتبة' : locale === 'fr' ? 'Bibliothèque' : 'Library'}</button><button type="button" onClick={() => setNotice('')} aria-label={locale === 'ar' ? 'إغلاق' : locale === 'fr' ? 'Fermer' : 'Dismiss'} className="ms-3 min-h-11 p-2">×</button>
  </div>;
}
