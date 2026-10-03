import assert from 'node:assert/strict';
import test from 'node:test';
import { submitMedia } from './media-submission';
import { rememberMediaOperation, rememberedMediaOperations } from './media-operation-memory';
import type { MediaStatus } from '@/lib/ai/media-recovery';
const initial: MediaStatus = { executionId: '00000000-0000-0000-0000-000000000001', modality: 'image', state: 'queued', creditsCharged: 0, creditsReleased: false, timeout: false, retryAfterMs: 5000 };

test('consecutive success/failure/success is not a latched client failure; genuine HTTP quota errors remain intact', async () => {
  const previous = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => ++calls === 2 ? Response.json({ error: 'PROVIDER_QUOTA_EXHAUSTED' }, { status: 429 }) : Response.json({ image: { src: '/private' } });
  try {
    assert.equal((await submitMedia('/image', { method: 'POST' }, initial, () => {})).status, 200);
    assert.deepEqual(await (await submitMedia('/image', { method: 'POST' }, initial, () => {})).json(), { error: 'PROVIDER_QUOTA_EXHAUSTED' });
    assert.equal((await submitMedia('/image', { method: 'POST' }, initial, () => {})).status, 200);
    assert.equal(calls, 3);
  } finally { globalThis.fetch = previous; }
});
test('lost response reattaches to owned operation; never submits or charges again', async () => {
  const previous = globalThis.fetch; const requests: Array<{ url: string; method?: string }> = []; const updates: MediaStatus[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), method: init?.method });
    if (init?.method === 'POST') throw new TypeError('Disconnected');
    return Response.json({ ...initial, state: 'completed', creditsCharged: 15, result: { src: '/private', mimeType: 'image/png', libraryAssetId: 'existing' } });
  };
  try {
    const result = await submitMedia('/image', { method: 'POST' }, initial, status => updates.push(status));
    assert.equal((await result.json()).libraryAssetId, 'existing'); assert.equal(updates[0].state, 'completed');
    assert.equal(requests.filter(request => request.method === 'POST').length, 1);
    assert.match(requests[1].url, /operationId=/);
  } finally { globalThis.fetch = previous; }
});
test('an unknown recovery outcome never claims a confirmed credit release', async () => {
  const previous = globalThis.fetch; const updates: MediaStatus[] = [];
  globalThis.fetch = async (_input, init) => { if (init?.method === 'POST') throw new TypeError('Disconnected'); return Response.json({}, { status: 503 }); };
  try { await assert.rejects(submitMedia('/image', { method: 'POST' }, initial, status => updates.push(status))); assert.equal(updates[0].creditsReleased, false); assert.equal(updates[0].error, 'MEDIA_STATUS_UNAVAILABLE'); }
  finally { globalThis.fetch = previous; }
});
test('opaque operation memory is account-isolated and contains no prompts, credentials, or trusted result', () => {
  const saved = new Map<string, string>();
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => saved.get(key), setItem: (key: string, value: string) => saved.set(key, value) } });
  try { rememberMediaOperation('owner', 'image', initial.executionId); assert.deepEqual(rememberedMediaOperations('other'), []); assert.deepEqual(rememberedMediaOperations('owner'), [initial.executionId]); assert.deepEqual([...saved.values()], [initial.executionId]); }
  finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous }); }
});
