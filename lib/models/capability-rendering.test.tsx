import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import studioMessages from '../../messages/studio-en.json';
import adminMessages from '../../messages/admin-en.json';
import PrunaMotionStudio from '@/src/components/studio/PrunaMotionStudio';
import AdminModelCapabilitiesControls from '@/src/components/admin/AdminModelCapabilitiesControls';
import type { StudioRuntimeModelDefinition } from '@/src/config/studio-registry';
import { defaultModelSurfaceVisibility, type ChatModelCapabilities, type VideoModelCapabilities } from './capabilities';

const baseCapabilities: VideoModelCapabilities = {
  textToVideo: true, imageToVideo: false, durations: [5], aspectRatios: ['16:9'],
  cameraMotions: [], generatedAudio: false, negativePrompt: false,
  resolutions: ['480p'], generationModes: ['speed'],
};
const model: StudioRuntimeModelDefinition = {
  id: 'vantra-p-video-2-pro', displayName: 'P-Video-2 Pro', provider: 'VANTRA', modality: 'video',
  enabled: true, availability: 'available', verifiedCapabilities: [], verifiedCreditCost: 1,
  supportedControls: [], fallbackAvailable: false, displayOrder: 1,
  allowedPlans: ['pro'], capabilities: baseCapabilities,
  surfaceVisibility: defaultModelSurfaceVisibility('video'),
};

function renderStudio(selected: StudioRuntimeModelDefinition) {
  return renderToStaticMarkup(<NextIntlClientProvider locale="en" messages={studioMessages}>
    <PrunaMotionStudio models={[selected]} onGenerate={async () => { throw new Error('NOT_CALLED'); }} />
  </NextIntlClientProvider>);
}

test('Studio renders supported controls and hides unsupported I2V controls', () => {
  const textOnly = renderStudio(model);
  assert.match(textOnly, /480p/);
  assert.doesNotMatch(textOnly, /Start image/i);
  assert.doesNotMatch(textOnly, /768p/);
  const imageOnly = renderStudio({ ...model, capabilities: {
    ...baseCapabilities, textToVideo: false, imageToVideo: true,
    imageToVideoResolutions: ['768p'], imageToVideoGenerationModes: ['quality'],
  } });
  assert.match(imageOnly, /768p/);
  assert.doesNotMatch(imageOnly, /480p/);
});

test('Admin renders provenance, sync and context visibility controls', () => {
  const html = renderToStaticMarkup(<NextIntlClientProvider locale="en" messages={adminMessages}>
    <AdminModelCapabilitiesControls model={{
      key: 'vantra:video:p-video-2-pro', modality: 'video', capabilities: baseCapabilities,
      surfaceVisibility: defaultModelSurfaceVisibility('video'),
      capabilitySourceType: 'unknown', capabilityConfidence: 'unknown',
      capabilitySyncStatus: 'partial', capabilitySyncError: null, capabilityLastSyncedAt: null,
    }} onSaved={() => undefined} />
  </NextIntlClientProvider>);
  assert.match(html, /Sync now/);
  assert.match(html, /Show in Image to Video/);
  assert.match(html, /Source: No verified source yet/);
});

test('Admin capability page renders Models.dev evidence without a catalog refresh', () => {
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = (async () => { fetches++; throw new Error('PAGE_LOAD_FETCH'); }) as typeof fetch;
  try {
    const caps: ChatModelCapabilities = { streaming: true, visionInput: false, fileInput: false, tools: false };
    const html = renderToStaticMarkup(<NextIntlClientProvider locale="en" messages={adminMessages}>
      <AdminModelCapabilitiesControls model={{
        key: 'vantra:chat:agnes-3.0-flash', modality: 'chat', capabilities: caps,
        surfaceVisibility: defaultModelSurfaceVisibility('chat'),
        capabilitySourceType: 'unknown', capabilityConfidence: 'unknown', capabilitySyncStatus: 'partial',
        capabilitySyncError: 'Provider metadata is unavailable. Models.dev catalog evidence is being used.',
        capabilityLastSyncedAt: '2026-09-25T00:00:00Z',
        routes: [{ id: 'route-1', providerId: 'agnes', providerModelId: 'agnes-3.0-flash', enabled: true, configured: true, providerEnabled: true, priority: 1, fallback: false }],
        routeCapabilitiesV2: { 'route-1': { providerId: 'agnes', providerModelId: 'agnes-3.0-flash', evidence: {
          visionInput: { state: 'supported', source: 'models_dev', checkedAt: '2026-09-25T00:00:00Z' },
        }, overrides: {} } },
      }} onSaved={() => undefined} />
    </NextIntlClientProvider>);
    assert.equal(fetches, 0);
    assert.match(html, /Source: Models.dev/);
    assert.match(html, /Provider metadata is unavailable. Models.dev catalog evidence is being used/);
    assert.match(html, /Vision \/ image input/);
    assert.match(html, /Supported/);
    assert.match(html, /Unknown/);
    assert.match(html, /Native file input/);
    assert.match(html, /VANTRA capabilities/);
    assert.match(html, /Advanced overrides and technical details/);
    assert.equal((html.match(/type="checkbox"/g) ?? []).length, 1, 'only Studio visibility remains a checkbox');
    assert.equal((html.match(/<option value="auto"/g) ?? []).length, 6);
    assert.equal((html.match(/<option value="force_enabled"/g) ?? []).length, 6);
    assert.equal((html.match(/<option value="force_disabled"/g) ?? []).length, 6);
  } finally { globalThis.fetch = originalFetch; }
});
