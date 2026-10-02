import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { gmailAdapter, GMAIL_READ_SCOPE } from './gmail';
import { githubAdapter, requestedGithubRepository } from './github';
import { wooCommerceAdapter, wooStoreDomain } from './woocommerce';
import { canvaAdapter } from './canva';
import { shopifyAdapter, shopifyDomain, verifyShopifyCallback } from './shopify';
import { googleWorkspaceAdapter, WORKSPACE_SCOPE } from './google-workspace';
import { connectedBody, connectedHttp } from './http.server';
import { relevantConnectedActions, executeConnectedAction, explicitConnectedWriteRequest } from './core';

const grant = { accessToken: 'fixture-access-not-real', refreshToken: 'fixture-refresh-not-real',
  expiresAt: new Date(Date.now() + 3600000).toISOString(), scopes: [GMAIL_READ_SCOPE], account: { id: 'qa-account', name: 'QA' } };

test('explicit EN/FR/AR mailbox requests expose Gmail; mere mentions and negations do not', () => {
  const adapter = gmailAdapter();
  for (const request of ['Show my latest Gmail messages', 'Find my latest email from Google and show the sender and subject', 'List my emails', 'What is in my Gmail inbox?',
    'اعطني آخر رسائل Gmail', 'ما الجديد في بريدي؟', 'Montre mes courriels']) {
    assert.deepEqual(relevantConnectedActions(request, [adapter]).map(match => match.action.id), ['search_gmail']);
  }
  for (const request of ['I use Gmail', 'Explain how Gmail works', 'Show an example email',
    'Do not read Gmail', 'لا تقرأ بريدي', 'Sans lire Gmail']) assert.equal(relevantConnectedActions(request, [adapter]).length, 0);
  const previous = process.env.CONNECTED_APPS_WRITES_ENABLED; process.env.CONNECTED_APPS_WRITES_ENABLED = 'true';
  try {
    assert.deepEqual(relevantConnectedActions('Draft a Gmail reply', [gmailAdapter()]).map(match => match.action.id), ['draft_gmail']);
  } finally { if (previous === undefined) delete process.env.CONNECTED_APPS_WRITES_ENABLED; else process.env.CONNECTED_APPS_WRITES_ENABLED = previous; }
});

test('GitHub target authorization matches exact repository segments, not a prefix', () => {
  assert.equal(requestedGithubRepository('Read https://github.com/qa/project-other', 'qa', 'project'), false);
  assert.equal(requestedGithubRepository('Read https://github.com/qa/project/file', 'qa', 'project'), true);
  assert.equal(requestedGithubRepository('Read https://github.com/qa/project@evil.example', 'qa', 'project'), false);
});

test('Canva reviewed creation is explicitly blank; export initiation never fabricates a completed file', async () => {
  const saved = process.env.CONNECTED_APPS_WRITES_ENABLED; process.env.CONNECTED_APPS_WRITES_ENABLED = 'true';
  try {
    const adapter = canvaAdapter(async (url, options) => {
      const body = JSON.parse(String(options?.body)); assert.equal(options?.method, 'POST');
      if (String(url).endsWith('/designs')) {
        assert.deepEqual(body.design_type, { type: 'preset', name: 'presentation' });
        return Response.json({ design: { id: 'design-1', urls: { edit_url: 'https://www.canva.com/design/design-1/edit' } } });
      }
      assert.ok(String(url).endsWith('/exports')); assert.deepEqual(body, { design_id: 'design-1', format: { type: 'pdf' } });
      return Response.json({ job: { id: '00000000-0000-4000-8000-000000000001', status: 'in_progress' } });
    });
    const created = await adapter.execute({ actionId: 'write_canva', userId: 'owner', request: 'Create a Canva design',
      credential: JSON.stringify(grant), arguments: { operation: 'create_design', title: 'QA deck', designType: 'presentation' } });
    assert.ok(created.text.includes('Blank design')); assert.ok(created.text.includes('https://www.canva.com/design/'));
    const exported = await adapter.execute({ actionId: 'write_canva', userId: 'owner', request: 'Export Canva design',
      credential: JSON.stringify(grant), arguments: { operation: 'export_design', designId: 'design-1', format: 'pdf' } });
    assert.ok(exported.text.includes('in_progress')); assert.ok(!exported.text.includes('urls'));
    assert.equal(relevantConnectedActions('Create a Canva design', [adapter]).length, 1);
    assert.equal(relevantConnectedActions('Read Canva export 00000000-0000-4000-8000-000000000001', [adapter]).length, 1);
  } finally { if (saved === undefined) delete process.env.CONNECTED_APPS_WRITES_ENABLED; else process.env.CONNECTED_APPS_WRITES_ENABLED = saved; }
});

