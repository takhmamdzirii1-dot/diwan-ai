import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/src/lib/supabase/server';
import { configuredConnectedApps, knownConnectedApp } from '@/lib/connected-apps/registry.server';
import { disconnectUserConnection, listUserConnections, saveUserConnection } from '@/lib/connected-apps/store.server';

export const dynamic = 'force-dynamic';
const appRequest = z.object({ appId: z.string().min(1).max(80) }).strict();
const noStore = { 'Cache-Control': 'private, no-store' };

async function userId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !!origin && origin === new URL(request.url).origin;
}

export async function GET() {
  const id = await userId();
  if (!id) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401, headers: noStore });
  const adapters = configuredConnectedApps();
  try {
    const connections = await listUserConnections(id);
    for (const connection of connections) {
      const known = knownConnectedApp(connection.appId);
      if (known && connection.status === 'connected' && !adapters.some(app => app.id === known.id)) adapters.push(known);
    }
    return NextResponse.json({ apps: adapters.map((adapter) => ({ id: adapter.id, name: adapter.name,
      authorization: adapter.authorization, canConnect: configuredConnectedApps().some(app => app.id === adapter.id) && Boolean(adapter.connect || adapter.oauth),
      requiresStore: adapter.requiresStore ?? false,
      connection: connections.find((item) => item.appId === adapter.id) ?? null })) }, { headers: noStore });
  } catch { return NextResponse.json({ error: 'CONNECTED_APPS_UNAVAILABLE' }, { status: 503, headers: noStore }); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403, headers: noStore });
  const id = await userId();
  if (!id) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401, headers: noStore });
  const parsed = appRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_APP' }, { status: 400, headers: noStore });
  const adapter = configuredConnectedApps().find((item) => item.id === parsed.data.appId);
  if (!adapter?.connect || adapter.authorization !== 'reference')
    return NextResponse.json({ error: 'APP_AUTHORIZATION_UNAVAILABLE' }, { status: 409, headers: noStore });
  try {
    const grant = await adapter.connect();
    const connection = await saveUserConnection(id, adapter.id, grant.scopes);
    return NextResponse.json({ connection }, { headers: noStore });
  } catch { return NextResponse.json({ error: 'CONNECTED_APPS_UNAVAILABLE' }, { status: 503, headers: noStore }); }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403, headers: noStore });
  const id = await userId();
  if (!id) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401, headers: noStore });
  const parsed = appRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_APP' }, { status: 400, headers: noStore });
  const adapter = knownConnectedApp(parsed.data.appId);
  if (!adapter) return NextResponse.json({ error: 'INVALID_APP' }, { status: 400, headers: noStore });
  try {
    const result = await disconnectUserConnection(id, adapter.id);
    return NextResponse.json({ connection: null, revoked: result.revoked }, { headers: noStore });
  } catch { return NextResponse.json({ error: 'CONNECTED_APPS_UNAVAILABLE' }, { status: 503, headers: noStore }); }
}
