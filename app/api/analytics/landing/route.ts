import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { recordLandingBatch } from '@/lib/analytics/landing.server';

export async function POST(request: Request) {
  // Anonymous ingestion accepts only marketing views/intents, never outcomes,
  // actors, arbitrary audit records, free-form URLs or customer content.
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  }
  const text = await request.text();
  if (text.length > 16_384) return NextResponse.json({ error: 'EVENT_BATCH_TOO_LARGE' }, { status: 413 });
  try {
    const result = await recordLandingBatch(JSON.parse(text), (await cookies()).get('vantra_marketing_consent')?.value === 'granted');
    return NextResponse.json(result, { status: result.status });
  } catch {
    return NextResponse.json({ error: 'INVALID_MARKETING_EVENT' }, { status: 400 });
  }
}
