import assert from 'node:assert/strict';
import test from 'node:test';
import { encryptToken } from '@/lib/ai/provider-connections';
import { DRIVE_SCOPE } from './google-drive';

test('real Supabase request builder enforces ownership, encrypted persistence, lazy refresh, and disconnect wins refresh race', async () => {
  const envKeys = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PROVIDER_TOKEN_ENCRYPTION_KEY', 'GOOGLE_DRIVE_CLIENT_ID', 'GOOGLE_DRIVE_CLIENT_SECRET'];
  const saved = new Map(envKeys.map(key => [key, process.env[key]])); const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-server-key';
  process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = 'fixture-encryption-key-not-real-credentials';
  process.env.GOOGLE_DRIVE_CLIENT_ID = 'fixture-client'; process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'fixture-secret';
  const grant = { accessToken: 'fixture-access', refreshToken: 'fixture-refresh', expiresAt: new Date(Date.now() + 3600000).toISOString(),
    scopes: [DRIVE_SCOPE], account: { id: 'provider-account', name: 'QA', email: 'qa@example.com' } };
  let row: Record<string, unknown> | null = null; let revokeCalls = 0; let disconnectDuringRefresh = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === 'oauth2.googleapis.com') {
      if (url.pathname === '/revoke') { revokeCalls++; return new Response(''); }
      if (disconnectDuringRefresh && row) { row.status = 'disconnected'; row.encrypted_credentials = null; row.scopes = []; }
      return Response.json({ access_token: 'renewed-access', expires_in: 3600, token_type: 'Bearer', scope: DRIVE_SCOPE });
    }
    assert.equal(url.hostname, 'fixture.supabase.co');
    const method = init?.method ?? 'GET'; const headers = new Headers(init?.headers);
    if (method === 'POST') {
      const body = JSON.parse(String(init?.body)); assert.equal(body.user_id, 'owner-1');
      assert.ok(body.encrypted_credentials && !body.encrypted_credentials.includes(grant.accessToken));
      row = { id: 'connection-1', ...body };
      return Response.json(row);
    }
    assert.equal(url.searchParams.get('app_id'), method === 'GET' && !url.searchParams.has('app_id') ? null : 'eq.google_drive');
    const owner = url.searchParams.get('user_id');
    if (method === 'PATCH') {
      assert.equal(owner, 'eq.owner-1');
      const match = row && (!url.searchParams.has('encrypted_credentials') || url.searchParams.get('encrypted_credentials') === `eq.${row.encrypted_credentials}`)
        && (!url.searchParams.has('status') || url.searchParams.get('status') === `eq.${row.status}`);
      if (match && row) Object.assign(row, JSON.parse(String(init?.body)));
      return headers.get('prefer')?.includes('return=representation') ? Response.json(match ? [row] : []) : new Response(null, { status: 204 });
    }
    return Response.json(owner === 'eq.owner-1' && row ? [row] : []);
  };
  try {
    const store = await import('./store.server');
    await store.saveUserConnection('owner-1', 'google_drive', ['CLIENT_FORGED_SCOPE'], grant);
    assert.deepEqual(row!.scopes, [DRIVE_SCOPE]);
    assert.equal((await store.readUserConnection('other-owner', 'google_drive')).connection, null);
    const listed = await store.listUserConnections('owner-1');
    assert.equal(listed[0].account?.email, 'qa@example.com');
    assert.ok(!JSON.stringify(listed).includes('fixture-access'));
    const expired = { ...grant, expiresAt: new Date(0).toISOString() };
    row!.encrypted_credentials = encryptToken(JSON.stringify(expired)); row!.expires_at = expired.expiresAt;
    const refreshedStatus = await store.listUserConnections('owner-1');
    assert.ok(Date.parse(refreshedStatus[0].expiresAt!) > Date.now());
    const renewed = await store.readUserConnection('owner-1', 'google_drive');
    assert.ok(renewed.credential?.includes('renewed-access'));
    row!.encrypted_credentials = encryptToken(JSON.stringify(expired)); row!.expires_at = expired.expiresAt; disconnectDuringRefresh = true;
    const raced = await store.readUserConnection('owner-1', 'google_drive');
    assert.equal(raced.connection?.status, 'disconnected'); assert.equal(raced.credential, null);
    disconnectDuringRefresh = false;
    await store.saveUserConnection('owner-1', 'google_drive', grant.scopes, grant);
    // Removing OAuth setup must not trap an existing owned grant.
    delete process.env.GOOGLE_DRIVE_CLIENT_ID; delete process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    assert.equal((await store.disconnectUserConnection('owner-1', 'google_drive')).revoked, true);
    assert.equal(row!.encrypted_credentials, null); assert.equal(revokeCalls, 1);
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of envKeys) { const value = saved.get(key); if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