test('WooCommerce validates store hosts and requests only the selected bounded page without customer PII', async () => {
  for (const host of ['localhost', '127.0.0.1', 'store.example:443', 'store.example/path', 'user@store.example', 'a.internal'])
    assert.throws(() => wooStoreDomain(host));
  let calls = 0;
  const adapter = wooCommerceAdapter(async (domain, path, credential) => {
    calls++; assert.equal(domain, 'shop.example'); assert.ok(path.includes('per_page=10')); assert.ok(path.includes('page=2'));
    assert.equal(credential?.key, `ck_${'a'.repeat(40)}`);
    return [{ id: 1, number: '1001', status: 'completed', date_created: '2026-10-01T10:00:00', currency: 'DZD', total: '2000',
      billing: { email: 'private@example.com' }, payment_method: 'private' }];
  });
  const result = await adapter.execute({ actionId: 'read_woocommerce', request: 'Read WooCommerce orders', userId: 'owner',
    credential: JSON.stringify({ ...grant, accessToken: `ck_${'a'.repeat(40)}`, refreshToken: `cs_${'b'.repeat(40)}`,
      scopes: ['woocommerce.read'], store: { domain: 'shop.example' } }), arguments: { operation: 'orders', page: 2 } });
  assert.equal(calls, 1); assert.ok(!result.text.includes('private')); assert.ok(result.text.includes('2000'));
  const authorize = new URL(adapter.oauth!.authorize({ redirectUri: 'https://joinvantra.com/api/connected-apps/oauth/callback',
    state: 'opaque-state', challenge: 'challenge', context: { shop: 'shop.example' } }));
  assert.equal(authorize.searchParams.get('scope'), 'read');
  assert.equal(authorize.searchParams.get('callback_url'), 'https://joinvantra.com/api/connected-apps/woocommerce/callback');
});

test('shared transport rejects arbitrary origins, redirects, oversized bodies and safe service errors', async () => {
  let calls = 0;
  const api = connectedHttp('https://api.example.com', async () => { calls++; return new Response('SECRET ERROR', { status: 401 }); });
  await assert.rejects(api('https://evil.example/path'), /permission_missing/); assert.equal(calls, 0);
  await assert.rejects(api('/read'), /authorization_expired/); assert.equal(calls, 1);
  await assert.rejects(connectedBody(new Response('oversized'), 2), /resource_not_found/);
  await assert.rejects(connectedHttp('https://api.example.com', async () => Response.json({ error: 'invalid_grant',
    error_description: 'private upstream content' }, { status: 400 }))('/token'), /^Error: authorization_expired$/);
});

test('Gmail search uses me, bounded metadata, explicit query and pagination without unrelated bodies', async () => {
  const calls: string[] = [];
  const adapter = gmailAdapter(async (url, options) => {
    calls.push(String(url)); assert.equal(options?.redirect, 'error');
    return calls.length === 1 ? Response.json({ messages: [{ id: 'abc123', threadId: 'thread1' }], nextPageToken: 'next1' })
      : Response.json({ id: 'abc123', snippet: 'Requested invoice', payload: { headers: [{ name: 'Subject', value: 'Invoice' }, { name: 'X-SECRET', value: 'private' }] } });
  });
  const result = await adapter.execute({ actionId: 'search_gmail', request: 'Search Gmail for invoice', userId: 'owner', credential: JSON.stringify(grant),
    arguments: { operation: 'search', query: 'invoice', pageToken: 'page1' } });
  assert.ok(calls[0].includes('maxResults=10')); assert.ok(calls[0].includes('pageToken=page1')); assert.ok(calls[1].includes('format=metadata'));
  assert.ok(result.text.includes('next1')); assert.ok(!result.text.includes('X-SECRET')); assert.ok(!result.text.includes(grant.accessToken));
});

test('Gmail reads only the selected message and extracts plain text without HTML or attachments', async () => {
  const adapter = gmailAdapter(async url => {
    assert.ok(String(url).includes('/messages/selected?format=full'));
    return Response.json({ id: 'selected', payload: { mimeType: 'multipart/mixed', parts: [
      { mimeType: 'text/html', body: { data: Buffer.from('<script>unsafe</script>').toString('base64url') } },
      { mimeType: 'text/plain', body: { data: Buffer.from('Safe requested email').toString('base64url') } },
    ] } });
  });
  const result = await adapter.execute({ actionId: 'search_gmail', request: 'Read Gmail message', userId: 'owner', credential: JSON.stringify(grant),
    arguments: { operation: 'read', messageId: 'selected' } });
  assert.equal(result.text.trim(), 'Safe requested email');
});

