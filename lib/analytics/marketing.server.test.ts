import assert from 'node:assert/strict';
import test from 'node:test';

test('existing audit store: batch replay and parallel first-success writes count once, failures count zero', async () => {
  const previous = { fetch: globalThis.fetch, url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY, pixel: process.env.NEXT_PUBLIC_META_PIXEL_ID };
  const rows = new Map<string, Record<string, unknown>>();
  let writes = 0;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_fixture';
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      assert.ok(url.startsWith('https://fixture.supabase.test/'), 'no real network or Meta call');
      if (url.includes('/auth/v1/admin/users/')) return Response.json({ id: '11111111-1111-4111-8111-111111111111',
        created_at: '2026-10-03T10:00:00Z', user_metadata: { acquisition: { utm_source: 'fixture', fbclid: 'fixture_click' } } });
      assert.ok(url.includes('/rest/v1/admin_audit_log'));
      writes++;
      const body = JSON.parse(String(init?.body));
      const batch = Array.isArray(body) ? body : [body];
      const inserted: { id: string }[] = [];
      for (const row of batch) {
        if (rows.has(row.id)) {
          if (!Array.isArray(body)) return Response.json({ code: '23505' }, { status: 409 });
          continue;
        }
        rows.set(row.id, row); inserted.push({ id: row.id });
      }
      return new Response(JSON.stringify(inserted), { status: 201, headers: { 'content-type': 'application/json' } });
    };
    const { recordLandingBatch } = await import('./landing.server');
    const { recordFirstGenerationSuccess } = await import('./funnel-events');
    const visitorId = '11111111-1111-4111-8111-111111111111';
    const batch = { visitorId, events: [{ id: visitorId, variant: 'home', locale: 'fr', event: 'landing_view' }] };
    assert.equal((await recordLandingBatch(batch, false)).recorded, 1);
    assert.equal((await recordLandingBatch(batch, false)).recorded, 0);
    assert.equal((await recordLandingBatch({ ...batch, events: [{ ...batch.events[0], event: 'payment_approved' }] }, false)).status, 400);
    const count = writes;
    await recordFirstGenerationSuccess(visitorId, 'failed', { state: 'failed' });
    assert.equal(writes, count);
    await Promise.all(['first', 'second', 'replay'].map(execution => recordFirstGenerationSuccess(visitorId, execution, { state: 'completed' })));
    const successes = [...rows.values()].filter(row => row.action === 'first_generation_succeeded');
    assert.equal(successes.length, 1); assert.equal(successes[0].actor_user_id, visitorId);
    assert.equal(rows.size, 2);
    assert.equal([...rows.values()].find(row => row.action === 'landing_view')?.actor_user_id, null);
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [name, value] of [['NEXT_PUBLIC_SUPABASE_URL', previous.url], ['SUPABASE_SERVICE_ROLE_KEY', previous.secret], ['NEXT_PUBLIC_META_PIXEL_ID', previous.pixel]]) {
      if (value === undefined) delete process.env[name!]; else process.env[name!] = value;
    }
  }
});
