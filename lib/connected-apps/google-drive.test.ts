import assert from 'node:assert/strict';
import test from 'node:test';
import { googleDriveAdapter, googleFileId, DRIVE_SCOPE } from './google-drive';
import { executeConnectedAction, relevantConnectedActions } from './core';
import { configuredConnectedApps, discoverableConnectedApps } from './registry.server';

const fileId = 'sanitized-file-123';
const request = `Read https://docs.google.com/document/d/${fileId}/edit`;
const grant = { accessToken: 'fake-access-not-live', refreshToken: 'fake-refresh-not-live', expiresAt: new Date(Date.now() + 3600000).toISOString(),
  scopes: [DRIVE_SCOPE], account: { id: 'account-1', name: 'QA', email: 'qa@example.com' } };

test('unconfigured private file requests remain discoverable but cannot initiate a connection', () => {
  const previous = process.env.GOOGLE_DRIVE_CLIENT_ID;
  delete process.env.GOOGLE_DRIVE_CLIENT_ID;
  try {
    assert.ok(!configuredConnectedApps().some(app => app.id === 'google_drive'));
    assert.equal(relevantConnectedActions(request, discoverableConnectedApps())[0].adapter.id, 'google_drive');
  } finally { if (previous !== undefined) process.env.GOOGLE_DRIVE_CLIENT_ID = previous; }
});

test('one explicit file URL selects a read; mentions, unrelated hosts, multiple files and denied requests do not', () => {
  assert.equal(googleFileId(request), fileId);
  assert.equal(googleFileId('https://docs.google.com.evil.example/document/d/sanitized-file-123'), null);
  assert.equal(googleFileId(request + ' https://docs.google.com/document/d/another-file-123'), null);
  assert.equal(googleFileId('https://docs.google.com/document/d/YOUR_FILE_ID/edit'), null);
  assert.equal(googleFileId('اقرأ هذا الملف من Google Drive: [ضع رابط الملف]'), null);
  const adapter = googleDriveAdapter();
  for (const text of ['My Google Drive account', `Do not read ${request}`]) assert.equal(relevantConnectedActions(text, [adapter]).length, 0);
  for (const text of [request, request.replace('Read', 'اقرأ'), request.replace('Read', 'Résume')]) assert.equal(relevantConnectedActions(text, [adapter]).length, 1);
});

test('unfinished Shopify onboarding cannot be enabled by credentials alone', () => {
  const previous = process.env.SHOPIFY_CLIENT_ID;
  process.env.SHOPIFY_CLIENT_ID = 'fixture-client';
  try { assert.ok(!configuredConnectedApps().some(app => app.id === 'shopify')); }
  finally { if (previous === undefined) delete process.env.SHOPIFY_CLIENT_ID; else process.env.SHOPIFY_CLIENT_ID = previous; }
});

test('OAuth exchange verifies account identity and scopes; refresh and revocation use server-only token endpoints', async () => {
  const calls: Array<{ url: string; method: string; body: URLSearchParams | null }> = [];
  const adapter = googleDriveAdapter(async (url, init) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body instanceof URLSearchParams ? init.body : null });
    if (String(url).endsWith('/userinfo')) return Response.json({ sub: 'verified-id', email: 'qa@example.com', email_verified: true });
    if (String(url).endsWith('/revoke')) return new Response('');
    return Response.json({ access_token: grant.accessToken, refresh_token: grant.refreshToken, expires_in: 3600, token_type: 'Bearer', scope: DRIVE_SCOPE });
  });
  const url = new URL(adapter.oauth!.authorize({ redirectUri: 'https://joinvantra.com/api/connected-apps/oauth/callback', state: 'nonce', challenge: 'challenge' }));
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  const exchanged = await adapter.oauth!.exchange({ code: 'test-code', verifier: 'test-verifier', redirectUri: 'https://joinvantra.com/api/connected-apps/oauth/callback' });
  assert.equal(exchanged.account.id, 'verified-id');
  assert.equal(calls[0].body?.get('code_verifier'), 'test-verifier');
  await adapter.oauth!.refresh!(exchanged);
  assert.equal(calls[2].body?.get('grant_type'), 'refresh_token');
  await adapter.oauth!.revoke!(exchanged);
  assert.equal(calls[3].url, 'https://oauth2.googleapis.com/revoke');
});

test('authorized read exports real text through fixed API URLs and keeps credentials out of results', async () => {
  const calls: string[] = [];
  const adapter = googleDriveAdapter(async (url, init) => {
    calls.push(String(url));
    assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${grant.accessToken}`);
    assert.equal(init?.redirect, 'error');
    return calls.length === 1 ? Response.json({ id: fileId, name: 'QA file', mimeType: 'application/vnd.google-apps.document' })
      : new Response('A bounded real file excerpt.');
  });
  const match = relevantConnectedActions(request, [adapter])[0];
  const connection = { id: 'c', appId: adapter.id, scopes: [DRIVE_SCOPE], status: 'connected' as const, expiresAt: grant.expiresAt };
  const result = await executeConnectedAction({ match, request, userId: 'u', connection, credential: JSON.stringify(grant) });
  assert.equal(result.error, null); assert.equal(result.resource?.text, 'A bounded real file excerpt.');
  assert.ok(calls[1].includes('/export?mimeType=text%2Fplain'));
  assert.ok(!JSON.stringify(result).includes(grant.accessToken));
  const count = calls.length;
  assert.equal((await executeConnectedAction({ match, request, userId: 'u', connection: { ...connection, scopes: [] }, credential: JSON.stringify(grant) })).error, 'permission_missing');
  assert.equal(calls.length, count);
});

test('an inaccessible Drive file is not reported as read', async () => {
  const adapter = googleDriveAdapter(async () => new Response('private upstream details', { status: 404 }));
  const result = await executeConnectedAction({ match: relevantConnectedActions(request, [adapter])[0], request,
    userId: 'u', connection: { id: 'c', appId: adapter.id, scopes: [DRIVE_SCOPE], status: 'connected', expiresAt: grant.expiresAt },
    credential: JSON.stringify(grant) });
  assert.equal(result.error, 'resource_not_found');
  assert.equal(result.resource, null);
});

test('denied, expired, rate limited and unavailable responses expose only safe errors', async () => {
  for (const [status, error] of [[401, 'authorization_expired'], [403, 'permission_missing'], [429, 'provider_rate_limited'], [503, 'provider_unavailable']] as const) {
    const adapter = googleDriveAdapter(async () => new Response('SECRET UPSTREAM BODY', { status }));
    const result = await executeConnectedAction({ match: relevantConnectedActions(request, [adapter])[0], request, userId: 'u',
      connection: { id: 'c', appId: adapter.id, scopes: [DRIVE_SCOPE], status: 'connected', expiresAt: grant.expiresAt }, credential: JSON.stringify(grant) });
    assert.equal(result.error, error); assert.ok(!JSON.stringify(result).includes('SECRET'));
  }
});

test('oversized and unsupported files fail closed without arbitrary media fetches', async () => {
  let calls = 0;
  const adapter = googleDriveAdapter(async () => { calls++; return Response.json({ id: fileId, name: 'PDF', mimeType: 'application/pdf' }); });
  await assert.rejects(adapter.execute({ actionId: 'read_google_drive_file', request, userId: 'u', credential: JSON.stringify(grant) }), /resource_not_found/);
  assert.equal(calls, 1);
});
