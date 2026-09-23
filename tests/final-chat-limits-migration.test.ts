import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL('../supabase/migrations/20260923020000_final_chat_plan_limits.sql', import.meta.url), 'utf8');

test('new additive migration sets every final rolling Chat limit without rewriting usage', () => {
  const entries = [...migration.matchAll(/\('(free|lite|pro|max)',\s*(\d+),\s*(\d+),\s*false\)/g)]
    .map(([, plan, fiveHour, weekly]) => [plan, [Number(fiveHour), Number(weekly)]]);
  assert.deepEqual(Object.fromEntries(entries), {
    free: [120, 800],
    lite: [240, 1600],
    pro: [600, 4000],
    max: [1200, 8000],
  });
  assert.match(migration, /on conflict \(plan_code\) do update set/i);
  assert.doesNotMatch(migration, /(?:delete|truncate|update)\s+(?:from\s+)?public\.chat_usage_records/i);
});
