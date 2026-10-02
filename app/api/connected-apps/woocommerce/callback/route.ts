import { NextResponse } from 'next/server';
import { receiveWooAuthorization } from '@/lib/connected-apps/woo-authorization.server';
import { connectedBody } from '@/lib/connected-apps/http.server';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (process.env.CONNECTED_APPS_WRITES_ENABLED !== 'true') return NextResponse.json({ error: 'UNAVAILABLE' }, { status: 409 });
  try {
    const text = await connectedBody(new Response(request.body), 4000);
    await receiveWooAuthorization(JSON.parse(text), request.signal);
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'INVALID_CALLBACK' }, { status: 403, headers: { 'Cache-Control': 'no-store' } }); }
}
