import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Starts the official Pollinations OAuth Authorization Code + PKCE (S256) flow.
 * Verifier/state live in httpOnly cookies — never exposed to the client.
 *
 * Requires:
 *  - POLLINATIONS_APP_KEY  (pk_... publishable app key, registered redirect URIs)
 *  - Authenticated VANTRA (Supabase) session
 */

const AUTHORIZE_URL = 'https://enter.pollinations.ai/authorize';
const REDIRECT_URI = 'https://ai-alpha-delta-six.vercel.app/api/provider-connections/pollinations';
const SCOPE = 'usage';
const VERIFIER_COOKIE = 'pkce_verifier';
const STATE_COOKIE = 'oauth_state';

function base64url(buf: Buffer) {
  return buf.toString('base64url');
}

export async function GET(request: Request) {
  // Auth check FIRST — guests get 401 regardless of server config
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user ?? null;
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const appKey = process.env.POLLINATIONS_APP_KEY;
  if (!appKey || !appKey.startsWith('pk_')) {
    return NextResponse.json(
      { error: 'Pollinations App Key is not configured on the server' },
      { status: 500 }
    );
  }

  // PKCE
  const verifier = base64url(crypto.randomBytes(48));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());

  // CSRF state
  const state = base64url(crypto.randomBytes(24));

  const authorizeUrl = new URL(AUTHORIZE_URL);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', appKey);
  authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authorizeUrl.searchParams.set('scope', SCOPE);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  const response = NextResponse.redirect(authorizeUrl.toString());
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600, // 10 minutes to complete the flow
  };
  response.cookies.set(VERIFIER_COOKIE, verifier, cookieOpts);
  response.cookies.set(STATE_COOKIE, state, cookieOpts);

  return response;
}
