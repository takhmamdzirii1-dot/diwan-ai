import { NextResponse } from 'next/server';
import { mediaUser, MEDIA_PRIVATE_HEADERS } from '@/lib/ai/media-api.server';
import { recoverOwnedMedia, recoverOwnedMediaOperation, reconcileOwnedMedia } from '@/lib/ai/media-recovery.server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // No longer than the existing Video function.

export async function GET(request: Request) {
  const user = await mediaUser(request);
  if (!user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401, headers: MEDIA_PRIVATE_HEADERS });
  const id = new URL(request.url).searchParams.get('executionId');
  const operation = new URL(request.url).searchParams.get('operationId');
  if (operation && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(operation)) return NextResponse.json({ error: 'INVALID_OPERATION_ID' }, { status: 400, headers: MEDIA_PRIVATE_HEADERS });
  if (id && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) return NextResponse.json({ error: 'INVALID_EXECUTION_ID' }, { status: 400 });
  try {
    if (!id && !operation) return NextResponse.json({ executions: await reconcileOwnedMedia(user.id) }, { headers: MEDIA_PRIVATE_HEADERS });
    const status = id ? await recoverOwnedMedia(id, user.id) : await recoverOwnedMediaOperation(user.id, operation!);
    return status ? NextResponse.json(status, { headers: MEDIA_PRIVATE_HEADERS })
      : NextResponse.json({ error: 'EXECUTION_NOT_FOUND' }, { status: 404, headers: MEDIA_PRIVATE_HEADERS });
  } catch {
    console.error('[media-recovery] owned status unavailable', { executionId: id, code: 'MEDIA_STATUS_UNAVAILABLE' });
    return NextResponse.json({ error: 'MEDIA_STATUS_UNAVAILABLE', retryAfterMs: 15000 }, { status: 503, headers: MEDIA_PRIVATE_HEADERS });
  }
}
