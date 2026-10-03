import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { reconcileMediaBatch } from '@/lib/ai/media-recovery.server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.MEDIA_RECONCILE_SECRET;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!secret || secret.length < 32 || Buffer.byteLength(secret) !== Buffer.byteLength(supplied)
    || !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  try { return NextResponse.json(await reconcileMediaBatch()); }
  catch { return NextResponse.json({ error: 'MEDIA_RECONCILIATION_UNAVAILABLE' }, { status: 503 }); }
}
