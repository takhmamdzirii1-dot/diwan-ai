import assert from 'node:assert/strict';
import test from 'node:test';
import { positionModelPicker } from './model-picker-position';

test('Video picker opens above the model control so it does not cover Duration and Resolution', () => {
  const anchor = positionModelPicker({ top: 460, bottom: 500, left: 280 }, 1440, 900, 'top');
  assert.equal(anchor.top, undefined);
  assert.ok(anchor.bottom !== undefined);
  assert.ok(anchor.height <= 540);
  assert.ok(900 - anchor.bottom < 460);
});

test('picker uses the space below when the trigger is near the top', () => {
  const anchor = positionModelPicker({ top: 80, bottom: 120, left: 100 }, 1024, 768, 'top');
  assert.equal(anchor.top, 128);
  assert.ok(anchor.height <= 768 - 128 - 16);
});

test('picker stays inside the viewport and scrolls internally on a short desktop', () => {
  const anchor = positionModelPicker({ top: 220, bottom: 260, left: 900 }, 1024, 500, 'top');
  assert.equal(anchor.left, 600);
  assert.ok(anchor.height <= 540);
  if (anchor.bottom !== undefined) assert.ok(anchor.height <= 500 - anchor.bottom - 16);
  if (anchor.top !== undefined) assert.ok(anchor.height <= 500 - anchor.top - 16);
});