test('Gmail scope denial and parameter injection fail before any upstream call', async () => {
  let calls = 0; const adapter = gmailAdapter(async () => { calls++; throw new Error('UNEXPECTED'); });
  const match = relevantConnectedActions('Search Gmail', [adapter])[0];
  const result = await executeConnectedAction({ match, request: 'Search Gmail', userId: 'u', credential: JSON.stringify(grant),
    connection: { id: 'c', appId: 'gmail', scopes: [], expiresAt: grant.expiresAt, status: 'connected' }, arguments: { operation: 'search', query: 'invoices' } });
  assert.equal(result.error, 'permission_missing'); assert.equal(calls, 0);
  await assert.rejects(adapter.execute({ actionId: 'search_gmail', request: 'Search Gmail', userId: 'u', credential: JSON.stringify(grant),
    arguments: { operation: 'search', query: 'invoices', endpoint: 'https://evil.example' } })); assert.equal(calls, 0);
});

test('GitHub App OAuth is PKCE, expiring, account-verified and never requests broad repo scopes', async () => {
  const adapter = githubAdapter(async url => String(url).endsWith('/user') ? Response.json({ id: 42, login: 'qa-owner' })
    : Response.json({ access_token: 'fixture-ghu', refresh_token: 'fixture-ghr', token_type: 'bearer', expires_in: 28800, scope: '' }));
  const authorize = new URL(adapter.oauth!.authorize({ redirectUri: 'https://joinvantra.com/api/connected-apps/oauth/callback', state: 'state', challenge: 'challenge' }));
  assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256'); assert.equal(authorize.searchParams.get('scope'), null);
  const credentials = await adapter.oauth!.exchange({ redirectUri: 'https://joinvantra.com/api/connected-apps/oauth/callback', code: 'code', verifier: 'verifier' });
  assert.equal(credentials.account.name, 'qa-owner'); assert.deepEqual(credentials.scopes, ['github.user.read']);
});

test('GitHub repository target and text-file bounds are enforced independently of model arguments', async () => {
  let calls = 0; const adapter = githubAdapter(async () => { calls++; return Response.json({ encoding: 'base64', content: Buffer.from('Requested README').toString('base64'), size: 16, name: 'README.md' }); });
  const input = { actionId: 'read_github', userId: 'owner', credential: JSON.stringify(grant), arguments: { operation: 'file', owner: 'qa', repo: 'project', path: 'README.md' } };
  await assert.rejects(adapter.execute({ ...input, request: 'Read https://github.com/another/repo' }), /permission_missing/); assert.equal(calls, 0);
  const result = await adapter.execute({ ...input, request: 'Read https://github.com/qa/project/blob/main/README.md' }); assert.equal(result.text, 'Requested README');
  await assert.rejects(adapter.execute({ ...input, request: 'Read https://github.com/qa/project', arguments: { ...input.arguments, path: '../secret' } })); assert.equal(calls, 1);
});

test('Canva uses official REST PKCE, verified identity and one metadata page with continuation', async () => {
  const calls: string[] = [];
  const adapter = canvaAdapter(async url => {
    calls.push(String(url));
    if (String(url).endsWith('/oauth/token')) return Response.json({ access_token: 'fixture-canva', refresh_token: 'fixture-refresh', expires_in: 14400, scope: 'profile:read design:meta:read', token_type: 'Bearer' });
    if (String(url).endsWith('/users/me/profile')) return Response.json({ profile: { display_name: 'QA Canva' } });
    if (String(url).endsWith('/users/me')) return Response.json({ team_user: { user_id: 'canva-user', team_id: 'team' } });
    return Response.json({ items: [{ id: 'design', title: 'Requested design', secret: 'NOT FOR MODEL' }], continuation: 'next-page' });
  });
  const url = new URL(adapter.oauth!.authorize({ redirectUri: 'https://joinvantra.com/api/connected-apps/oauth/callback', state: 'state', challenge: 'challenge' }));
  assert.equal(url.origin, 'https://www.canva.com'); assert.equal(url.searchParams.get('code_challenge_method'), 's256');
  const credentials = await adapter.oauth!.exchange({ redirectUri: 'https://joinvantra.com/api/connected-apps/oauth/callback', code: 'code', verifier: 'verifier' });
  assert.equal(credentials.account.name, 'QA Canva');
  const result = await adapter.execute({ actionId: 'search_canva', request: 'Search Canva', userId: 'owner', credential: JSON.stringify(credentials), arguments: { query: 'requested', continuation: 'previous-page' } });
  assert.equal(calls.length, 4); assert.ok(result.text.includes('next-page')); assert.ok(!result.text.includes('NOT FOR MODEL'));
});

