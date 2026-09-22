import type { AdminProviderRow, CostAmount } from './types';

type Attempt = {
  provider: unknown;
  state: unknown;
  error_message: unknown;
  started_at: unknown;
  finished_at: unknown;
};

type CostRecord = {
  provider: unknown;
  provider_model: unknown;
  actual_cost_minor: unknown;
  currency: unknown;
  created_at: unknown;
};

const validMinor = (value: unknown): string | null => {
  const text = String(value ?? '');
  return /^\d+$/.test(text) ? text : null;
};

const timestamp = (value: unknown): string | null => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null;
  return value;
};

export function deriveProviderTelemetry(
  providerId: string,
  attempts: Attempt[],
  costs: CostRecord[],
  modelNames: Map<string, string>,
  metricsComplete: boolean,
  now = new Date(),
): Pick<AdminProviderRow, 'successfulAttempts' | 'terminalAttempts' | 'metricsComplete' | 'lastSuccessAt' | 'lastFailureAt' | 'dailyUsage' | 'costByModel' | 'recentIssues'> {
  const ownAttempts = attempts.filter((row) => String(row.provider).toLowerCase() === providerId.toLowerCase());
  const ownCosts = costs.filter((row) => String(row.provider).toLowerCase() === providerId.toLowerCase());
  const successes = ownAttempts.filter((row) => row.state === 'completed');
  const failures = ownAttempts.filter((row) => row.state === 'failed');
  const latest = (rows: Attempt[]) => rows.map((row) => timestamp(row.finished_at) ?? timestamp(row.started_at))
    .filter((value): value is string => value !== null).sort().at(-1) ?? null;

  const days = new Map<string, AdminProviderRow['dailyUsage'][number]>();
  for (let offset = 89; offset >= 0; offset -= 1) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset))
      .toISOString().slice(0, 10);
    days.set(day, { date: day, successful: 0, failed: 0, other: 0, spendUsdMinor: null });
  }
  for (const attempt of ownAttempts) {
    const day = (timestamp(attempt.started_at) ?? '').slice(0, 10);
    const entry = days.get(day);
    if (!entry) continue;
    if (attempt.state === 'completed') entry.successful += 1;
    else if (attempt.state === 'failed') entry.failed += 1;
    else entry.other += 1;
  }

  const costGroups = new Map<string, { providerModelId: string; records: number; cost: CostAmount }>();
  for (const record of ownCosts) {
    const minor = validMinor(record.actual_cost_minor);
    const currency = String(record.currency ?? '').toUpperCase();
    if (minor === null || !/^[A-Z]{3}$/.test(currency)) continue;
    const model = String(record.provider_model ?? '').trim();
    if (model) {
      const key = `${model}\u0000${currency}`;
      const current = costGroups.get(key);
      costGroups.set(key, {
        providerModelId: model,
        records: (current?.records ?? 0) + 1,
        cost: { currency, minor: ((current ? BigInt(current.cost.minor) : 0n) + BigInt(minor)).toString() },
      });
    }
    if (currency === 'USD') {
      const day = (timestamp(record.created_at) ?? '').slice(0, 10);
      const entry = days.get(day);
      if (entry) entry.spendUsdMinor = ((entry.spendUsdMinor === null ? 0n : BigInt(entry.spendUsdMinor)) + BigInt(minor)).toString();
    }
  }

  return {
    successfulAttempts: successes.length,
    terminalAttempts: successes.length + failures.length,
    metricsComplete,
    lastSuccessAt: latest(successes),
    lastFailureAt: latest(failures),
    dailyUsage: [...days.values()],
    costByModel: [...costGroups.values()].map((row) => ({
      ...row,
      name: modelNames.get(row.providerModelId) ?? row.providerModelId,
    })).sort((a, b) => a.cost.currency.localeCompare(b.cost.currency)
      || (BigInt(a.cost.minor) > BigInt(b.cost.minor) ? -1 : BigInt(a.cost.minor) < BigInt(b.cost.minor) ? 1 : 0)),
    recentIssues: failures.map((row) => ({
      at: timestamp(row.finished_at) ?? timestamp(row.started_at) ?? '',
      message: String(row.error_message ?? 'Provider attempt failed'),
    })).filter((row) => row.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5),
  };
}
