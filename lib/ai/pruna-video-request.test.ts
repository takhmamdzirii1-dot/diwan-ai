import assert from 'node:assert/strict';
import test from 'node:test';
import type { VideoModelCapabilities } from '@/lib/models/capabilities';
import {
  prunaProviderCostMinor,
  validatePrunaVideoRequest,
  VideoRequestError,
} from './pruna-video-request';

const capabilities: VideoModelCapabilities = {
  textToVideo: true,
  imageToVideo: false,
  durations: [5, 10, 15],
  aspectRatios: ['16:9', '9:16'],
  cameraMotions: [],
  generatedAudio: false,
  negativePrompt: false,
};

test('accepts only the supported Pruna text-to-video contract', () => {
  assert.deepEqual(validatePrunaVideoRequest({
    prompt: 'A quiet monochrome product shot',
    modelId: 'vantra-p-video-2-pro',
    duration: 5,
    aspectRatio: '16:9',
    resolution: '480p',
    mode: 'speed',
  }, capabilities), {
    prompt: 'A quiet monochrome product shot',
    modelId: 'vantra-p-video-2-pro',
    sourceMode: 'text',
    duration: 5,
    aspectRatio: '16:9',
    resolution: '480p',
    mode: 'speed',
  });
  assert.equal(prunaProviderCostMinor({ duration: 5, resolution: '480p', mode: 'speed' }), 10);
  assert.equal(prunaProviderCostMinor({ duration: 5, resolution: '768p', mode: 'speed' }), null);
});

test('accepts image-to-video only with a valid source and omits aspect ratio', () => {
  const sourceImage = new File([new Uint8Array([1, 2, 3])], 'source.png', {
    type: 'image/png',
  });
  const result = validatePrunaVideoRequest({
    prompt: 'Bring this still frame to life',
    modelId: 'vantra-p-video-2-pro',
    sourceMode: 'image',
    duration: 5,
    resolution: '480p',
    mode: 'speed',
  }, { ...capabilities, imageToVideo: true }, sourceImage);
  assert.equal(result.sourceMode, 'image');
  assert.equal(result.sourceImage, sourceImage);
  assert.equal(result.aspectRatio, undefined);
  assert.equal(result.endImage, undefined);
  assert.throws(
    () => validatePrunaVideoRequest({
      prompt: 'Bring this still frame to life',
      modelId: 'vantra-p-video-2-pro',
      sourceMode: 'image',
      aspectRatio: '16:9',
    }, { ...capabilities, imageToVideo: true }, sourceImage),
    (error) => error instanceof VideoRequestError && error.code === 'UNSUPPORTED_VIDEO_PARAMETER'
  );
});

test('accepts an optional valid I2V end frame', () => {
  const sourceImage = new File([new Uint8Array([1])], 'start.png', { type: 'image/png' });
  const endImage = new File([new Uint8Array([2])], 'end.webp', { type: 'image/webp' });
  const result = validatePrunaVideoRequest({
    prompt: 'Move between these two frames',
    modelId: 'vantra-p-video-2-pro',
    sourceMode: 'image',
    duration: 5,
    resolution: '768p',
    mode: 'quality',
  }, { ...capabilities, imageToVideo: true }, sourceImage, endImage);
  assert.equal(result.sourceImage, sourceImage);
  assert.equal(result.endImage, endImage);
  assert.equal(result.aspectRatio, undefined);
});

test('requires an allowlisted source image for image-to-video', () => {
  assert.throws(
    () => validatePrunaVideoRequest({
      prompt: 'Bring this still frame to life',
      modelId: 'vantra-p-video-2-pro',
      sourceMode: 'image',
    }, { ...capabilities, imageToVideo: true }),
    (error) => error instanceof VideoRequestError && error.code === 'INVALID_SOURCE_IMAGE'
  );
  assert.throws(
    () => validatePrunaVideoRequest({
      prompt: 'Bring this still frame to life',
      modelId: 'vantra-p-video-2-pro',
      sourceMode: 'image',
    }, { ...capabilities, imageToVideo: true }, new File(['no'], 'source.svg', {
      type: 'image/svg+xml',
    })),
    (error) => error instanceof VideoRequestError && error.code === 'INVALID_SOURCE_IMAGE'
  );
  assert.throws(
    () => validatePrunaVideoRequest({
      prompt: 'Bring this still frame to life',
      modelId: 'vantra-p-video-2-pro',
      sourceMode: 'image',
    }, { ...capabilities, imageToVideo: true }, new File(['ok'], 'start.png', {
      type: 'image/png',
    }), new File(['no'], 'end.svg', { type: 'image/svg+xml' })),
    (error) => error instanceof VideoRequestError && error.code === 'INVALID_END_IMAGE'
  );
});

test('rejects image, negative prompt, camera motion, and unsupported controls', () => {
  for (const parameter of ['image', 'referenceFile', 'negativePrompt', 'cameraMotion']) {
    assert.throws(
      () => validatePrunaVideoRequest({
        prompt: 'A test', modelId: 'vantra-p-video-2-pro', [parameter]: 'not-allowed',
      }, capabilities),
      (error) => error instanceof VideoRequestError && error.code === 'UNSUPPORTED_VIDEO_PARAMETER'
    );
  }
});

test('fails closed for disabled text-to-video or unsupported values', () => {
  assert.throws(
    () => validatePrunaVideoRequest({ prompt: 'A test', modelId: 'vantra-p-video-2-pro' }, {
      ...capabilities, textToVideo: false,
    }),
    (error) => error instanceof VideoRequestError && error.code === 'MODEL_CAPABILITY_UNSUPPORTED'
  );
  assert.throws(
    () => validatePrunaVideoRequest({
      prompt: 'A test', modelId: 'vantra-p-video-2-pro', duration: 6,
    }, capabilities),
    (error) => error instanceof VideoRequestError && error.code === 'UNSUPPORTED_VIDEO_DURATION'
  );
});
