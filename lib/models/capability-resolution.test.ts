import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyModelCapabilities, normalizeModelSurfaceVisibility, type VideoModelCapabilities } from './capabilities';
import { resolveCapabilityPriority } from './capability-resolution';
import { videoControlProfile, videoSourceModes } from './video-control-profile';
import { defaultModelPlanAccess } from './model-access';

const saved: VideoModelCapabilities = {
  textToVideo: true, imageToVideo: false, durations: [5], aspectRatios: ['16:9'],
  cameraMotions: [], generatedAudio: false, negativePrompt: false,
};

test('Admin override wins over provider metadata and adapter inference', () => {
  const result = resolveCapabilityPriority({ modality: 'video', saved, savedSource: 'admin_override',
    providerMetadata: { imageToVideo: true }, adapterInferred: { imageToVideo: true },
    now: '2026-09-24T00:00:00Z' });
  assert.equal(result.capabilities, saved);
  assert.equal(result.sourceType, 'admin_override');
  assert.equal(result.confidence, 'manual');
});

test('provider metadata outranks adapter evidence; unknown and invalid evidence fail closed', () => {
  const provider = resolveCapabilityPriority({ modality: 'video', saved, savedSource: 'unknown',
    providerMetadata: { imageToVideo: true }, adapterInferred: { imageToVideo: false } });
  assert.equal((provider.capabilities as VideoModelCapabilities).imageToVideo, true);
  assert.equal(provider.sourceType, 'provider_metadata');
  const unknown = resolveCapabilityPriority({ modality: 'video', saved, savedSource: 'unknown' });
  assert.deepEqual(unknown.capabilities, emptyModelCapabilities('video'));
  assert.equal(unknown.syncStatus, 'partial');
  const malformed = resolveCapabilityPriority({ modality: 'video', saved, savedSource: 'unknown',
    providerMetadata: { durations: [999] as unknown as VideoModelCapabilities['durations'] } });
  assert.deepEqual(malformed.capabilities, emptyModelCapabilities('video'));
  assert.equal(malformed.syncStatus, 'failed');
});

test('previously evidenced capabilities remain fail-safe when a later sync has no response', () => {
  const previous = resolveCapabilityPriority({ modality: 'video', saved, savedSource: 'provider_metadata' });
  assert.equal(previous.capabilities, saved);
  assert.equal(previous.confidence, 'verified');
  assert.equal(previous.syncStatus, 'partial');
});

test('unknown capability hides video modes and controls; visibility does not change plan access', () => {
  const unknown = emptyModelCapabilities('video') as VideoModelCapabilities;
  const visibility = normalizeModelSurfaceVisibility('video', { textToVideo: true, imageToVideo: true });
  assert.deepEqual(videoSourceModes(unknown, visibility), []);
  assert.deepEqual(videoControlProfile(unknown, 'image').resolutions, []);
  const access = defaultModelPlanAccess('Kling 3.0 Pro', 'video', []);
  assert.equal(access.free.state, 'locked');
  assert.deepEqual(videoSourceModes({ ...saved, imageToVideo: true }, { ...visibility, textToVideo: false }), ['image']);
  assert.equal(access.free.state, 'locked');
});

test('I2V controls appear only when their own capability values are known', () => {
  const i2v = videoControlProfile({ ...saved, imageToVideo: true, endImage: true,
    imageToVideoResolutions: ['768p'], imageToVideoGenerationModes: ['quality'] }, 'image');
  assert.equal(i2v.startImage, true);
  assert.equal(i2v.endImage, true);
  assert.deepEqual(i2v.resolutions, ['768p']);
  assert.deepEqual(i2v.generationModes, ['quality']);
  assert.deepEqual(i2v.aspectRatios, []);
  assert.deepEqual(videoControlProfile(saved, 'text').resolutions, []);
});
