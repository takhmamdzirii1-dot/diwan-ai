import assert from 'node:assert/strict';
import test from 'node:test';
import { isStudioMediaRouteSupported } from './media-route-support';
test('Studio offers only routes actually executed by its media endpoint, without altering Chat routes', () => {
  assert.equal(isStudioMediaRouteSupported('image', 'microsoft_foundry'), true);
  assert.equal(isStudioMediaRouteSupported('image', 'vercel_ai_gateway'), false);
  assert.equal(isStudioMediaRouteSupported('video', 'pruna_ai'), true);
  assert.equal(isStudioMediaRouteSupported('video', 'unsupported'), false);
  assert.equal(isStudioMediaRouteSupported('chat', 'future-chat-provider'), true);
});
