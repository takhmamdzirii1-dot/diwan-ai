import assert from 'node:assert/strict';
import test from 'node:test';
import { uniqueVisibleModels } from './model-picker-options';

test('picker removes duplicate identities but preserves distinct models with the same display name', () => {
  const first = { id: 'a', name: 'Same name', enabled: true, availability: 'available' };
  const second = { ...first, id: 'b' };
  assert.deepEqual(uniqueVisibleModels([first, first, second]), [first, second]);
});

test('locked and trial models remain visible; disabled and unavailable models remain excluded', () => {
  const base = { enabled: true, availability: 'available' };
  const locked = { ...base, id: 'locked', accessState: 'locked' };
  const trial = { ...base, id: 'trial', accessState: 'trial', availability: 'beta' };
  assert.deepEqual(uniqueVisibleModels([locked, trial,
    { ...base, id: 'disabled', enabled: false },
    { ...base, id: 'unavailable', availability: 'unavailable' }]), [locked, trial]);
});
