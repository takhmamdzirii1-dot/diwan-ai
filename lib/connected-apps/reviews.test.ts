import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptToken, decryptToken } from '@/lib/ai/provider-connections';
import { gmailAdapter, GMAIL_READ_SCOPE, GMAIL_DRAFT_SCOPE } from './gmail';
import { googleWorkspaceAdapter, WORKSPACE_SCOPE } from './google-workspace';

test('owned encrypted reviews bind exact content/grant; concurrent approval dispatches once; reconnect/replay/other owner fail closed', async () => {
  const env = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PROVIDER_TOKEN_ENCRYPTION_KEY', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GOOGLE_WORKSPACE_CLIENT_ID', 'GOOGLE_WORKSPACE_CLIENT_SECRET', 'CONNECTED_APPS_WRITES_ENABLED'];
  const saved = new Map(env.map(key => [key, process.env[key]])); const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-server-key';
  process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = 'fixture-encryption-key'; process.env.GMAIL_CLIENT_ID = 'fixture-client';
  process.env.GMAIL_CLIENT_SECRET = 'fixture-client-secret'; process.env.CONNECTED_APPS_WRITES_ENABLED = 'true';
  process.env.GOOGLE_WORKSPACE_CLIENT_ID = 'fixture-workspace-client'; process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = 'fixture-workspace-secret';
  const owner = '00000000-0000-4000-8000-000000000001';
  let grant = { accessToken: 'fixture-access', refreshToken: 'fixture-refresh', expiresAt: new Date(Date.now() + 3600000).toISOString(),
    scopes: [GMAIL_READ_SCOPE, GMAIL_DRAFT_SCOPE], grantId: crypto.randomUUID(), account: { id: 'verified-mailbox', name: 'QA' } };
  const connection = { id: '00000000-0000-4000-8000-000000000002', app_id: 'gmail', user_id: owner, status: 'connected', scopes: grant.scopes,
    expires_at: grant.expiresAt, encrypted_credentials: encryptToken(JSON.stringify(grant)) };
  const reviews = new Map<string, Record<string, unknown>>(); let writes = 0; let ambiguousWrite = false;
  let documentsCreated = 0; let documentsUpdated = 0;
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input)); const method = options?.method ?? 'GET';
    if (url.hostname === 'docs.googleapis.com') {
      assert.equal(method, 'POST');
      const body = JSON.parse(String(options?.body));
      if (url.pathname === '/v1/documents') {
        assert.equal(url.searchParams.get('fields'), 'documentId');
        documentsCreated++; assert.equal(body.title, 'VANTRA reviewed QA document');
        return Response.json({ documentId: 'reviewed-document-123' });
      }
      assert.equal(url.pathname, '/v1/documents/reviewed-document-123:batchUpdate');
      assert.equal(body.requests[0].insertText.text, 'Exact reviewed content'); documentsUpdated++;
      return Response.json({ documentId: 'reviewed-document-123' });
    }
    if (url.hostname === 'gmail.googleapis.com') {
      assert.equal(url.pathname, '/gmail/v1/users/me/drafts'); assert.equal(method, 'POST'); writes++;
      if (ambiguousWrite) throw new Error('provider_unavailable');
      const message = JSON.parse(String(options?.body));
      const raw = Buffer.from(message.message.raw, 'base64url').toString('utf8');
      assert.ok(raw.includes('To: qa@example.com')); assert.ok(!raw.includes('Bcc:'));
      assert.ok(raw.includes(Buffer.from('Reviewed draft body').toString('base64')));
      return Response.json({ id: 'draft-created' });
    }
    assert.equal(url.hostname, 'fixture.supabase.co');
    if (url.pathname.endsWith('/connected_app_connections')) {
      return Response.json(url.searchParams.get('user_id') === `eq.${owner}`
        && url.searchParams.get('app_id') === `eq.${connection.app_id}` ? [connection] : []);
    }
    if (url.pathname.endsWith('/rpc/claim_connected_app_action_review')) {
      const body = JSON.parse(String(options?.body)); const row = reviews.get(body.p_id);
      const claimed = row && row.user_id === body.p_user_id && row.status === 'pending' && Date.parse(String(row.expires_at)) > Date.now() && connection.status === 'connected';
      if (claimed) row!.status = 'executing';
      return Response.json(claimed ? [row] : []);
    }
    assert.ok(url.pathname.endsWith('/connected_app_action_reviews'));
    if (method === 'POST') {
      const body = JSON.parse(String(options?.body)); assert.equal(body.user_id, owner);
      assert.ok(!body.encrypted_payload.includes('Reviewed draft body'));
      let row = [...reviews.values()].find(row => row.operation_key === body.operation_key);
      if (!row) { row = { ...body, id: crypto.randomUUID(), status: 'pending', expires_at: new Date(Date.now() + 900000).toISOString() }; reviews.set(String(row.id), row); }
      return Response.json([row]);
    }
    const selected = [...reviews.values()].filter(row => url.searchParams.get('user_id') === `eq.${row.user_id}`
      && (!url.searchParams.has('id') || url.searchParams.get('id') === `eq.${row.id}`)
      && (!url.searchParams.has('status') || url.searchParams.get('status') === `eq.${row.status}`));
    if (method === 'PATCH') selected.forEach(row => Object.assign(row, JSON.parse(String(options?.body))));
    return method === 'PATCH' ? new Response(null, { status: 204 }) : Response.json(selected);
  };
  try {
    const { prepareConnectedReview, listConnectedReviews, resolveConnectedReview } = await import('./reviews.server');
    const adapter = gmailAdapter(); const action = adapter.actions.find(action => action.id === 'draft_gmail')!;
    const proposal = { userId: owner, operationId: 'turn-one', match: { adapter, action }, request: 'Draft a Gmail message',
      arguments: { to: 'qa@example.com', subject: 'Reviewed subject', body: 'Reviewed draft body' } };
    await prepareConnectedReview(proposal); await prepareConnectedReview(proposal);
    assert.equal(reviews.size, 1); assert.equal(writes, 0);
    const list = await listConnectedReviews(owner); assert.equal(list[0].arguments.body, 'Reviewed draft body');
    assert.ok(!JSON.stringify(list).includes(grant.accessToken));
    assert.deepEqual(await listConnectedReviews('other-owner'), []);
    assert.equal((await resolveConnectedReview('other-owner', list[0].id, true)).status, 'not_executed');
    const results = await Promise.all([resolveConnectedReview(owner, list[0].id, true), resolveConnectedReview(owner, list[0].id, true)]);
    assert.equal(results.filter(result => result.status === 'completed').length, 1); assert.equal(writes, 1);
    assert.equal((await resolveConnectedReview(owner, list[0].id, true)).status, 'not_executed'); assert.equal(writes, 1);
    await prepareConnectedReview({ ...proposal, operationId: 'turn-two' });
    const second = [...reviews.values()].find(row => row.status === 'pending')!;
    grant = { ...grant, grantId: crypto.randomUUID() }; connection.encrypted_credentials = encryptToken(JSON.stringify(grant));
    assert.equal((await resolveConnectedReview(owner, String(second.id), true)).status, 'failed'); assert.equal(writes, 1);
    await prepareConnectedReview({ ...proposal, operationId: 'turn-three' });
    const third = [...reviews.values()].find(row => row.status === 'pending')!;
    await resolveConnectedReview(owner, String(third.id), false);
    assert.equal((await resolveConnectedReview(owner, String(third.id), true)).status, 'not_executed'); assert.equal(writes, 1);
    assert.ok(JSON.parse(decryptToken(String([...reviews.values()][0].encrypted_payload))!).result);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(resolveConnectedReview(owner, list[0].id, true, controller.signal)); assert.equal(writes, 1);
    await prepareConnectedReview({ ...proposal, operationId: 'uncertain-write' });
    const uncertain = [...reviews.values()].find(row => row.status === 'pending')!;
    ambiguousWrite = true;
    assert.equal((await resolveConnectedReview(owner, String(uncertain.id), true)).status, 'unknown'); assert.equal(writes, 2);
    assert.equal((await resolveConnectedReview(owner, String(uncertain.id), true)).status, 'not_executed'); assert.equal(writes, 2);
    await assert.rejects(prepareConnectedReview({ ...proposal, operationId: 'invalid', arguments: { ...proposal.arguments, endpoint: 'https://evil.example' } }));
    // The same owned queue and atomic claim used by Gmail also govern Docs creation.
    grant = { ...grant, scopes: [WORKSPACE_SCOPE], grantId: crypto.randomUUID() };
    Object.assign(connection, { app_id: 'google_workspace', scopes: grant.scopes, encrypted_credentials: encryptToken(JSON.stringify(grant)) });
    const workspace = googleWorkspaceAdapter();
    const document = { userId: owner, operationId: 'docs-turn', match: { adapter: workspace, action: workspace.actions[0] },
      request: 'Create a Google Docs document', arguments: { operation: 'create_document', title: 'VANTRA reviewed QA document', text: 'Exact reviewed content' } };
    await prepareConnectedReview(document); await prepareConnectedReview(document);
    assert.equal(documentsCreated, 0); assert.equal(documentsUpdated, 0);
    const pendingDoc = (await listConnectedReviews(owner)).find(row => row.appId === 'google_workspace')!;
    assert.equal(pendingDoc.status, 'pending'); assert.equal(pendingDoc.arguments.text, 'Exact reviewed content');
    assert.equal((await resolveConnectedReview('other-owner', pendingDoc.id, true)).status, 'not_executed');
    const approvals = await Promise.all([resolveConnectedReview(owner, pendingDoc.id, true), resolveConnectedReview(owner, pendingDoc.id, true)]);
    assert.equal(approvals.filter(result => result.status === 'completed').length, 1);
    assert.equal(documentsCreated, 1); assert.equal(documentsUpdated, 1);
    assert.equal((await resolveConnectedReview(owner, pendingDoc.id, true)).status, 'not_executed');
    assert.equal(documentsCreated, 1); assert.equal(documentsUpdated, 1);
    assert.match((await listConnectedReviews(owner)).find(row => row.id === pendingDoc.id)!.result!.text, /reviewed-document-123/);
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of env) { const value = saved.get(key); if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