test('Shopify pins store, owned OAuth state/HMAC, timestamp and expiring Admin API grant', async () => {
  for (const invalid of ['localhost', 'qa.myshopify.com.evil.example', 'https://qa.myshopify.com', 'qa.myshopify.com/path']) assert.throws(() => shopifyDomain(invalid));
  const params = new URLSearchParams({ shop: 'qa.myshopify.com', code: 'code', state: 'state', timestamp: String(Math.floor(Date.now() / 1000)) });
  const message = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('&');
  params.set('hmac', createHmac('sha256', 'test-secret').update(message).digest('hex'));
  assert.equal(verifyShopifyCallback(params.toString(), 'qa.myshopify.com', 'test-secret'), true);
  assert.equal(verifyShopifyCallback(params.toString(), 'other.myshopify.com', 'test-secret'), false);
  assert.equal(verifyShopifyCallback(params.toString(), 'qa.myshopify.com', 'test-secret', Date.now() + 7200000), false);
  params.append('shop', 'evil.myshopify.com'); assert.equal(verifyShopifyCallback(params.toString(), 'qa.myshopify.com', 'test-secret'), false);
});

test('Shopify reads fixed GraphQL Admin operations, not Storefront or customer PII', async () => {
  const adapter = shopifyAdapter(async (url, options) => {
    assert.equal(new URL(String(url)).hostname, 'qa.myshopify.com'); assert.ok(String(url).includes('/admin/api/2026-10/graphql.json'));
    const body = JSON.parse(String(options?.body)); assert.ok(body.query.includes('first:10'));
    assert.ok(!/email|address|customer/iu.test(body.query)); assert.equal(new Headers(options?.headers).get('X-Shopify-Access-Token'), grant.accessToken);
    return Response.json({ data: { orders: { nodes: [{ name: '#1', currentTotalPriceSet: { shopMoney: { amount: '100', currencyCode: 'DZD' } } }], pageInfo: { hasNextPage: true, endCursor: 'next' } } } });
  });
  const result = await adapter.execute({ actionId: 'read_shopify', request: 'Read Shopify orders', userId: 'owner',
    credential: JSON.stringify({ ...grant, store: { domain: 'qa.myshopify.com' } }), arguments: { operation: 'orders' } });
  assert.ok(result.text.includes('partial')); assert.ok(result.text.includes('next'));
});

test('Google Workspace uses drive.file and RAW/string cells, not executable spreadsheet formulas', async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const adapter = googleWorkspaceAdapter(async (url, options) => { calls.push({ url: String(url), body: JSON.parse(String(options?.body)) });
    return Response.json({ spreadsheetId: 'spreadsheet-123' }); });
  assert.deepEqual(adapter.actions[0].requiredScopes, [WORKSPACE_SCOPE]);
  await adapter.execute({ actionId: 'write_google_workspace', request: 'Create Google Sheet', userId: 'owner', credential: JSON.stringify(grant),
    arguments: { operation: 'create_spreadsheet', title: 'QA', rows: [['=IMPORTXML("unsafe")', '100']] } });
  assert.ok(JSON.stringify(calls[0].body).includes('stringValue')); assert.ok(!JSON.stringify(calls[0].body).includes('formulaValue'));
});

test('external writes require explicit current-turn intent, not a connection or source instructions', () => {
  for (const request of ['My Gmail account', 'Do not send Gmail messages', 'لا ترسل رسالة', 'sans publier sur Canva']) assert.equal(explicitConnectedWriteRequest(request), false);
  for (const request of ['Draft a Gmail reply', 'أنشئ مسودة Gmail', 'Crée un brouillon Gmail']) assert.equal(explicitConnectedWriteRequest(request), true);
  assert.equal(relevantConnectedActions('Create a presentation from https://docs.google.com/document/d/example-file-123', [googleWorkspaceAdapter()]).length, 0);
});
