import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listUserUsageRows } from './user-usage-data';

test('every usage page is restricted to the selected user before results are returned', async () => {
  const calls: string[] = [];
  const rows = [{ user_id: 'target', created_at: '2026-09-23T00:00:00Z' },
    { user_id: 'other', created_at: '2026-09-23T00:00:00Z' }];
  let selectedUser = '';
  const query = {
    select: () => query,
    eq: (column: string, value: string) => { calls.push(`eq:${column}`); selectedUser = value; return query; },
    gte: () => query,
    order: () => query,
    range: async () => { calls.push('range'); return { data: rows.filter((row) => row.user_id === selectedUser), error: null }; },
  };
  const client = { from: () => query } as unknown as SupabaseClient;
  const result = await listUserUsageRows(client, 'chat_usage_records', 'user_id,created_at', 'target');
  assert.deepEqual(result, [rows[0]]);
  assert.deepEqual(calls, ['eq:user_id', 'range']);
});
