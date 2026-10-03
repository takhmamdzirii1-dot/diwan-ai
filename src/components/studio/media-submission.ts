import type { MediaStatus } from '@/lib/ai/media-recovery';
import { waitForOwnedMedia, MediaExecutionError } from './media-recovery-client';

/** A disconnected submission is observed by its existing operation, never
 * retried as another POST. Real HTTP provider/access errors remain unchanged. */
export async function submitMedia(url: string, init: RequestInit, initial: MediaStatus, update: (status: MediaStatus) => void) {
  try { return await fetch(url, init); }
  catch (cause) {
    try {
      const response = await fetch(`/api/generate/media/status?operationId=${encodeURIComponent(initial.executionId)}`, { cache: 'no-store' });
      if (!response.ok) throw cause;
      let status = await response.json() as MediaStatus;
      update(status);
      if (status.state === 'queued' || status.state === 'processing') status = await waitForOwnedMedia(status.executionId, undefined, update);
      return Response.json({ [initial.modality]: status.result, libraryAssetId: status.result?.libraryAssetId,
        executionId: status.executionId, creditsCharged: status.creditsCharged, creditsReleased: status.creditsReleased,
        ...(status.state === 'failed' ? { error: status.error ?? 'GENERATION_FAILED' } : {}) }, { status: status.state === 'completed' ? 200 : 503 });
    } catch (recoveryError) {
      if (recoveryError instanceof MediaExecutionError) {
        const status = recoveryError.execution;
        return Response.json({ executionId: status.executionId, error: status.error ?? 'GENERATION_FAILED',
          creditsReleased: status.creditsReleased }, { status: 503 });
      }
      // Unknown server outcome: do not assert a refund or keep a stuck spinner.
      // The saved operation and server active discovery still allow reattachment.
      update({ ...initial, state: 'failed', error: 'MEDIA_STATUS_UNAVAILABLE' });
      throw recoveryError;
    }
  }
}
