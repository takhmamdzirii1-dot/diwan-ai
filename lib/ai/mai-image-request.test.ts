import assert from 'node:assert/strict';
import test from 'node:test';
import type { ImageModelCapabilities } from '@/lib/models/capabilities';
import { ImageRequestError, validateMaiImageRequest } from './mai-image-request';

const capabilities: ImageModelCapabilities = {
  textToImage: true,
  referenceImage: false,
  aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
  maxOutputs: 1,
  negativePrompt: false,
};

test('maps supported aspect ratios to valid MAI dimensions', () => {
  const landscape = validateMaiImageRequest({
    prompt: 'A quiet monochrome studio', modelId: 'vantra-mai-image-2.6-flash', aspectRatio: '16:9',
  }, capabilities);
  assert.deepEqual(
    { width: landscape.width, height: landscape.height },
    { width: 1344, height: 768 }
  );
  assert.ok(landscape.width * landscape.height <= 1_048_576);
  assert.ok(landscape.width >= 768 && landscape.height >= 768);
});
test('rejects options the selected model does not support', () => {
  assert.throws(
    () => validateMaiImageRequest({
      prompt: 'A test', modelId: 'vantra-mai-image-2.6-flash', aspectRatio: '1:1', negativePrompt: 'text',
    }, capabilities),
    (error) => error instanceof ImageRequestError && error.code === 'UNSUPPORTED_IMAGE_PARAMETER'
  );
  assert.throws(
    () => validateMaiImageRequest({
      prompt: 'A test', modelId: 'vantra-mai-image-2.6-flash', aspectRatio: '1:1', outputCount: 2,
    }, capabilities),
    (error) => error instanceof ImageRequestError && error.code === 'UNSUPPORTED_OUTPUT_COUNT'
  );
});

test('fails closed when text-to-image or an aspect ratio is unsupported', () => {
  assert.throws(
    () => validateMaiImageRequest({ prompt: 'A test', modelId: 'model', aspectRatio: '16:9' }, {
      ...capabilities, textToImage: false,
    }),
    (error) => error instanceof ImageRequestError && error.code === 'MODEL_CAPABILITY_UNSUPPORTED'
  );
  assert.throws(
    () => validateMaiImageRequest({ prompt: 'A test', modelId: 'model', aspectRatio: '9:16' }, {
      ...capabilities, aspectRatios: ['1:1'],
    }),
    (error) => error instanceof ImageRequestError && error.code === 'UNSUPPORTED_ASPECT_RATIO'
  );
});
