import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptToken, decryptToken } from '@/lib/ai/provider-connections';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const PROVIDER = 'pollinations';
const TOKEN_URL = 'https://enter.pollinations.ai/api/oauth/token';
const VERIFIER_COOKIE = 'pkce_verifier';
const STATE_COOKIE = 'oauth_state';

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data?.user ?? null };
}

/**
 * GET — dual role:
 *  1. OAuth callback when ?code & ?state are present (official App Key + PKCE flow)
 *  2. Connection status otherwise (never returns the token)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

    // ── OAuth callback ──
    if (code || state || oauthError) {
      const studioUrl = new URL('/studio', url.origin);

      // Helper: redirect back to studio with an error + cleaned cookies
      const failWith = (errorCode: string) => {
        studioUrl.searchParams.set('provider_error', errorCode);
        const res = NextResponse.redirect(studioUrl);
        res.cookies.delete(VERIFIER_COOKIE);
        res.cookies.delete(STATE_COOKIE);
        return res;
      };

      if (oauthError) {
        return failWith(oauthError);
      }

      // Supabase auth — guarded so a cookie/session failure never 500s
      let userId: string | null = null;
      let supabase: Awaited<ReturnType<typeof requireUser>>['supabase'] | null = null;
      try {
        const authResult = await requireUser();
        userId = authResult.user?.id ?? null;
        supabase = authResult.supabase;
      } catch {
        return failWith('sign_in_required');
      }
      if (!userId || !supabase) {
        return failWith('sign_in_required');
      }

      // PKCE verifier + state from httpOnly cookies
      const verifierCookie = request.headers
        .get('cookie')
        ?.split(';')
        .map((c) => c.trim().split('='))?.find(([k]) => k === VERIFIER_COOKIE)?.[1];
      const stateCookie = request.headers
        .get('cookie')
        ?.split(';')
        .map((c) => c.trim().split('='))?.find(([k]) => k === STATE_COOKIE)?.[1];

      if (!code || !state || !verifierCookie || !stateCookie || !safeEqual(state, stateCookie)) {
        return failWith('state_mismatch');
      }

      // Exchange the code — PKCE replaces the client secret
      const form = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.POLLINATIONS_APP_KEY || '',
        redirect_uri: `${url.origin}${url.pathname}`,
        code_verifier: verifierCookie,
      });

      let tokenPayload: { access_token?: string; expires_in?: number; scope?: string };
      try {
        const tokenRes = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
          signal: AbortSignal.timeout(20_000),
        });
        if (!tokenRes.ok) {
          const detail = await tokenRes.text().catch(() => '');
          console.error('[pollinations-oauth] token exchange failed:', tokenRes.status, detail.slice(0, 200));
          return failWith('token_exchange_failed');
        }
        tokenPayload = await tokenRes.json();
      } catch {
        return failWith('token_exchange_failed');
      }

      const scopedKey = tokenPayload.access_token;
      if (!scopedKey || !scopedKey.startsWith('sk_')) {
        return failWith('unexpected_token_type');
      }

      // Encrypt — guarded so a missing/malformed key never 500s
      let encrypted: string;
      try {
        encrypted = encryptToken(scopedKey);
      } catch {
        console.error('[pollinations-oauth] encryptToken failed — PROVIDER_TOKEN_ENCRYPTION_KEY likely missing');
        return failWith('encryption_failed');
      }

      const expiresAt = new Date(Date.now() + (tokenPayload.expires_in || 604800) * 1000).toISOString();

      const { error } = await supabase.from('user_provider_connections').upsert(
        {
          user_id: userId,
          provider: PROVIDER,
          encrypted_token: encrypted,
          expires_at: expiresAt,
        },
        { onConflict: 'user_id,provider' }
      );

      if (error) {
        console.error('[pollinations-oauth] upsert failed:', error.message);
        return failWith('storage_failed');
      }

      // Success — clean cookies, no sk_ anywhere in the URL
      studioUrl.searchParams.set('connected', PROVIDER);
      const res = NextResponse.redirect(studioUrl);
      res.cookies.delete(VERIFIER_COOKIE);
      res.cookies.delete(STATE_COOKIE);
      return res;
    }

  // ── Status (no code present) ──
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_provider_connections')
    .select('created_at, expires_at')
    .eq('user_id', user.id)
    .eq('provider', PROVIDER)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Failed to read connection' }, { status: 500 });
  }

  return NextResponse.json({
    provider: PROVIDER,
    connected: !!data,
    connectedAt: data?.created_at ?? null,
    expiresAt: data?.expires_at ?? null,
    expired: data?.expires_at ? new Date(data.expires_at) < new Date() : false,
  });
}

/** DELETE — disconnect. */
export async function DELETE() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  const { error } = await supabase
    .from('user_provider_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', PROVIDER);

  if (error) {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
  return NextResponse.json({ provider: PROVIDER, connected: false });
}
