import assert from 'node:assert/strict';
import test from 'node:test';
import type { ResolvedProviderRoute } from './routes';
import { submitPrunaVideoRoute } from './media';

const route: ResolvedProviderRoute = {
  id: 'route-pruna-video',
  modelKey: 'vantra:video:p-video-2-pro',
  modelId: 'vantra-p-video-2-pro',
  modality: 'video',
  providerId: 'pruna_ai',
  providerModelId: 'p-video-2-pro',
  priority: 0,
  fallback: false,
};

test('Pruna I2V uploads the source and omits aspect_ratio from prediction input', {
  concurrency: false,
}, async (context) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.PRUNA_API_KEY;
  const originalBaseUrl = process.env.PRUNA_BASE_URL;
  process.env.PRUNA_API_KEY = 'test-key';
  process.env.PRUNA_BASE_URL = 'https://api.pruna.test/v1';
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey == null) delete process.env.PRUNA_API_KEY;
    else process.env.PRUNA_API_KEY = originalKey;
    if (originalBaseUrl == null) delete process.env.PRUNA_BASE_URL;
    else process.env.PRUNA_BASE_URL = originalBaseUrl;
  });

  let call = 0;
  globalThis.fetch = async (input, init) => {
    call += 1;
    const url = String(input);
    assert.equal(init?.headers && (init.headers as Record<string, string>).apikey, 'test-key');
    if (call === 1) {
      assert.equal(url, 'https://api.pruna.test/v1/files');
      assert.equal(init?.method, 'POST');
      assert.ok(init?.body instanceof FormData);
      const uploaded = init.body.get('file');
      assert.ok(uploaded instanceof File);
      assert.equal(uploaded.name, 'start.png');
      assert.equal(uploaded.type, 'image/png');
      return Response.json({ file: { url: 'pruna-file://source-1' } });
    }

    assert.equal(url, 'https://api.pruna.test/v1/predictions');
    const body = JSON.parse(String(init?.body)) as { input: Record<string, unknown> };
    assert.equal(body.input.image, 'pruna-file://source-1');
    assert.equal('last_frame_image' in body.input, false);
    assert.equal('aspect_ratio' in body.input, false);
    return Response.json({ id: 'prediction-1', status: 'queued' });
  };

  const result = await submitPrunaVideoRoute(route, {
    prompt: 'Animate this frame',
    duration: 5,
    resolution: '480p',
    mode: 'speed',
    sourceMode: 'image',
    sourceImage: new File([new Uint8Array([1, 2, 3])], 'unsafe-name.png', {
      type: 'image/png',
    }),
  });

  assert.equal(call, 2);
  assert.equal(result.providerOperationId, 'prediction-1');
  assert.equal(result.state, 'queued');
});

test('Pruna I2V uploads an optional end frame and includes last_frame_image', {
  concurrency: false,
}, async (context) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.PRUNA_API_KEY;
  const originalBaseUrl = process.env.PRUNA_BASE_URL;
  process.env.PRUNA_API_KEY = 'test-key';
  process.env.PRUNA_BASE_URL = 'https://api.pruna.test/v1';
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey == null) delete process.env.PRUNA_API_KEY;
    else process.env.PRUNA_API_KEY = originalKey;
    if (originalBaseUrl == null) delete process.env.PRUNA_BASE_URL;
    else process.env.PRUNA_BASE_URL = originalBaseUrl;
  });

  let call = 0;
  globalThis.fetch = async (input, init) => {
    call += 1;
    const url = String(input);
    if (call <= 2) {
      assert.equal(url, 'https://api.pruna.test/v1/files');
      assert.ok(init?.body instanceof FormData);
      const uploaded = init.body.get('file');
      assert.ok(uploaded instanceof File);
      assert.equal(uploaded.name, call === 1 ? 'start.png' : 'end.webp');
      return Response.json({ file: { url: `pruna-file://frame-${call}` } });
    }

    assert.equal(url, 'https://api.pruna.test/v1/predictions');
    const body = JSON.parse(String(init?.body)) as { input: Record<string, unknown> };
    assert.equal(body.input.image, 'pruna-file://frame-1');
    assert.equal(body.input.last_frame_image, 'pruna-file://frame-2');
    assert.equal('aspect_ratio' in body.input, false);
    return Response.json({ id: 'prediction-end-frame', status: 'queued' });
  };

  const result = await submitPrunaVideoRoute(route, {
    prompt: 'Move between these frames',
    duration: 5,
    resolution: '768p',
    mode: 'quality',
    sourceMode: 'image',
    sourceImage: new File([new Uint8Array([1])], 'start.png', { type: 'image/png' }),
    endImage: new File([new Uint8Array([2])], 'end.webp', { type: 'image/webp' }),
  });

  assert.equal(call, 3);
  assert.equal(result.providerOperationId, 'prediction-end-frame');
});

test('Pruna T2V keeps the existing single prediction request shape', {
  concurrency: false,
}, async (context) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.PRUNA_API_KEY;
  const originalBaseUrl = process.env.PRUNA_BASE_URL;
  process.env.PRUNA_API_KEY = 'test-key';
  process.env.PRUNA_BASE_URL = 'https://api.pruna.test/v1';
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey == null) delete process.env.PRUNA_API_KEY;
    else process.env.PRUNA_API_KEY = originalKey;
    if (originalBaseUrl == null) delete process.env.PRUNA_BASE_URL;
    else process.env.PRUNA_BASE_URL = originalBaseUrl;
  });

  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'https://api.pruna.test/v1/predictions');
    const body = JSON.parse(String(init?.body)) as { input: Record<string, unknown> };
    assert.equal(body.input.aspect_ratio, '16:9');
    assert.equal('image' in body.input, false);
    return Response.json({ id: 'prediction-2', status: 'queued' });
  };

  const result = await submitPrunaVideoRoute(route, {
    prompt: 'Create a new scene',
    duration: 5,
    resolution: '480p',
    mode: 'speed',
    aspectRatio: '16:9',
    sourceMode: 'text',
  });

  assert.equal(result.providerOperationId, 'prediction-2');
});
