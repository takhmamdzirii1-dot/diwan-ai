import { CHAT_WINDOW_5H_MS, CHAT_WINDOW_7D_MS, computeWindowRelease } from '@/lib/chat/chat-usage';

export type UsageRange = 'cycle' | '7d' | '30d' | 'all';

export function usageRangeStart(range: UsageRange, nowMs: number, cycleStart: string | null): string | null {
  if (range === 'all') return null;
  if (range === 'cycle') return cycleStart;
  return new Date(nowMs - (range === '7d' ? CHAT_WINDOW_7D_MS : 30 * 86_400_000)).toISOString();
}

export function inUsageRange(createdAt: string, start: string | null): boolean {
  return start === null || Date.parse(createdAt) >= Date.parse(start);
}

export function currentPlanView(
  active: { planCode: string; startsAt: string; endsAt: string | null } | null,
  previousPaid: { name: string; status: string } | null,
  accountCreatedAt: string,
) {
  return active
    ? { name: active.planCode, status: 'active', startsAt: active.startsAt, endsAt: active.endsAt,
      previousPaid: null }
    : { name: 'free', status: 'active', startsAt: accountCreatedAt, endsAt: null,
      previousPaid: previousPaid ? `${previousPaid.name} · ${previousPaid.status}` : null };
}

export type ChatRecord = { model_key: string; weight: number; status: string; created_at: string; expires_at: string | null };

export function summarizeChat(records: ChatRecord[], nowMs: number, limits: { fiveHour: number | null; weekly: number | null }) {
  const live = records.filter((row) => row.status === 'completed'
    || (row.status === 'reserved' && (row.expires_at === null || Date.parse(row.expires_at) > nowMs)));
  const completed = records.filter((row) => row.status === 'completed');
  const in5 = live.filter((row) => Date.parse(row.created_at) > nowMs - CHAT_WINDOW_5H_MS);
  const in7 = live.filter((row) => Date.parse(row.created_at) > nowMs - CHAT_WINDOW_7D_MS);
  const fiveHourUsed = in5.reduce((sum, row) => sum + row.weight, 0);
  const weeklyUsed = in7.reduce((sum, row) => sum + row.weight, 0);
  const release = (windowMs: number, used: number, limit: number | null) => computeWindowRelease(
    completed.filter((row) => Date.parse(row.created_at) > nowMs - windowMs)
      .map((row) => ({ createdAtMs: Date.parse(row.created_at), weight: row.weight })),
    windowMs, used, limit, 1,
  );
  return {
    fiveHourUsed, weeklyUsed,
    fiveHourLimit: limits.fiveHour, weeklyLimit: limits.weekly,
    fiveHourRemaining: limits.fiveHour === null ? null : Math.max(0, limits.fiveHour - fiveHourUsed),
    weeklyRemaining: limits.weekly === null ? null : Math.max(0, limits.weekly - weeklyUsed),
    nextFiveHourAt: release(CHAT_WINDOW_5H_MS, fiveHourUsed, limits.fiveHour),
    nextWeeklyAt: release(CHAT_WINDOW_7D_MS, weeklyUsed, limits.weekly),
    activeReservations: live.filter((row) => row.status === 'reserved').length,
  };
}

export function sumStored(rows: { amount: string | number | null }[]): string | null {
  if (rows.some((row) => row.amount === null)) return null;
  try { return rows.reduce((sum, row) => sum + BigInt(row.amount ?? 0), 0n).toString(); }
  catch { return null; }
}

export type MediaJob = { model_key: string; modality: string; state: string; reservation_id: string | null };
export type SettledUsage = { reservation_id: string; modality: string; status: string; credits_charged: string | number | null };

export function summarizeMedia(jobs: MediaJob[], usage: SettledUsage[], nameFor: (key: string) => string) {
  const byReservation = new Map(usage.map((row) => [row.reservation_id, row]));
  return (['image', 'video'] as const).map((modality) => {
    const matching = jobs.filter((row) => row.modality === modality);
    const breakdown = new Map<string, { model: string; successful: number; failed: number; credits: string | null }>();
    for (const row of matching) {
      const value = breakdown.get(row.model_key) ?? { model: nameFor(row.model_key), successful: 0, failed: 0, credits: '0' };
      if (row.state === 'completed') {
        value.successful += 1;
        const settled = row.reservation_id ? byReservation.get(row.reservation_id) : null;
        value.credits = settled && settled.status === 'completed'
          ? sumStored([{ amount: value.credits }, { amount: settled.credits_charged }]) : null;
      }
      if (row.state === 'failed') value.failed += 1;
      breakdown.set(row.model_key, value);
    }
    const settled = usage.filter((row) => row.modality === modality && row.status === 'completed');
    return { modality, successful: matching.filter((row) => row.state === 'completed').length,
      failed: matching.filter((row) => row.state === 'failed').length,
      credits: sumStored(settled.map((row) => ({ amount: row.credits_charged }))),
      breakdown: [...breakdown.values()].sort((a, b) => b.successful - a.successful) };
  });
}

export function summarizeTrials(
  configs: { model_key: string; trial_allowance: number | null }[],
  usages: { model_key: string; trial_scope: string; state: string; expires_at: string }[],
  plan: string, scope: string | null, nowMs: number, nameFor: (key: string) => string,
) {
  return configs.map((config) => {
    const matching = usages.filter((row) => row.model_key === config.model_key && row.trial_scope === scope);
    const used = matching.filter((row) => row.state === 'completed'
      || (row.state === 'reserved' && Date.parse(row.expires_at) > nowMs)).length;
    return { model: nameFor(config.model_key), plan, scope, allowance: config.trial_allowance,
      used, remaining: config.trial_allowance == null ? null : Math.max(0, config.trial_allowance - used),
      exhausted: config.trial_allowance == null || used >= config.trial_allowance };
  });
}

export function settledBucketTotal(
  rows: { transaction_type: string; metadata: Record<string, unknown> | null; created_at: string }[],
  bucket: 'subscription_charged' | 'purchased_charged', start: string | null, end: string | null = null,
): string | null {
  return sumStored(rows.filter((row) => row.transaction_type === 'settle'
    && inUsageRange(row.created_at, start) && (end === null || Date.parse(row.created_at) < Date.parse(end)))
    .map((row) => ({ amount: row.metadata?.[bucket] == null ? null : String(row.metadata[bucket]) })));
}
