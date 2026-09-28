import 'server-only';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';

export type SearchFailure = 'rate_limited' | 'quota_exhausted' | 'timeout' | 'unavailable' | 'invalid_response';
export type SearchHealthRow = {
  providerId: string; month: string; requests: number; successes: number; failures: number;
  rateLimits: number; consecutiveFailures: number; consecutiveRateLimits: number;
  lastSuccessAt: string | null; lastFailureAt: string | null;
  lastFailureCategory: SearchFailure | null; cooldownUntil: string | null;
  lastLatencyMs: number | null; lastResultCount: number | null; lastTruncated: boolean;
};
export interface SearchHealthStore {
  claim(providerId: string, budget: number | null): Promise<'ok' | 'cooldown' | 'budget'>;
  record(providerId: string, result: { success: boolean; category?: SearchFailure;
    latencyMs: number; resultCount: number; truncated: boolean; cooldownSeconds: number }): Promise<void>;
}

/** Durable, atomic per-provider accounting; never stores query text, results, or credentials. */
export class SupabaseSearchHealthStore implements SearchHealthStore {
  async claim(providerId: string, budget: number | null) {
    const client = getSupabaseAdminClient();
    if (!client) throw new Error('WEB_SEARCH_TELEMETRY_UNAVAILABLE');
    const { data, error } = await client.rpc('claim_web_search_request', {
      p_provider_id: providerId, p_budget: budget,
    });
    if (error || !['ok', 'cooldown', 'budget'].includes(String(data)))
      throw new Error('WEB_SEARCH_TELEMETRY_UNAVAILABLE');
    return data as 'ok' | 'cooldown' | 'budget';
  }

  async record(providerId: string, result: { success: boolean; category?: SearchFailure;
    latencyMs: number; resultCount: number; truncated: boolean; cooldownSeconds: number }) {
    const client = getSupabaseAdminClient();
    if (!client) throw new Error('WEB_SEARCH_TELEMETRY_UNAVAILABLE');
    const { error } = await client.rpc('record_web_search_result', {
      p_provider_id: providerId, p_success: result.success, p_category: result.category ?? null,
      p_latency_ms: result.latencyMs, p_result_count: result.resultCount,
      p_truncated: result.truncated, p_cooldown_seconds: result.cooldownSeconds,
    });
    if (error) throw new Error('WEB_SEARCH_TELEMETRY_UNAVAILABLE');
  }
}

export function searchBudget(providerId: string): number | null {
  const raw = providerId === 'brave' ? process.env.BRAVE_SEARCH_MONTHLY_REQUEST_BUDGET : undefined;
  if (!raw) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function budgetWarning(requests: number, budget: number | null): 'none' | 'warning' | 'critical' | 'exhausted' {
  if (budget === null) return 'none';
  if (requests >= budget) return 'exhausted';
  if (requests >= budget * 0.95) return 'critical';
  if (requests >= budget * 0.8) return 'warning';
  return 'none';
}

export async function adminSearchHealth() {
  const client = getSupabaseAdminClient();
  if (!client) return { available: false, rows: [] as SearchHealthRow[] };
  const month = new Date().toISOString().slice(0, 7) + '-01';
  const { data, error } = await client.from('web_search_health').select('*').eq('month', month);
  if (error) return { available: false, rows: [] as SearchHealthRow[] };
  return { available: true, rows: (data ?? []).map((row) => ({
    providerId: row.provider_id, month: row.month, requests: row.requests,
    successes: row.successes, failures: row.failures, rateLimits: row.rate_limits,
    consecutiveFailures: row.consecutive_failures, consecutiveRateLimits: row.consecutive_rate_limits,
    lastSuccessAt: row.last_success_at, lastFailureAt: row.last_failure_at,
    lastFailureCategory: row.last_failure_category, cooldownUntil: row.cooldown_until,
    lastLatencyMs: row.last_latency_ms, lastResultCount: row.last_result_count,
    lastTruncated: row.last_truncated,
  })) as SearchHealthRow[] };
}

export async function adminSearchProviderRows() {
  const snapshot = await adminSearchHealth();
  return {
    available: snapshot.available,
    providers: (['brave', 'tavily'] as const).map((id) => {
      const configured = Boolean(id === 'brave' ? process.env.BRAVE_SEARCH_API_KEY : process.env.TAVILY_API_KEY);
      const row = snapshot.rows.find((entry) => entry.providerId === id) ?? null;
      const budget = searchBudget(id);
      const budgetState = budgetWarning(row?.requests ?? 0, budget);
      const coolingDown = Boolean(row?.cooldownUntil && Date.parse(row.cooldownUntil) > Date.now());
      const recentFailure = Boolean(row?.lastFailureAt && Date.parse(row.lastFailureAt) > Date.now() - 30 * 60_000
        && (!row.lastSuccessAt || Date.parse(row.lastFailureAt) > Date.parse(row.lastSuccessAt)));
      const status = !configured ? 'Missing key' : budgetState === 'exhausted' ? 'Budget exhausted'
        : coolingDown ? row?.lastFailureCategory === 'rate_limited' ? 'Rate limited' : 'Unavailable'
          : recentFailure && (row?.consecutiveRateLimits ?? 0) >= 3 ? 'Degraded · repeated rate limits'
            : recentFailure && (row?.consecutiveFailures ?? 0) >= 3 ? 'Degraded · repeated failures'
            : row?.successes ? 'Ready' : 'Configured · unverified';
      return { id, name: id === 'brave' ? 'Brave Search' : 'Tavily', configured, status, budget,
        budgetState, ...row, requests: row?.requests ?? 0, successes: row?.successes ?? 0,
        failures: row?.failures ?? 0, rateLimits: row?.rateLimits ?? 0,
        lastSuccessAt: row?.lastSuccessAt ?? null, lastFailureAt: row?.lastFailureAt ?? null,
        lastFailureCategory: row?.lastFailureCategory ?? null };
    }),
  };
}
