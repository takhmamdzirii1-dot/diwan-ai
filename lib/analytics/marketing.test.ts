import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeAttribution, landingBatchSchema, isNewSignup, isCompletedGeneration, metaConfiguration, META_EVENTS } from './marketing';

test('acquisition permits bounded first-touch campaign/click fields, never arbitrary metadata', () => {
  const value = sanitizeAttribution({ utm_source: ' Meta\n', fbclid: 'click_123', first_seen: '2026-10-03T00:00:00Z',
    email: 'private@example.com', token: 'secret', utm_campaign: 'a'.repeat(400) });
  assert.equal(value.utm_source, 'Meta'); assert.equal(value.fbclid, 'click_123');
  assert.equal(value.utm_campaign?.length, 200);
  assert.equal('email' in value, false); assert.equal('token' in value, false);
  assert.deepEqual(sanitizeAttribution({ fbclid: 'https://evil.test?key=secret', first_seen: 'invalid' }), {});
});

const base = { id: '399cbb51-5507-4c89-8e32-2dfd9eec194d', variant: 'home', locale: 'ar' };
test('anonymous batch accepts only bounded marketing intents, not outcomes or actors', () => {
  const body = { visitorId: base.id, events: [{ ...base, event: 'landing_view' }] };
  assert.equal(landingBatchSchema.safeParse(body).success, true);
  for (const event of ['payment_approved', 'signup_completed', 'first_generation_succeeded', 'plan_updated']) {
    assert.equal(landingBatchSchema.safeParse({ ...body, events: [{ ...base, event }] }).success, false);
  }
  assert.equal(landingBatchSchema.safeParse({ ...body, actor: base.id }).success, false);
  assert.equal(landingBatchSchema.safeParse({ ...body, events: Array(21).fill(body.events[0]) }).success, false);
  assert.equal(landingBatchSchema.safeParse({ ...body, events: [{ ...base, event: 'pricing_select', location: 'pricing', plan: 'lite' }] }).success, false);
});

test('all locales, paid variants, explicit CTA locations and public plans are trackable', () => {
  for (const locale of ['en', 'fr', 'ar']) for (const variant of ['home', 'all-ai', 'ai-in-dzd', 'creators']) {
    assert.equal(landingBatchSchema.safeParse({ visitorId: base.id, events: [
      { ...base, locale, variant, event: 'cta_click', location: 'hero' },
      { ...base, locale, variant, event: 'pricing_select', location: 'pricing', plan: 'max' },
    ] }).success, true);
  }
});

test('signup completion requires the authenticated account to be newly created near this signup intent', () => {
  const now = Date.parse('2026-10-03T12:00:00Z');
  assert.equal(isNewSignup('2026-10-03T10:01:00Z', '2026-10-03T10:00:00Z', now), true);
  assert.equal(isNewSignup('2025-10-03T10:01:00Z', '2026-10-03T10:00:00Z', now), false);
  assert.equal(isNewSignup('2026-10-04T10:01:00Z', '2026-10-04T10:00:00Z', now), false);
  assert.equal(isNewSignup('2026-09-01T10:01:00Z', '2026-09-01T10:00:00Z', now), false);
});

test('first generation depends on canonical completed state, not provider success or reserved credits', () => {
  for (const state of ['reserved', 'streaming', 'failed', 'client_cancelled', 'provider_cancelled', 'abandoned']) {
    assert.equal(isCompletedGeneration({ state }), false);
  }
  assert.equal(isCompletedGeneration({ state: 'completed', credits_charged: 0 }), true);
  assert.equal(isCompletedGeneration({ state: 'completed', idempotent: true }), true);
  assert.equal(isCompletedGeneration({ provider_status: 'succeeded' }), false);
});

test('Meta is disabled without complete valid configuration; conversion names reuse trusted funnel events', () => {
  assert.equal(metaConfiguration({}), null);
  assert.equal(metaConfiguration({ NEXT_PUBLIC_META_PIXEL_ID: '123456' }), null);
  assert.equal(metaConfiguration({ NEXT_PUBLIC_META_PIXEL_ID: '123456', META_CAPI_ACCESS_TOKEN: 'test' }), null);
  assert.equal(metaConfiguration({ NEXT_PUBLIC_META_PIXEL_ID: '123456', META_CAPI_ACCESS_TOKEN: 'test', META_GRAPH_API_VERSION: 'https://evil' }), null);
  assert.ok(metaConfiguration({ NEXT_PUBLIC_META_PIXEL_ID: '123456', META_CAPI_ACCESS_TOKEN: 'fixture', META_GRAPH_API_VERSION: 'v99.0' }));
  assert.equal(META_EVENTS.payment_approved, 'Purchase');
  assert.equal(META_EVENTS.checkout_started, 'InitiateCheckout');
});
