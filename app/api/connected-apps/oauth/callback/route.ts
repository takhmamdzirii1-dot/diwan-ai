import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { configuredConnectedApps } from '@/lib/connected-apps/registry.server';
import { saveUserConnection } from '@/lib/connected-apps/store.server';
import { readUserConnection } from '@/lib/connected-apps/store.server';
import { completedWooAuthorization } from '@/lib/connected-apps/woo-authorization.server';
import { connectedAppOrigin, OAUTH_COOKIE, OAUTH_PATH, validateOAuthState } from '@/lib/connected-apps/oauth';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const origin = connectedAppOrigin(request.url);
  const response = NextResponse.redirect(`${origin}/studio/chat?connected_app_result=failed`);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.cookies.set(OAUTH_COOKIE, '', { httpOnly: true, secure: origin.startsWith('https:'), sameSite: 'lax', path: OAUTH_PATH, maxAge: 0 });
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return response;
  const state = validateOAuthState(request.cookies.get(OAUTH_COOKIE)?.value,
    request.nextUrl.searchParams.get('state') ?? request.nextUrl.searchParams.get('user_id'), user.id);
  if (state?.appId === 'woocommerce') {
    try {
      const grant = await readUserConnection(user.id, 'woocommerce');
      if (request.nextUrl.searchParams.get('success') === '1' && state.context?.shop
        && await completedWooAuthorization(user.id, state.nonce, state.context.shop) && grant.connection?.status === 'connected'
        && grant.connection.account && grant.credential && JSON.parse(grant.credential).store?.domain === state.context?.shop)
        response.headers.set('Location', `${origin}/studio/chat?connected_app_result=connected`);
    } catch { /* Failure remains explicit; never trust success=1 alone. */ }
    return response;
  }
  const code = request.nextUrl.searchParams.get('code');
  if (!state || request.nextUrl.searchParams.has('error') || !code || code.length > 4000) return response;
  const adapter = configuredConnectedApps().find(app => app.id === state.appId);
  if (!adapter?.oauth) return response;
  let grant: Awaited<ReturnType<typeof adapter.oauth.exchange>> | undefined;
  try {
    grant = await adapter.oauth.exchange({ code, verifier: state.verifier, redirectUri: `${origin}${OAUTH_PATH}/callback`,
      context: state.context ? { shop: state.context.shop } : undefined, callbackParams: request.nextUrl.searchParams.toString() });
    await saveUserConnection(user.id, adapter.id, grant.scopes, grant);
    response.headers.set('Location', `${origin}/studio/chat?connected_app_result=connected`);
  } catch {
    // Do not leave a new provider grant orphaned if persistence fails.
    if (grant && adapter.oauth.revoke) try { await adapter.oauth.revoke(grant); } catch { /* best effort; no secrets in logs */ }
  }
  return response;
}
