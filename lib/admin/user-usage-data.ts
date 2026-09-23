import type { SupabaseClient } from '@supabase/supabase-js';

/** Every page is constrained to one user before sorting or pagination. */
export async function listUserUsageRows(client: SupabaseClient, table: string, columns: string, userId: string, start: string | null = null) {
  const rows: Record<string, any>[] = [];
  for (let from = 0; ; from += 1000) {
    let query = client.from(table).select(columns).eq('user_id', userId);
    if (start) query = query.gte('created_at', start);
    const { data, error } = await query.order('created_at', { ascending: false }).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}
