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
    duration: 5,
    aspectRatio: '16:9',
    resolution: '480p',
    mode: 'speed',
  });
  assert.equal(prunaProviderCostMinor({ duration: 5, resolution: '480p', mode: 'speed' }), 10);
  assert.equal(prunaProviderCostMinor({ duration: 5, resolution: '768p', mode: 'speed' }), null);
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
