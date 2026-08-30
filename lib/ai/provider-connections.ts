/**
 * Server-only crypto helpers for provider connection tokens.
 * AES-256-GCM with a key from PROVIDER_TOKEN_ENCRYPTION_KEY.
 * The token is unreadable even if the database is exposed.
 */

import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const secret = process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('PROVIDER_TOKEN_ENCRYPTION_KEY is not configured');
  }
  // Derive a stable 32-byte key from any sufficiently long secret
  return crypto.createHash('sha256').update(secret).digest();
}

export function isEncryptionConfigured(): boolean {
  return !!process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

export function decryptToken(payload: string): string | null {
  if (!isEncryptionConfigured()) return null; // graceful — anonymous fallback
  const [ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) return null;
  try {
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null; // corrupted payload — treat as no connection
  }
}

/**
 * Fetch and decrypt the authenticated user's stored Pollinations token.
 * Returns null for guests or when no connection exists.
 * Server-only: must be called from a route handler / server component.
 */
export interface StoredConnection {
  token: string;
  expiresAt: string | null;
  expired: boolean;
}

export async function getUserPollinationsConnection(
  userId: string
): Promise<StoredConnection | null> {
  if (!isEncryptionConfigured()) return null; // graceful — anonymous fallback
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data } = await supabase
      .from('user_provider_connections')
      .select('encrypted_token, expires_at')
      .eq('user_id', userId)
      .eq('provider', 'pollinations')
      .maybeSingle();
    if (!data?.encrypted_token) return null;
    const expired = data.expires_at ? new Date(data.expires_at) < new Date() : false;
    const token = decryptToken(data.encrypted_token);
    if (!token) return null;
    return {
      token,
      expiresAt: data.expires_at ?? null,
      expired,
    };
  } catch {
    return null;
  }
}