import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyModelCapabilities, normalizeModelSurfaceVisibility } from './capabilities';
import { isStudioCatalogVisible, isStudioRuntimeReady, type StudioVisibilityCandidate } from './studio-model-visibility';

function candidate(modality: StudioVisibilityCandidate['modality']): StudioVisibilityCandidate {
  return {
    modality,
    enabled: true,
    archived: false,
    visibleInStudio: true,
    surfaceVisibility: normalizeModelSurfaceVisibility(modality, null),
    capabilities: emptyModelCapabilities(modality),
  };
}

test('enabled visible Chat models appear without media capability requirements', () => {
  const model = candidate('chat');
  assert.equal(isStudioCatalogVisible(model), true);
  assert.equal(isStudioRuntimeReady({ ...model, customerCreditPrice: 5 }, true), true);
});

test('legacy empty surface visibility defaults Chat to visible', () => {
  const model = { ...candidate('chat'), surfaceVisibility: normalizeModelSurfaceVisibility('chat', {}) };
  assert.equal(model.surfaceVisibility.chat, true);
  assert.equal(isStudioCatalogVisible(model), true);
});

test('plan-locked Chat models remain in the Studio catalog', () => {
  const model = { ...candidate('chat'), accessState: 'locked' as const };
  assert.equal(isStudioCatalogVisible(model), true);
});

test('explicitly hidden, disabled, or archived Chat models do not appear', () => {
  const model = candidate('chat');
  assert.equal(isStudioCatalogVisible({ ...model, surfaceVisibility: { ...model.surfaceVisibility, chat: false } }), false);
  assert.equal(isStudioCatalogVisible({ ...model, visibleInStudio: false }), false);
  assert.equal(isStudioCatalogVisible({ ...model, enabled: false }), false);
  assert.equal(isStudioCatalogVisible({ ...model, archived: true }), false);
});

test('Image and Video visibility rules remain capability-aware and unchanged', () => {
  const image = candidate('image');
  assert.equal(isStudioCatalogVisible(image), true);

  const video = candidate('video');
  assert.equal(isStudioCatalogVisible(video), false);
  assert.equal(isStudioCatalogVisible({
    ...video,
    capabilities: { ...video.capabilities, textToVideo: true },
  }), true);
});
