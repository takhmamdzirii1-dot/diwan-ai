import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { startOAuthState, validateOAuthState, parseCredentials } from './oauth';
import { encryptToken, decryptToken } from '@/lib/ai/provider-connections';

test('encrypted state binds nonce, app, authenticated owner, TTL and PKCE without exposing verifier', () => {
  const previous = process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;
  process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = 'deterministic-test-key-not-a-real-secret';
  try {
    const user = '00000000-0000-4000-8000-000000000001';
    const state = startOAuthState(user, 'google_drive', 1000);
    const verified = validateOAuthState(state.cookie, state.nonce, user, 1100)!;
    assert.equal(verified.appId, 'google_drive');
    assert.equal(createHash('sha256').update(verified.verifier).digest('base64url'), state.challenge);
    assert.doesNotMatch(state.cookie, /google_drive|00000000/);
    assert.equal(validateOAuthState(state.cookie, state.nonce, 'another-user', 1100), null);
    assert.equal(validateOAuthState(state.cookie, 'x'.repeat(43), user, 1100), null);
    assert.equal(validateOAuthState(state.cookie, state.nonce, user, 601001), null);
    assert.equal(validateOAuthState(state.cookie + 'x', state.nonce, user, 1100), null);
    assert.equal(validateOAuthState(undefined, state.nonce, user, 1100), null);
    const grant = { accessToken: 'test-token', refreshToken: 'test-refresh', expiresAt: '2026-10-01T12:00:00Z',
      scopes: ['read'], account: { id: 'account', name: 'QA' } };
    const encrypted = encryptToken(JSON.stringify(parseCredentials(grant)));
    assert.ok(!encrypted.includes('test-token'));
    assert.deepEqual(parseCredentials(JSON.parse(decryptToken(encrypted)!)), grant);
    assert.throws(() => parseCredentials({ ...grant, secret: 'extra' }));
  } finally { if (previous === undefined) delete process.env.PROVIDER_TOKEN_ENCRYPTION_KEY; else process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = previous; }
});
