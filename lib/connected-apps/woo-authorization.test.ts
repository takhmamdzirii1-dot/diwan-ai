import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

test('Woo callback verifies the original store, binds the owned nonce, completes once and cannot report an old grant as a new connection', async () => {
  const names = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PROVIDER_TOKEN_ENCRYPTION_KEY'];
  const saved = new Map(names.map(name => [name, process.env[name]])); const previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-server-key';
  process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = 'fixture-encryption';
  const nonce = 'a'.repeat(43); const owner = '00000000-0000-4000-8000-000000000001';
  let status = 'pending'; let completions = 0; let storeReads = 0; let falseIdentity = false;
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input)); assert.equal(url.hostname, 'fixture.supabase.co');
    if (url.pathname.endsWith('/rpc/complete_woocommerce_authorization')) {
      const body = JSON.parse(String(options?.body));
      assert.equal(body.p_nonce_hash, createHash('sha256').update(nonce).digest('hex'));
      assert.ok(!body.p_encrypted_credentials.includes('ck_'));
      const valid = status === 'pending'; if (valid) { status = 'completed'; completions++; }
      return Response.json(valid);
    }
    assert.ok(url.pathname.endsWith('/connected_app_authorizations'));
    const matches = url.searchParams.get('nonce_hash') === `eq.${createHash('sha256').update(nonce).digest('hex')}`
      && url.searchParams.get('status') === `eq.${status}`
      && (!url.searchParams.has('user_id') || url.searchParams.get('user_id') === `eq.${owner}`)
      && (!url.searchParams.has('store_domain') || url.searchParams.get('store_domain') === 'eq.shop.example');
    return Response.json(matches ? [{ store_domain: 'shop.example', status, expires_at: new Date(Date.now() + 600000).toISOString() }] : []);
  };
  try {
    const { receiveWooAuthorization, completedWooAuthorization } = await import('./woo-authorization.server');
    const body = { key_id: 1, user_id: nonce, consumer_key: `ck_${'a'.repeat(40)}`,
      consumer_secret: `cs_${'b'.repeat(40)}`, key_permissions: 'read' };
    const load = async (domain: string, path: string, credentials?: { key: string; secret: string }) => {
      storeReads++; assert.equal(domain, 'shop.example');
      if (path === '/wp-json') { assert.equal(credentials, undefined);
        return { name: 'QA store', url: falseIdentity ? 'https://other.example' : 'https://shop.example' }; }
      assert.equal(path, '/wp-json/wc/v3/products?per_page=1&_fields=id'); assert.equal(credentials?.key, body.consumer_key); return [];
    };
    assert.equal(await completedWooAuthorization(owner, nonce, 'shop.example'), false);
    falseIdentity = true; await assert.rejects(receiveWooAuthorization(body, undefined, load), /permission_missing/);
    assert.equal(completions, 0);
    falseIdentity = false; await receiveWooAuthorization(body, undefined, load); assert.equal(completions, 1);
    assert.equal(await completedWooAuthorization(owner, nonce, 'shop.example'), true);
    assert.equal(await completedWooAuthorization('another-owner', nonce, 'shop.example'), false);
    assert.equal(await completedWooAuthorization(owner, 'b'.repeat(43), 'shop.example'), false);
    assert.equal(await completedWooAuthorization(owner, nonce, 'other.example'), false);
    const reads = storeReads; await assert.rejects(receiveWooAuthorization(body, undefined, load), /permission_missing/);
    assert.equal(storeReads, reads); assert.equal(completions, 1);
  } finally { globalThis.fetch = previousFetch;
    for (const name of names) { const value = saved.get(name); if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});
