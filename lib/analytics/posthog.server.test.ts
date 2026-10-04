import assert from 'node:assert/strict';
import test from 'node:test';
import { AsyncLocalStorage } from 'node:async_hooks';

test('approved outcome is owned, consented, immutable and emitted once on parallel/repeated approval', async () => {
  // Install the Node request-scope implementation before importing Next's after.
  Object.assign(globalThis, { AsyncLocalStorage });
  const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
  const { workUnitAsyncStorage } = await import('next/dist/server/app-render/work-unit-async-storage.external.js');
  const saved = { fetch: globalThis.fetch, env: { ...process.env } };
  const rows = new Set<string>();
  const captures: Record<string, unknown>[] = [];
  const afterTasks: (() => Promise<void>)[] = [];
  let consent: boolean | undefined = true;
  const userId = '11111111-1111-4111-8111-111111111111';
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_fixture';
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_fixture000';
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://us.i.posthog.com';
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url === 'https://us.i.posthog.com/capture/') {
        captures.push(JSON.parse(String(init?.body))); return Response.json({ status: 1 });
      }
      assert.ok(url.startsWith('https://fixture.supabase.test/'), 'no real network');
      if (url.includes('/auth/v1/admin/users/')) return Response.json({ id: userId,
        user_metadata: { marketing_consent: consent, email: 'never-send', language: 'ar',
          acquisition: { utm_source: 'fixture', landing_variant: 'creators' } } });
      if (url.includes('/rest/v1/payment_orders')) {
        assert.ok(url.includes(`user_id=eq.${userId}`));
        const rejected = url.includes('id=eq.rejected');
        return Response.json({ status: rejected ? 'rejected' : 'approved', payment_method: 'ccp',
          entitlement: { plan_code: 'pro' }, payment_reference: 'NEVER-SEND', proof_storage_path: 'private' });
      }
      assert.ok(url.includes('/rest/v1/admin_audit_log'));
      const row = JSON.parse(String(init?.body));
      if (rows.has(row.id)) return Response.json({ code: '23505' }, { status: 409 });
      rows.add(row.id); return new Response(null, { status: 201 });
    };
    const { recordFunnelEvent } = await import('./funnel-events');
    const request = async (run: () => Promise<unknown>) => workAsyncStorage.run({
      afterContext: { after: (callback: () => Promise<void>) => { afterTasks.push(callback); } },
    } as unknown as Parameters<typeof workAsyncStorage.run>[0], () => workUnitAsyncStorage.run({
      type: 'request',
    } as unknown as Parameters<typeof workUnitAsyncStorage.run>[0], run));
    await request(() => Promise.all([1, 2, 3].map(() => recordFunnelEvent({ userId,
      event: 'payment_approved', key: 'approved', metadata: { email: 'never-send' } }))));
    assert.equal(afterTasks.length, 1);
    await afterTasks.shift()!();
    assert.equal(captures.length, 1); assert.equal(captures[0].event, 'payment_success');
    assert.ok(Number.isFinite(Date.parse(String(captures[0].timestamp))));
    const properties = captures[0].properties as Record<string, unknown>;
    assert.equal(properties.distinct_id, userId); assert.equal(properties.plan, 'pro');
    assert.equal(properties.payment_method, 'ccp'); assert.equal(properties.locale, 'ar');
    assert.equal(properties.email, undefined); assert.equal(properties.payment_reference, undefined);
    assert.equal(properties.$ip, null); assert.equal(properties.$geoip_disable, true);
    await request(() => recordFunnelEvent({ userId, event: 'payment_rejected', key: 'rejected' }));
    await afterTasks.shift()!(); assert.equal(captures[1].event, 'payment_failed');
    consent = false;
    await request(() => recordFunnelEvent({ userId, event: 'payment_approved', key: 'no-consent' }));
    assert.equal(afterTasks.length, 0);
    consent = true;
    await request(() => recordFunnelEvent({ userId, event: 'signup_completed', key: 'signup' }));
    await afterTasks.shift()!(); assert.equal(captures[2].event, 'signup_completed');
    consent = undefined; // No popup grant is required for PostHog; Meta still requires one.
    await request(() => recordFunnelEvent({ userId, event: 'payment_approved', key: 'default-on' }));
    await afterTasks.shift()!(); assert.equal(captures[3].event, 'payment_success');
  } finally {
    globalThis.fetch = saved.fetch;
    for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_POSTHOG_KEY', 'NEXT_PUBLIC_POSTHOG_HOST', 'NEXT_PUBLIC_META_PIXEL_ID']) {
      if (saved.env[key] === undefined) delete process.env[key]; else process.env[key] = saved.env[key];
    }
  }
});
