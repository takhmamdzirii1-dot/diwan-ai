import assert from 'node:assert/strict';
import test from 'node:test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-server-key-not-a-credential';

test('operation recovery resolves only the authenticated owner and never creates/settles an absent or foreign operation', async () => {
  const previous = globalThis.fetch; const requests: URL[] = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(init?.method ?? 'GET', 'GET');
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    requests.push(url);
    return new Response('[]', { headers: { 'content-type': 'application/json' } });
  };
  try {
    const { recoverOwnedMediaOperation } = await import('./media-recovery.server');
    assert.equal(await recoverOwnedMediaOperation('authenticated-owner', 'existing-operation'), null);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].searchParams.get('user_id'), 'eq.authenticated-owner');
    assert.equal(requests[0].searchParams.get('operation_key'), 'eq.existing-operation');
    assert.equal(requests[0].pathname, '/rest/v1/ai_executions');
  } finally { globalThis.fetch = previous; }
});
