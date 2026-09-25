import 'server-only';

import { cookies } from 'next/headers';
import { issueInstallationToken, verifiedInstallationHash } from '@/lib/access/free-device-identity';

const COOKIE = 'vantra_installation_v1';

function signingKey() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('DEVICE_IDENTITY_UNAVAILABLE');
  return secret;
}

export async function readInstallationIdentity() {
  return verifiedInstallationHash((await cookies()).get(COOKIE)?.value, signingKey());
}

export async function ensureInstallationIdentity() {
  const jar = await cookies();
  const existing = verifiedInstallationHash(jar.get(COOKIE)?.value, signingKey());
  if (existing) return existing;
  const issued = issueInstallationToken(signingKey());
  jar.set(COOKIE, issued.token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: '/', maxAge: 60 * 60 * 24 * 365,
  });
  return issued.identityHash;
}
