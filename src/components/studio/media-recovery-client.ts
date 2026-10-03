import type { MediaStatus } from '@/lib/ai/media-recovery';
import { MEDIA_POLL_MIN_MS } from '@/lib/ai/media-recovery';

export class MediaExecutionError extends Error {
  constructor(public readonly execution: MediaStatus) { super(execution.error ?? 'GENERATION_FAILED'); }
}

export function mediaFailureText(cause: unknown, locale: string, fallback: string) {
  if (cause instanceof Error && cause.message === 'GENERATION_BUSY') return locale === 'ar' ? 'التوليد مشغول. حاول لاحقًا.' : locale === 'fr' ? 'Génération occupée. Réessayez plus tard.' : 'Generation is busy. Try again shortly.';
  if (cause instanceof Error && cause.message === 'GENERATION_PRICE_UPDATED') return locale === 'ar' ? 'تم تحديث التكلفة. راجعها ثم أعد المحاولة.' : locale === 'fr' ? 'Le coût a été mis à jour. Vérifiez-le avant de réessayer.' : 'Cost updated. Review it before trying again.';
  if (cause instanceof Error && cause.message === 'MEDIA_STATUS_UNAVAILABLE') return locale === 'ar' ? 'تعذر التحقق من الحالة. قد يكون التوليد مستمرًا؛ أعد فتح الاستوديو لاحقًا.' : locale === 'fr' ? 'Impossible de vérifier le statut. La génération peut continuer ; rouvrez Studio plus tard.' : 'Unable to check status. Generation may continue; reopen Studio later.';
  if (!(cause instanceof MediaExecutionError)) return fallback;
  const message = cause.execution.timeout ? locale === 'ar' ? 'انتهت مهلة التوليد.' : locale === 'fr' ? 'Le délai de génération a expiré.' : 'Generation timed out.' : fallback;
  if (!cause.execution.creditsReleased) return message;
  return `${message} ${locale === 'ar' ? 'تم تحرير الرصيد المحجوز.' : locale === 'fr' ? 'Les crédits réservés ont été libérés.' : 'Credits released.'}`;
}

export function nextMediaPollDelay(attempt: number, retryAfterMs = MEDIA_POLL_MIN_MS) {
  return Math.max(retryAfterMs, Math.min(30_000, MEDIA_POLL_MIN_MS * Math.pow(1.4, Math.min(attempt, 8))));
}

async function visible(signal?: AbortSignal) {
  if (typeof document === 'undefined' || document.visibilityState !== 'hidden') return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { document.removeEventListener('visibilitychange', changed); signal?.removeEventListener('abort', aborted); };
    const changed = () => { if (document.visibilityState !== 'hidden') { cleanup(); resolve(); } };
    const aborted = () => { cleanup(); reject(new DOMException('Stopped observing', 'AbortError')); };
    document.addEventListener('visibilitychange', changed); signal?.addEventListener('abort', aborted, { once: true });
    if (signal?.aborted) aborted();
  });
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const aborted = () => { clearTimeout(timer); reject(new DOMException('Stopped observing', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', aborted); resolve(); }, ms);
    signal?.addEventListener('abort', aborted, { once: true });
    if (signal?.aborted) aborted();
  });
}

/** Observing abort never cancels accepted provider work or releases credits. */
export async function waitForOwnedMedia(executionId: string, signal?: AbortSignal, update?: (status: MediaStatus) => void) {
  let attempt = 0;
  let unavailable = 0;
  let retryAfter = MEDIA_POLL_MIN_MS;
  for (;;) {
    await delay(nextMediaPollDelay(attempt, retryAfter), signal);
    await visible(signal);
    let response: Response;
    try { response = await fetch(`/api/generate/media/status?executionId=${encodeURIComponent(executionId)}`, { cache: 'no-store', signal }); }
    catch (cause) {
      if (signal?.aborted) throw cause;
      if (++unavailable >= 3) throw new Error('MEDIA_STATUS_UNAVAILABLE');
      attempt++; continue;
    }
    if (response.status === 401 || response.status === 404) throw new Error('MEDIA_STATUS_UNAVAILABLE');
    const value = await response.json().catch(() => null) as MediaStatus | null;
    retryAfter = value?.retryAfterMs ?? 15_000;
    if (!response.ok || !value?.executionId) {
      if (++unavailable >= 3) throw new Error('MEDIA_STATUS_UNAVAILABLE');
      attempt++; continue;
    }
    unavailable = 0;
    update?.(value);
    if (value.state === 'failed') throw new MediaExecutionError(value);
    if (value.state === 'completed' && value.result) return value;
    attempt++;
  }
}
