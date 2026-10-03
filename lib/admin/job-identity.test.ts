import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJobPage, jobCursor, legacyJobPage } from './job-identity';

test('Library result with the same full UUID is one execution row with its provider, usage and attempts', () => {
  const job = { id: 'same-full-uuid', source: 'execution', createdAt: '2026-10-03T00:00:00Z', provider: 'provider', usage: 15, attempts: ['first', 'second'] };
  const page = canonicalJobPage([job], [{ ...job, source: 'generation', provider: '', usage: 0, attempts: [] }]);
  assert.deepEqual(page.jobs, [job]);
});
test('matching abbreviated IDs are NOT deduplicated when full identities differ', () => {
  const page = canonicalJobPage([{ id: 'abcdef00-one', source: 'execution', createdAt: '2026-10-03' }], [{ id: 'abcdef00-two', source: 'generation', createdAt: '2026-10-03' }]);
  assert.equal(page.jobs.length, 2);
});
test('canonical identity lookup excludes overlapping records outside the filtered page, preserves orphans, and counts every batch', async () => {
  const ids = Array.from({ length: 215 }, (_, index) => String(index));
  const page = await legacyJobPage(async (offset, size) => ids.slice(offset, offset + size), async batch => batch.filter(id => Number(id) % 2 === 0));
  assert.equal(page.count, 107); assert.equal(page.ids.length, 51);
  assert.deepEqual(page.ids.slice(0, 3), ['1', '3', '5']);
});
test('pagination has no timestamp-tie skip and supports historical timestamp-only cursors', () => {
  const rows = Array.from({ length: 51 }, (_, index) => ({ id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`, source: 'execution', createdAt: '2026-10-03T00:00:00Z' }));
  const first = canonicalJobPage(rows, []);
  const cursor = jobCursor(first.nextCursor!);
  assert.equal(first.jobs.length, 50); assert.equal(cursor!.id, rows[1].id);
  const next = rows.filter(row => row.id < cursor!.id!);
  assert.equal(canonicalJobPage(next, []).jobs[0].id, rows[0].id);
  assert.equal(jobCursor('2026-10-03T00:00:00Z')?.id, null);
  assert.equal(jobCursor('invalid'), null);
});
