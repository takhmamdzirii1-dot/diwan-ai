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
import { defaultModelSurfaceVisibility, type VideoModelCapabilities } from './capabilities';

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
  assert.match(html, /Source: unknown/);
});
