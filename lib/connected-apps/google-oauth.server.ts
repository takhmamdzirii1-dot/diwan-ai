import 'server-only';
import { z } from 'zod';
import { parseCredentials } from './oauth';
import { connectedBody, connectedHttp } from './http.server';
import type { ConnectedAppAdapter, ConnectedCredentials } from './core';

/** Separate Google clients/grants; never silently expand the deployed Drive consent. */
export function googleOAuth(prefix: string, scopes: readonly string[], fetcher: typeof fetch = fetch): NonNullable<ConnectedAppAdapter['oauth']> {
  const clientId = () => process.env[`${prefix}_CLIENT_ID`]!;
  const clientSecret = () => process.env[`${prefix}_CLIENT_SECRET`]!;
  const upstream = connectedHttp('https://oauth2.googleapis.com', fetcher);
  const token = async (parameters: Record<string, string>, previous?: ConnectedCredentials) => {
    const response = await upstream('/token', { method: 'POST', body: new URLSearchParams({
      client_id: clientId(), client_secret: clientSecret(), ...parameters }) });
    const value = z.object({ access_token: z.string().min(1), refresh_token: z.string().optional(),
      expires_in: z.number().int().positive().max(86400), scope: z.string().optional(), token_type: z.literal('Bearer') })
      .parse(JSON.parse(await connectedBody(response, 40_000)));
    const granted = value.scope?.split(' ').filter(Boolean) ?? previous?.scopes ?? [];
    if (scopes.filter(scope => !['openid', 'email'].includes(scope)).some(scope => !granted.includes(scope))) throw new Error('permission_missing');
    const identity = previous?.account ?? await (async () => {
      const result = await connectedHttp('https://openidconnect.googleapis.com', fetcher)('/v1/userinfo', {
        headers: { Authorization: `Bearer ${value.access_token}` } });
      const user = z.object({ sub: z.string().min(1), email: z.string().email(), email_verified: z.literal(true) })
        .parse(JSON.parse(await connectedBody(result, 10_000)));
      return { id: user.sub, name: user.email, email: user.email };
    })();
    return parseCredentials({ accessToken: value.access_token, refreshToken: value.refresh_token ?? previous?.refreshToken,
      expiresAt: new Date(Date.now() + value.expires_in * 1000).toISOString(), scopes: granted, account: identity });
  };
  return {
    authorize: ({ redirectUri, state, challenge }) => {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({ client_id: clientId(), redirect_uri: redirectUri, state,
        response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', scope: scopes.join(' '),
        access_type: 'offline', prompt: 'consent select_account' }).toString(); return url.toString();
    },
    exchange: ({ redirectUri, code, verifier }) => token({ grant_type: 'authorization_code', redirect_uri: redirectUri, code, code_verifier: verifier }),
    refresh: previous => {
      if (!previous.refreshToken) throw new Error('authorization_expired');
      return token({ grant_type: 'refresh_token', refresh_token: previous.refreshToken }, previous);
    },
    revoke: async previous => { await upstream('/revoke', { method: 'POST', body: new URLSearchParams({ token: previous.refreshToken ?? previous.accessToken }) }); },
  };
}
