import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { configuredConnectedApps } from '@/lib/connected-apps/registry.server';
import { connectedAppOrigin, OAUTH_COOKIE, OAUTH_PATH, startOAuthState } from '@/lib/connected-apps/oauth';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const origin = connectedAppOrigin(request.url);
  if (request.headers.get('origin') !== origin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const adapter = configuredConnectedApps().find(app => app.id === body?.appId && Object.keys(body).length === 1);
  if (!adapter?.oauth) return NextResponse.json({ error: 'APP_AUTHORIZATION_UNAVAILABLE' }, { status: 409 });
  const state = startOAuthState(user.id, adapter.id);
  const response = NextResponse.json({ authorizationUrl: adapter.oauth.authorize({ redirectUri: `${origin}${OAUTH_PATH}/callback`,
    state: state.nonce, challenge: state.challenge }) }, { headers: { 'Cache-Control': 'private, no-store' } });
  response.cookies.set(OAUTH_COOKIE, state.cookie, { httpOnly: true, secure: origin.startsWith('https:'), sameSite: 'lax', path: OAUTH_PATH, maxAge: 600 });
  return response;
}
