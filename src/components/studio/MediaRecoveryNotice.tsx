'use client';

import { useEffect, useState } from 'react';
import type { MediaStatus } from '@/lib/ai/media-recovery';
import { waitForOwnedMedia, mediaFailureText, MediaExecutionError } from './media-recovery-client';
import { rememberedMediaOperations } from './media-operation-memory';

export default function MediaRecoveryNotice({ userId, locale, refreshBalance, onOpenLibrary, onStatus }: { userId?: string; locale: string; refreshBalance: () => Promise<unknown>; onOpenLibrary: () => void; onStatus?: (status: MediaStatus) => void }) {
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    const finish = (status: MediaStatus) => {
      if (controller.signal.aborted) return;
      onStatus?.(status);
      void refreshBalance();
      if (status.state === 'completed' && status.result) {
        window.dispatchEvent(new CustomEvent('vantra:media-completed', { detail: { kind: status.modality, item: { ...status.result, thumbnail: null } } }));
        setNotice(locale === 'ar' ? 'النتيجة جاهزة في المكتبة.' : locale === 'fr' ? 'Le résultat est disponible dans la bibliothèque.' : 'Your result is ready in Library.');
      } else if (status.state === 'failed') {
        setNotice(mediaFailureText(new MediaExecutionError(status), locale, locale === 'ar' ? 'فشل التوليد.' : locale === 'fr' ? 'La génération a échoué.' : 'Generation failed.'));
      }
    };
    const observe = (status: MediaStatus) => {
      onStatus?.(status);
      if (status.state === 'failed' || status.state === 'completed') finish(status);
      else {
        setNotice(locale === 'ar' ? 'التوليد جارٍ…' : locale === 'fr' ? 'Génération en cours…' : 'Generation in progress…');
        void waitForOwnedMedia(status.executionId, controller.signal, onStatus).then(terminal => finish({ ...terminal, context: terminal.context ?? status.context })).catch(cause => {
          if (cause instanceof MediaExecutionError) finish({ ...cause.execution, context: cause.execution.context ?? status.context });
        });
      }
    };
    // A synchronous Image may finish before the reload's active-list fetch.
    // Remembered operations also resolve owned terminal results, without POST.
    const restored = new Set<string>();
    void Promise.allSettled(rememberedMediaOperations(userId).map(async operationId => {
      const response = await fetch(`/api/generate/media/status?operationId=${encodeURIComponent(operationId)}`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok || controller.signal.aborted) return;
      const status = await response.json() as MediaStatus;
      restored.add(status.executionId); observe(status);
    })).then(() => fetch('/api/generate/media/status', { cache: 'no-store', signal: controller.signal }))
      .then(async response => {
        if (!response.ok) return;
        const payload = await response.json() as { executions: Array<MediaStatus | null> };
        for (const status of payload.executions) {
          if (!status || controller.signal.aborted) continue;
          if (!restored.has(status.executionId)) observe(status);
        }
      }).catch(() => undefined);
    return () => controller.abort();
  }, [userId, locale, refreshBalance, onStatus]);
  if (!notice) return null;
  return <div role="status" className="absolute bottom-3 start-3 z-30 max-w-[calc(100%-1.5rem)] rounded-lg border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 py-2 text-sm text-[var(--studio-text-primary)]">
    {notice}<button type="button" onClick={onOpenLibrary} className="ms-3 min-h-11 underline">{locale === 'ar' ? 'المكتبة' : locale === 'fr' ? 'Bibliothèque' : 'Library'}</button><button type="button" onClick={() => setNotice('')} aria-label={locale === 'ar' ? 'إغلاق' : locale === 'fr' ? 'Fermer' : 'Dismiss'} className="ms-3 min-h-11 p-2">×</button>
  </div>;
}
