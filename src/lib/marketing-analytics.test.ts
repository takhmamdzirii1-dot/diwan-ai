import assert from 'node:assert/strict';
import test from 'node:test';
import { captureLandingAttribution, readAttribution } from './attribution';
import { flushMarketingEvents, trackLandingEvent, trackMarketingPixel, markMarketingInteraction } from './marketing-analytics';

test('first touch persists fbclid/UTM, landing events batch with beacon, absent Meta config never loads scripts', () => {
  const original = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage,
    navigator: globalThis.navigator, pixel: process.env.NEXT_PUBLIC_META_PIXEL_ID };
  const stored = new Map<string, string>(); const payloads: Blob[] = [];
  try {
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    } });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { search: '?utm_source=Meta&fbclid=FIRST' }, addEventListener() {} } });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { addEventListener() {}, createElement() { throw new Error('unexpected script'); } } });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { sendBeacon: (path: string, body: Blob) => {
      assert.equal(path, '/api/analytics/landing'); payloads.push(body); return true;
    } } });
    captureLandingAttribution('all-ai');
    globalThis.window.location.search = '?utm_source=Other&fbclid=SECOND';
    captureLandingAttribution('home');
    assert.equal(readAttribution()?.fbclid, 'FIRST'); assert.equal(readAttribution()?.utm_source, 'Meta');
    trackLandingEvent({ event: 'landing_view', variant: 'all-ai', locale: 'ar' });
    trackLandingEvent({ event: 'cta_click', variant: 'all-ai', locale: 'ar', location: 'hero' });
    flushMarketingEvents();
    assert.equal(payloads.length, 1);
    return payloads[0].text().then(text => {
      const batch = JSON.parse(text); assert.equal(batch.events.length, 2); assert.equal(batch.acquisition.fbclid, 'FIRST');
    });
  } finally {
    for (const key of ['window', 'document', 'localStorage', 'navigator'] as const) Object.defineProperty(globalThis, key, { configurable: true, value: original[key] });
    if (original.pixel === undefined) delete process.env.NEXT_PUBLIC_META_PIXEL_ID; else process.env.NEXT_PUBLIC_META_PIXEL_ID = original.pixel;
  }
});

test('configured Pixel still waits for consent and interaction; repeated event IDs do not double-send', () => {
  const original = { window: globalThis.window, document: globalThis.document, pixel: process.env.NEXT_PUBLIC_META_PIXEL_ID };
  const scripts: { src: string }[] = [];
  try {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = '123456';
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {} } });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: '', addEventListener() {},
      createElement: () => ({}), head: { appendChild: (script: { src: string }) => scripts.push(script) } } });
    trackMarketingPixel('landing_view', 'fixture-page');
    assert.equal(scripts.length, 0);
    globalThis.document.cookie = 'vantra_marketing_consent=granted';
    trackMarketingPixel('cta_click', 'fixture-cta');
    assert.equal(scripts.length, 0, 'consent without interaction must not load a script');
    markMarketingInteraction();
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].src, 'https://connect.facebook.net/en_US/fbevents.js');
    const pixel = (globalThis.window as Window & { fbq?: { queue: unknown[][] } }).fbq;
    assert.ok(pixel);
    const length = pixel.queue.length;
    trackMarketingPixel('cta_click', 'fixture-cta');
    assert.equal(pixel.queue.length, length);
  } finally {
    for (const key of ['window', 'document'] as const) Object.defineProperty(globalThis, key, { configurable: true, value: original[key] });
    if (original.pixel === undefined) delete process.env.NEXT_PUBLIC_META_PIXEL_ID; else process.env.NEXT_PUBLIC_META_PIXEL_ID = original.pixel;
  }
});
