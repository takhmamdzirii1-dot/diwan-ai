import assert from 'node:assert/strict';
import test from 'node:test';
import { railPreviewFor } from './MediaResultRail';

test('captured thumbnail wins when present', () => {
  assert.deepEqual(
    railPreviewFor({ src: '/api/library/media/1', thumbnail: 'data:image/webp;base64,AAA' }),
    { kind: 'thumbnail', url: 'data:image/webp;base64,AAA' }
  );
});

test('authorized asset URL renders when no thumbnail was captured', () => {
  assert.deepEqual(
    railPreviewFor({ src: '/api/library/media/1', thumbnail: null }),
    { kind: 'src', url: '/api/library/media/1' }
  );
});

test('generic icon is the last resort only', () => {
  assert.deepEqual(railPreviewFor({ src: '', thumbnail: null }), { kind: 'icon' });
  assert.deepEqual(railPreviewFor({}), { kind: 'icon' });
});
