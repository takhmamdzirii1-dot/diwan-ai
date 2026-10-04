import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import vm from 'node:vm';
import { posthogConfiguration, publicAnalyticsPath, replayAllowed, safeAnalyticsProperties, safePosthogWireEvent, safeReplayNetwork, safeAnalyticsProxyHeaders, POSTHOG_EVENTS } from './posthog';

const id = '11111111-1111-4111-8111-111111111111';
test('PostHog configuration fails closed and accepts only official Cloud ingestion hosts', () => {
  assert.equal(posthogConfiguration({}), null);
  assert.equal(posthogConfiguration({ NEXT_PUBLIC_POSTHOG_KEY: 'phc_fixture000', NEXT_PUBLIC_POSTHOG_HOST: 'https://evil.test' }), null);
  assert.ok(posthogConfiguration({ NEXT_PUBLIC_POSTHOG_KEY: 'phc_fixture000', NEXT_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com' }));
});
test('all ten events retain only allowlisted funnel properties, not PII or SDK enrichment', () => {
  for (const event of POSTHOG_EVENTS) {
    const safe = safePosthogWireEvent({ event, properties: { distinct_id: id, $insert_id: id,
      utm_source: 'campaign_123', utm_campaign: 'private@email.test', utm_content: 'file.pdf',
      landing_variant: 'home', locale: 'ar', plan: 'pro', payment_method: 'ccp',
      email: 'private@email.test', prompt: 'private', filename: 'file.pdf', token: 'secret',
      $current_url: 'https://site.test?email=private', $referrer: 'private', $set: { email: 'private' }, $device_id: 'device' } });
    if (event === 'payment_success' || event === 'signup_completed') { assert.equal(safe, null); continue; }
    assert.deepEqual(safe?.properties, { utm_source: 'campaign_123', landing_variant: 'home', locale: 'ar',
      plan: 'pro', payment_method: 'ccp', $geoip_disable: true, distinct_id: id, $insert_id: id });
  }
  assert.equal(safePosthogWireEvent({ event: '$pageview', properties: {} }), null);
  assert.equal(safePosthogWireEvent({ event: '$identify', properties: { distinct_id: 'email@test.com' } }), null);
  assert.deepEqual(safeAnalyticsProperties({ error_code: 'some private server message' }), {});
});

async function browserFixture(initialConsent = '', initialPath = '/en') {
  const calls: { method: string; args: unknown[] }[] = [];
  const sdk: Record<string, (...args: unknown[]) => void> = {};
  for (const method of ['init', 'set_config', 'capture', 'identify', 'reset', 'opt_in_capturing', 'opt_out_capturing', 'startSessionRecording', 'stopSessionRecording']) {
    sdk[method] = (...args) => { calls.push({ method, args }); };
  }
  const storage = new Map<string, string>([['vantra_attribution_v1', JSON.stringify({
    utm_source: 'meta', utm_campaign: 'paid_oct', landing_variant: 'creators', fbclid: 'never-send' })]]);
  const document = { cookie: initialConsent, documentElement: { lang: 'ar' } };
  const output = await build({ entryPoints: ['src/lib/product-analytics.ts'], bundle: true, write: false,
    format: 'iife', globalName: 'analyticsFixture', platform: 'browser',
    define: { 'process.env.NEXT_PUBLIC_POSTHOG_KEY': '"phc_fixture000"', 'process.env.NEXT_PUBLIC_POSTHOG_HOST': '"https://us.i.posthog.com"' },
    plugins: [{ name: 'fixture-sdk', setup(builder) {
      builder.onResolve({ filter: /^posthog-js\/no-external$/ }, () => ({ path: 'sdk', namespace: 'fixture' }));
      builder.onResolve({ filter: /^posthog-js\/dist\/lazy-recorder$/ }, () => ({ path: 'recorder', namespace: 'fixture' }));
      builder.onResolve({ filter: /^posthog-js\/dist\/web-vitals$/ }, () => ({ path: 'vitals', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export default globalThis.fixtureSdk;', loader: 'js' }));
    } }] });
  const location = { pathname: initialPath, search: '', hash: '' };
  const window = { location, history: { pushState(_state: unknown, _unused: string, url?: string) { location.pathname = url || location.pathname; }, replaceState() {} }, addEventListener() {} };
  const context = vm.createContext({ document, window, URLSearchParams, fixtureSdk: sdk, crypto: { randomUUID: () => id },
    localStorage: { getItem: (key: string) => storage.get(key) ?? null }, console });
  vm.runInContext(output.outputFiles[0].text, context);
  const analytics = context.analyticsFixture as typeof import('../../src/lib/product-analytics');
  const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };
  return { analytics, calls, document, window, flush };
}
test('public analytics initializes without a popup/grant; duplicate checkout callbacks emit once with timestamp/UTM', async () => {
  const { analytics, calls, document, flush } = await browserFixture();
  analytics.trackProductEvent('checkout_started', 'attempt', { plan: 'pro', email: 'never' });
  analytics.trackProductEvent('checkout_started', 'attempt', { plan: 'pro' });
  await flush();
  assert.equal(calls.filter(call => call.method === 'init').length, 1);
  const captures = calls.filter(call => call.method === 'capture' && call.args[0] === 'checkout_started');
  assert.equal(captures.length, 1);
  assert.equal((captures[0].args[1] as Record<string, unknown>).utm_campaign, 'paid_oct');
  assert.equal((captures[0].args[1] as Record<string, unknown>).email, undefined);
  assert.ok(Number.isFinite((captures[0].args[2] as { timestamp: Date }).timestamp.getTime()));
  const options = calls.find(call => call.method === 'init')!.args[1] as Record<string, unknown>;
  for (const key of ['autocapture', 'capture_pageview', 'capture_pageleave', 'capture_performance', 'capture_exceptions', 'ip']) assert.equal(options[key], false);
  for (const key of ['disable_session_recording', 'disable_surveys', 'disable_external_dependency_loading', 'advanced_disable_feature_flags']) assert.equal(options[key], true);
  assert.equal(options.api_host, '/v-events');
  const publicOptions = calls.find(call => call.method === 'set_config')!.args[0] as Record<string, unknown>;
  assert.equal(publicOptions.capture_heatmaps, true);
  assert.deepEqual(JSON.parse(JSON.stringify(publicOptions.capture_performance)), { web_vitals: true, web_vitals_attribution: false, network_timing: true });
  document.cookie = 'vantra_marketing_consent=denied'; analytics.syncAnalyticsConsent();
  analytics.trackProductEvent('cta_click', 'denied'); await flush();
  assert.equal(calls.filter(call => call.method === 'capture' && call.args[0] === 'checkout_started').length, 1);
  assert.equal(calls.filter(call => call.method === 'capture' && call.args[0] === 'cta_click').length, 0);
});

test('public pageviews and masked 100% replay; navigation stops replay before private DOM', async () => {
  for (const path of ['/', '/en', '/ar/go/creators', '/fr/signup', '/en/pricing', '/en/checkout']) assert.ok(publicAnalyticsPath(path));
  for (const path of ['/studio', '/studio/chat', '/admin', '/ar/studio', '/en/admin', '/checkout/order/private']) assert.equal(publicAnalyticsPath(path), null);
  assert.equal(replayAllowed({ pathname: '/en', search: '?code=private', hash: '' }), false);
  assert.equal(replayAllowed({ pathname: '/en', search: '?utm_campaign=launch', hash: '' }), true);
  assert.equal(replayAllowed({ pathname: '/en', search: '?fbclid=click_123', hash: '#pricing' }), true);
  const { analytics, calls, document, window, flush } = await browserFixture();
  window.location.pathname = '/en'; analytics.installAnalyticsNavigation(); await flush();
  await flush();
  assert.equal(calls.filter(call => call.method === 'capture' && call.args[0] === '$pageview').length, 1);
  assert.equal(calls.filter(call => call.method === 'startSessionRecording').length, 1);
  const options = calls.find(call => call.method === 'init')!.args[1] as { session_recording: Record<string, unknown> };
  assert.equal(options.session_recording.maskAllInputs, true);
  assert.equal(options.session_recording.maskTextSelector, '*');
  assert.equal(options.session_recording.maskAllElementAttributes, true);
  assert.equal(options.session_recording.sampleRate, 1);
  calls.length = 0;
  window.history.pushState(null, '', '/studio/chat'); await flush();
  assert.equal(calls[0].method, 'stopSessionRecording');
  assert.equal(calls.filter(call => call.method === 'startSessionRecording' || call.method === 'capture').length, 0);
});

test('Web Analytics keeps only canonical public URL and session UUID; query/private paths are rejected', () => {
  const properties = { distinct_id: id, $session_id: id, $current_url: 'https://joinvantra.com/en', email: 'private' };
  assert.equal(safePosthogWireEvent({ event: '$pageview', properties })?.properties.$current_url, 'https://joinvantra.com/en');
  for (const url of ['https://joinvantra.com/studio/chat', 'https://joinvantra.com/en?code=secret', 'https://evil.test/en'])
    assert.equal(safePosthogWireEvent({ event: '$pageview', properties: { ...properties, $current_url: url } }), null);
});

test('each browser funnel intent is emitted once even when its handler is invoked twice', async () => {
  const { analytics, calls, flush } = await browserFixture('vantra_marketing_consent=granted');
  for (const event of POSTHOG_EVENTS) {
    if (event === 'payment_success' || event === 'signup_completed') continue;
    analytics.trackProductEvent(event, 'same-attempt', { locale: 'fr', plan: 'pro' });
    analytics.trackProductEvent(event, 'same-attempt', { locale: 'fr', plan: 'pro' });
  }
  await flush();
  for (const event of POSTHOG_EVENTS) {
    const count = calls.filter(call => call.method === 'capture' && call.args[0] === event).length;
    assert.equal(count, event === 'payment_success' || event === 'signup_completed' ? 0 : 1);
  }
});
test('identity only follows authenticated UUID; logout resets and explicit denial blocks intents', async () => {
  const { analytics, calls, document, flush } = await browserFixture('vantra_marketing_consent=granted');
  analytics.identifyAnalyticsUser(id); analytics.syncAnalyticsConsent(); await flush();
  const identities = calls.filter(call => call.method === 'identify');
  assert.equal(identities.length, 1); assert.equal(identities[0].args.length, 1); assert.equal(identities[0].args[0], id);
  analytics.identifyAnalyticsUser(null); assert.equal(calls.filter(call => call.method === 'reset').length, 1);
  calls.length = 0;
  document.cookie = 'vantra_marketing_consent=denied'; analytics.trackProductEvent('cta_click', 'pending');
  document.cookie = 'vantra_marketing_consent=denied'; analytics.syncAnalyticsConsent();
  document.cookie = 'vantra_marketing_consent=granted'; analytics.syncAnalyticsConsent();
  assert.equal(calls.filter(call => call.method === 'capture' && call.args[0] === 'cta_click').length, 0);
});

test('direct private loads do not initialize; safe navigation cannot be blocked by analytics failures', async () => {
  const { analytics, calls, window, flush } = await browserFixture('', '/studio/chat');
  analytics.installAnalyticsNavigation(); await flush(); assert.equal(calls.length, 0);
  window.history.pushState(null, '', '/en'); await flush(); await flush();
  assert.equal(calls.filter(call => call.method === 'init').length, 1);
  const beforeSend = (calls.find(call => call.method === 'init')!.args[1] as { before_send: (event: unknown) => unknown }).before_send;
  window.history.pushState(null, '', '/admin');
  assert.equal(beforeSend({ event: '$autocapture', properties: { $current_url: 'https://joinvantra.com/en' } }), null);
  const last = calls.filter(call => call.method === 'set_config').at(-1)!.args[0] as Record<string, unknown>;
  assert.equal(last.autocapture, false); assert.equal(last.capture_heatmaps, false); assert.equal(last.capture_performance, false);
});

test('safe autocapture, heatmap and Web Vitals retain only public geometry/metrics, never text or attributes', () => {
  const base = { distinct_id: id, $current_url: 'https://joinvantra.com/en?fbclid=click_123', email: 'private' };
  const click = safePosthogWireEvent({ event: '$autocapture', properties: { ...base,
    $event_type: 'click', $elements_chain: 'private@email.test', $el_text: 'private',
    $elements: [{ tag_name: 'button', nth_child: 2, attr__value: 'secret', text: 'email', attr__href: '/?token=secret' }] } });
  assert.equal(click?.properties.$current_url, 'https://joinvantra.com/en');
  assert.deepEqual(click?.properties.$elements, [{ tag_name: 'button', nth_child: 2 }]);
  assert.ok(!JSON.stringify(click).includes('secret')); assert.ok(!JSON.stringify(click).includes('private'));
  const heatmap = safePosthogWireEvent({ event: '$$heatmap', properties: { ...base, $heatmap_data: {
    'https://joinvantra.com/en?fbclid=click_123': [{ x: 4, y: 5, type: 'click', target_fixed: true, email: 'private' }],
    'https://joinvantra.com/studio/chat': [{ x: 1, y: 1, type: 'click' }],
  } } });
  assert.deepEqual(heatmap?.properties.$heatmap_data, { 'https://joinvantra.com/en': [{ x: 4, y: 5, type: 'click', target_fixed: true }] });
  const vitals = safePosthogWireEvent({ event: '$web_vitals', properties: { ...base,
    $web_vitals_LCP_value: 1400, $web_vitals_LCP_event: { rating: 'good', entries: ['secret'], attribution: { url: 'private' } } } });
  assert.deepEqual(vitals?.properties.$web_vitals_LCP_event, { name: 'LCP', value: 1400, rating: 'good' });
});

test('replay errors/network are sanitized and unknown/custom plugins are dropped', () => {
  const network = { name: 'https://secret.test/?token=private', duration: 12, startTime: 3, status: 500, method: 'POST', requestBody: 'email', responseBody: 'secret', requestHeaders: { authorization: 'token' } };
  assert.deepEqual(safeReplayNetwork(network), { name: 'https://joinvantra.com/network/request', entryType: 'resource', duration: 12, startTime: 3, status: 500, method: 'POST' });
  const result = safePosthogWireEvent({ event: '$snapshot', properties: { distinct_id: id, $session_id: id, $window_id: id, $snapshot_data: [
    { type: 4, data: { href: 'https://joinvantra.com/en?fbclid=private' } },
    { type: 6, data: { plugin: 'rrweb/console@1', payload: { level: 'error', payload: ['private prompt'], trace: ['secret URL'] } } },
    { type: 6, data: { plugin: 'rrweb/network@1', payload: { requests: [network], private: 'secret' } } },
    { type: 6, data: { plugin: 'unknown', payload: 'secret' } },
    { type: 5, data: { tag: 'private', payload: 'secret' } },
  ] } });
  assert.equal((result?.properties.$snapshot_data as unknown[]).length, 3);
  const snapshots = result?.properties.$snapshot_data as { data: { payload: { requests: unknown[] } } }[];
  assert.deepEqual(snapshots[2].data.payload.requests, [safeReplayNetwork(network)]);
  assert.ok(!JSON.stringify(result).includes('private')); assert.ok(!JSON.stringify(result).includes('secret'));
});

test('EU same-origin proxy uses assets first and ingestion last, with no runtime function', async () => {
  const saved = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  try {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://eu.i.posthog.com';
    const { default: config } = await import('../../next.config.mjs');
    assert.deepEqual(await config.rewrites(), [
      { source: '/v-events/static/:path*', destination: 'https://eu-assets.i.posthog.com/static/:path*' },
      { source: '/v-events/array/:path*', destination: 'https://eu-assets.i.posthog.com/array/:path*' },
      { source: '/v-events/:path*', destination: 'https://eu.i.posthog.com/:path*' },
    ]);
  } finally { if (saved === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_HOST; else process.env.NEXT_PUBLIC_POSTHOG_HOST = saved; }
});

test('analytics proxy strips credentials/cookies/custom headers without changing ingestion content type', () => {
  const headers = safeAnalyticsProxyHeaders(new Headers({ cookie: 'secret', authorization: 'Bearer private',
    'x-api-key': 'secret', referer: 'https://joinvantra.com/?code=private', 'x-custom-token': 'secret',
    'content-type': 'application/json', accept: '*/*' }));
  assert.deepEqual([...headers], [['accept', '*/*'], ['content-type', 'application/json']]);
});
