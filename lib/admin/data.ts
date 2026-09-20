import 'server-only';

import { notFound } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { getOwnerAccess, isOwnerUser } from '@/lib/auth/owner';
import { AUTO_FALLBACK_CHAIN, PROVIDER_REGISTRY } from '@/lib/ai/image-providers/router';
import { SERVER_PROVIDER_REGISTRY, providerConfigurationSummary } from '@/lib/ai/providers/registry';
import {
  STUDIO_MODELS,
} from '@/src/config/studio-registry';
import { applyModelRuntimeOverrides, getEffectiveRuntimeModels, type EffectiveRuntimeModel } from '@/lib/models/runtime-config';
import { getSupabaseAdminClient } from './supabase-admin';
import type {
  AdminActivity,
  AdminAuditRow,
  AdminDataResult,
  AdminJobRow,
  AdminJobsData,
  AdminModelRow,
  AdminOverviewData,
  AdminPaymentRow,
  AdminPaymentPlan,
  AdminProviderRow,
  AdminUserRow,
  AdminUsersData,
  CostAmount,
} from './types';
import { isMissingCustomerPricing } from './model-economics';

const PAGE_SIZE = 1000;
const MAX_PAGES = 10;
const MODEL_NAMES = new Map<string, string>(STUDIO_MODELS.map((model) => [model.id, model.displayName]));
for (const provider of Object.values(PROVIDER_REGISTRY)) {
  for (const model of provider.models) if (!MODEL_NAMES.has(model.id)) MODEL_NAMES.set(model.id, model.name);
}

async function requireAdminDataAccess() {
  const access = await getOwnerAccess();
  if (!access.user || !access.isOwner) notFound();
  return getSupabaseAdminClient();
}

async function allRows(client: any, table: string, columns: string) {
  const rows: any[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await client.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) break;
  }
  return rows;
}

async function allAuthUsers(client: any) {
  const users: User[] = [];
  let truncated = false;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < PAGE_SIZE) return { users, truncated };
    if (page === MAX_PAGES) truncated = true;
  }
  return { users, truncated };
}

const numericString = (value: unknown) => {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value).toString();
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return value;
  return '0';
};

const sumIntegerValues = (rows: any[], key: string) =>
  rows.reduce((total, row) => total + BigInt(numericString(row[key])), 0n).toString();

function groupCosts(rows: any[]): Map<string, CostAmount[]> {
  const grouped = new Map<string, Map<string, bigint>>();
  for (const row of rows) {
    if (row.actual_cost_minor == null) continue;
    const provider = String(row.provider ?? '').toLowerCase();
    const currency = String(row.currency ?? '').toUpperCase();
    if (!provider || !currency) continue;
    const currencies = grouped.get(provider) ?? new Map<string, bigint>();
    currencies.set(currency, (currencies.get(currency) ?? 0n) + BigInt(numericString(row.actual_cost_minor)));
    grouped.set(provider, currencies);
  }
  return new Map([...grouped.entries()].map(([provider, currencies]) => [
    provider,
    [...currencies.entries()].map(([currency, minor]) => ({ currency, minor: minor.toString() })),
  ]));
}

function totalCosts(rows: any[]): CostAmount[] {
  const totals = new Map<string, bigint>();
  for (const row of rows) {
    if (row.actual_cost_minor == null) continue;
    const currency = String(row.currency ?? '').toUpperCase();
    if (!currency) continue;
    totals.set(currency, (totals.get(currency) ?? 0n) + BigInt(numericString(row.actual_cost_minor)));
  }
  return [...totals.entries()].map(([currency, minor]) => ({ currency, minor: minor.toString() }));
}

const unavailable = <T,>(data: T): AdminDataResult<T> => ({ available: false, data, reason: 'not_configured' });
const failed = <T,>(data: T): AdminDataResult<T> => ({ available: false, data, reason: 'query_failed' });

function latestCostsByModel(rows: any[]) {
  const latest = new Map<string, CostAmount>();
  rows.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).forEach((row) => {
    const key = String(row.provider_model);
    if (!latest.has(key) && row.actual_cost_minor != null) {
      latest.set(key, { currency: String(row.currency), minor: numericString(row.actual_cost_minor) });
    }
  });
  return latest;
}

function providerCostState(provider: string, actualCost: CostAmount | null): AdminModelRow['providerCostState'] {
  if (actualCost) return BigInt(actualCost.minor) === 0n ? 'free' : 'known';
  const definition = Object.values(PROVIDER_REGISTRY).find((item) =>
    item.id.toLowerCase() === provider.toLowerCase() || item.name.toLowerCase() === provider.toLowerCase());
  return definition && ['free', 'user_associated', 'byop'].includes(definition.pricing) ? 'free' : 'unknown';
}

function buildAdminModelRows(models: readonly EffectiveRuntimeModel[], latestCostByModel: Map<string, CostAmount>): AdminModelRow[] {
  return models.map((model) => {
    const configuredProviderCost = model.providerCostStatus === 'known'
      && model.providerCostMinor && model.providerCostCurrency
      ? { currency: model.providerCostCurrency, minor: model.providerCostMinor }
      : null;
    const providerCost = configuredProviderCost ?? latestCostByModel.get(model.modelId) ?? null;
    return {
      key: model.key, provider: model.provider, modelId: model.modelId,
      displayName: model.displayName, modality: model.modality, enabled: model.enabled,
      availability: model.availability, providerCost,
      providerCostState: model.providerCostStatus ?? providerCostState(model.provider, providerCost),
      creditPrice: model.customerCreditPrice, priority: model.routingRole,
      activationSupported: model.activationSupported, persisted: model.persisted, updatedAt: model.updatedAt,
      shortDescription: model.shortDescription, mediaUrl: model.mediaUrl, category: model.category,
      sortOrder: model.sortOrder, visibleInStudio: model.visibleInStudio,
      availabilityLabel: model.availabilityLabel,
      capabilities: model.capabilities,
      allowedPlans: model.allowedPlans,
      routes: [], providerOptions: [],
    };
  });
}

export async function getAdminOverview(): Promise<AdminDataResult<AdminOverviewData>> {
  const empty: AdminOverviewData = {
    totalUsers: null, totalGenerations: null, successfulJobs: null, failedJobs: null,
    providerIssues: null,
    modelsMissingPricing: buildAdminModelRows(applyModelRuntimeOverrides([]), new Map()).filter(isMissingCustomerPricing).length,
    modelsUnknownProviderCost: buildAdminModelRows(applyModelRuntimeOverrides([]), new Map()).filter((model) => model.providerCostState === 'unknown').length,
    creditsConsumed: null, pendingPayments: null, providerCosts: [], recentActivity: [],
    activeProviders: null, activeModels: null,
  };
  const client = await requireAdminDataAccess();
  if (!client) return unavailable(empty);

  try {
    const [auth, executions, generations, usage, costs, transactions, providerConfigs, executionCount, completedCount, failedCount, mediaCount, mediaCompleted, mediaFailed, pendingPaymentCount] = await Promise.all([
      allAuthUsers(client),
      client.from('ai_executions').select('id,modality,model_id,state,error_code,created_at')
        .order('created_at', { ascending: false }).limit(8),
      client.from('generations').select('id,type,model_id,status,error_message,created_at')
        .order('created_at', { ascending: false }).limit(8),
      allRows(client, 'usage_records', 'credits_charged,created_at'),
      allRows(client, 'provider_cost_records', 'provider,provider_model,actual_cost_minor,currency,created_at'),
      client.from('credit_transactions').select('id,transaction_type,amount,reason,created_at')
        .order('created_at', { ascending: false }).limit(8),
      client.from('provider_runtime_configs').select('provider_id,enabled,emergency_disabled,last_error_code'),
      client.from('ai_executions').select('id', { count: 'exact', head: true }),
      client.from('ai_executions').select('id', { count: 'exact', head: true }).eq('state', 'completed'),
      client.from('ai_executions').select('id', { count: 'exact', head: true }).eq('state', 'failed'),
      client.from('generations').select('id', { count: 'exact', head: true }),
      client.from('generations').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      client.from('generations').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      client.from('payment_orders').select('id', { count: 'exact', head: true })
        .eq('status', 'pending').not('submitted_at', 'is', null),
    ]);
    for (const result of [executions, generations, transactions, providerConfigs, executionCount, completedCount, failedCount, mediaCount, mediaCompleted, mediaFailed, pendingPaymentCount]) {
      if (result.error) throw result.error;
    }
    const executionActivity: AdminActivity[] = (executions.data ?? []).map((row) => ({
      id: `execution:${row.id}`, kind: 'generation', label: `${row.modality} · ${MODEL_NAMES.get(row.model_id) ?? row.model_id}`,
      detail: row.error_code ?? row.state, status: row.state, createdAt: row.created_at,
    }));
    const generationActivity: AdminActivity[] = (generations.data ?? [])
      .map((row) => ({
        id: `generation:${row.id}`, kind: 'generation', label: `${row.type} · ${MODEL_NAMES.get(row.model_id) ?? row.model_id}`,
        detail: row.error_message ?? row.status, status: row.status, createdAt: row.created_at,
      }));
    const creditActivity: AdminActivity[] = (transactions.data ?? []).map((row: any) => ({
      id: `credit:${row.id}`, kind: 'credit', label: row.transaction_type,
      detail: numericString(row.amount), technicalDetail: row.reason,
      status: row.transaction_type, createdAt: row.created_at,
    }));
    const modelRows = buildAdminModelRows(await getEffectiveRuntimeModels(client), latestCostsByModel(costs));
    const activeProviders = (providerConfigs.data ?? []).filter((row) => row.enabled && !row.emergency_disabled && providerConfigurationSummary(row.provider_id).configured).length;

    return { available: true, data: {
      totalUsers: auth.truncated ? null : auth.users.length,
      totalGenerations: executionCount.count == null || mediaCount.count == null ? null : executionCount.count + mediaCount.count,
      successfulJobs: completedCount.count == null || mediaCompleted.count == null ? null : completedCount.count + mediaCompleted.count,
      failedJobs: failedCount.count == null || mediaFailed.count == null ? null : failedCount.count + mediaFailed.count,
      providerIssues: (providerConfigs.data ?? []).filter((row) => row.emergency_disabled || row.last_error_code).length,
      modelsMissingPricing: modelRows.filter((model) => model.enabled && isMissingCustomerPricing(model)).length,
      modelsUnknownProviderCost: modelRows.filter((model) => model.providerCostState === 'unknown').length,
      creditsConsumed: usage.length >= PAGE_SIZE * MAX_PAGES ? null : sumIntegerValues(usage, 'credits_charged'),
      pendingPayments: pendingPaymentCount.count ?? null,
      providerCosts: costs.length >= PAGE_SIZE * MAX_PAGES ? [] : totalCosts(costs),
      activeProviders,
      activeModels: modelRows.filter((row) => row.enabled).length,
      recentActivity: [...executionActivity, ...generationActivity, ...creditActivity]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10),
    } };
  } catch (error) {
    console.error('[admin] overview query failed', { message: error instanceof Error ? error.message : 'Unknown error' });
    return failed(empty);
  }
}

export async function getAdminProviders(): Promise<AdminDataResult<AdminProviderRow[]>> {
  const client = await requireAdminDataAccess();
  try {
    const [attempts, costs, runtimeConfigs, routes] = client ? await Promise.all([
      allRows(client, 'provider_attempts', 'provider,state,error_message,started_at,finished_at'),
      allRows(client, 'provider_cost_records', 'provider,actual_cost_minor,currency,created_at'),
      allRows(client, 'provider_runtime_configs', 'provider_id,enabled,priority,emergency_disabled,daily_spend_limit_minor,spend_currency,last_error_code,last_checked_at'),
      allRows(client, 'model_provider_routes', 'model_key,model_id,provider_id'),
    ]) : [[], [], [], []];
    const groupedCosts = costs.length >= PAGE_SIZE * MAX_PAGES ? new Map<string, CostAmount[]>() : groupCosts(costs);
    const configByProvider = new Map(runtimeConfigs.map((row) => [String(row.provider_id), row]));
    const definitions = SERVER_PROVIDER_REGISTRY.map((provider) => {
      const config = configByProvider.get(provider.id);
      const connection = providerConfigurationSummary(provider.id);
      const enabled = Boolean(config?.enabled);
      return {
        id: provider.id,
        name: provider.name,
        modalities: [...provider.modalities],
        enabled,
        configured: connection.configured,
        priority: Number(config?.priority ?? 100),
        emergencyDisabled: Boolean(config?.emergency_disabled),
        dailySpendLimitMinor: config?.daily_spend_limit_minor == null
          ? null : numericString(config.daily_spend_limit_minor),
        spendCurrency: config?.spend_currency == null ? null : String(config.spend_currency),
        statusOverride: provider.id === 'puter' ? 'client_managed' as const : null,
        role: enabled && !config?.emergency_disabled
          ? (Number(config?.priority ?? 100) <= 20 ? 'primary' as const : 'backup' as const)
          : 'unassigned' as const,
        lastRuntimeError: config?.last_error_code == null ? null : String(config.last_error_code),
        lastRuntimeCheck: config?.last_checked_at == null ? null : String(config.last_checked_at),
      };
    });

    const rows = definitions.map((provider) => {
      const providerAttempts = attempts.filter((attempt) =>
        String(attempt.provider).toLowerCase() === provider.id.toLowerCase());
      const failures = providerAttempts.filter((attempt) => attempt.state === 'failed');
      const completedDurations = providerAttempts.filter((attempt) => attempt.started_at && attempt.finished_at)
        .map((attempt) => new Date(attempt.finished_at).getTime() - new Date(attempt.started_at).getTime())
        .filter((duration) => Number.isFinite(duration) && duration >= 0);
      const lastAttempt = providerAttempts.slice()
        .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0];
      const lastFailure = failures.slice()
        .sort((a, b) => String(b.finished_at ?? b.started_at).localeCompare(String(a.finished_at ?? a.started_at)))[0];
      const runtimeFailure = provider.lastRuntimeError || lastAttempt?.state === 'failed';
      const status = provider.statusOverride ?? (!provider.configured ? 'unconfigured'
        : provider.emergencyDisabled || runtimeFailure ? 'attention'
          : providerAttempts.length || provider.lastRuntimeCheck ? 'healthy' : 'idle');
      const associatedModels = routes
        .filter((route) => String(route.provider_id) === provider.id)
        .map((route) => {
          const key = String(route.model_key);
          const providerModelId = String(route.model_id);
          return { key, name: MODEL_NAMES.get(key) ?? MODEL_NAMES.get(providerModelId) ?? key, providerModelId };
        })
        .filter((route, index, all) => all.findIndex((candidate) => candidate.key === route.key
          && candidate.providerModelId === route.providerModelId) === index);
      return {
        id: provider.id, name: provider.name, modalities: provider.modalities,
        enabled: provider.enabled, status, role: provider.role,
        requestCount: providerAttempts.length, failures: failures.length,
        averageLatencyMs: completedDurations.length
          ? Math.round(completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length) : null,
        lastActivityAt: provider.lastRuntimeCheck ?? lastAttempt?.finished_at ?? lastAttempt?.started_at ?? null,
        associatedModels,
        accumulatedCosts: groupedCosts.get(provider.id.toLowerCase()) ?? [],
        lastError: provider.lastRuntimeError ?? lastFailure?.error_message ?? null,
        configured: provider.configured,
        priority: provider.priority,
        emergencyDisabled: provider.emergencyDisabled,
        dailySpendLimitMinor: provider.dailySpendLimitMinor,
        spendCurrency: provider.spendCurrency,
      } satisfies AdminProviderRow;
    });
    return client ? { available: true, data: rows } : unavailable(rows);
  } catch (error) {
    console.error('[admin] provider query failed', { message: error instanceof Error ? error.message : 'Unknown error' });
    return failed([]);
  }
}

export async function getAdminModels(): Promise<AdminDataResult<AdminModelRow[]>> {
  const client = await requireAdminDataAccess();
  try {
    const [costs, routes, providerConfigs] = client ? await Promise.all([
      allRows(client, 'provider_cost_records', 'provider,provider_model,actual_cost_minor,currency,created_at'),
      allRows(client, 'model_provider_routes', 'id,model_key,provider_id,provider_model_id,enabled,priority,fallback'),
      allRows(client, 'provider_runtime_configs', 'provider_id,enabled,emergency_disabled'),
    ]) : [[], [], []];
    const providerEnabled = new Map(providerConfigs.map((row) => [String(row.provider_id), Boolean(row.enabled) && !Boolean(row.emergency_disabled)]));
    const rows = buildAdminModelRows(
      client ? await getEffectiveRuntimeModels(client) : applyModelRuntimeOverrides([]),
      latestCostsByModel(costs),
    ).map((model) => ({
      ...model,
      providerOptions: SERVER_PROVIDER_REGISTRY
        .filter((provider) => provider.modalities.some((modality) => modality === model.modality))
        .map((provider) => ({
          id: provider.id,
          name: provider.name,
          configured: providerConfigurationSummary(provider.id).configured,
          enabled: providerEnabled.get(provider.id) ?? false,
        })),
      routes: routes.filter((route) => String(route.model_key) === model.key).map((route) => ({
        id: String(route.id),
        providerId: String(route.provider_id),
        providerModelId: String(route.provider_model_id),
        enabled: Boolean(route.enabled),
        priority: Number(route.priority),
        fallback: Boolean(route.fallback),
        configured: providerConfigurationSummary(String(route.provider_id)).configured,
        providerEnabled: providerEnabled.get(String(route.provider_id)) ?? false,
      })),
    }));
    return client ? { available: true, data: rows } : unavailable(rows);
  } catch (error) {
    console.error('[admin] model query failed', { message: error instanceof Error ? error.message : 'Unknown error' });
    return failed([]);
  }
}

export async function getAdminUsers(query = ''): Promise<AdminDataResult<AdminUsersData>> {
  const empty: AdminUsersData = { users: [], total: 0, query, truncated: false };
  const client = await requireAdminDataAccess();
  if (!client) return unavailable(empty);
  try {
    const [auth, credits, usage, generations, executions, paymentOrders, entitlements] = await Promise.all([
      allAuthUsers(client), allRows(client, 'credits', 'user_id,balance'),
      allRows(client, 'usage_records', 'user_id,credits_charged'), allRows(client, 'generations', 'user_id'),
      allRows(client, 'ai_executions', 'user_id'),
      allRows(client, 'payment_orders', 'user_id'),
      allRows(client, 'user_entitlements', 'user_id,plan_name,status,starts_at,ends_at'),
    ]);
    const balances = new Map(credits.map((row) => [row.user_id, numericString(row.balance)]));
    const usageByUser = new Map<string, bigint>();
    usage.forEach((row) => usageByUser.set(row.user_id,
      (usageByUser.get(row.user_id) ?? 0n) + BigInt(numericString(row.credits_charged))));
    const generationsByUser = new Map<string, number>();
    generations.forEach((row) => generationsByUser.set(row.user_id, (generationsByUser.get(row.user_id) ?? 0) + 1));
    executions.forEach((row) => generationsByUser.set(row.user_id, (generationsByUser.get(row.user_id) ?? 0) + 1));
    const paymentsByUser = new Map<string, number>();
    paymentOrders.forEach((row) => paymentsByUser.set(row.user_id, (paymentsByUser.get(row.user_id) ?? 0) + 1));
    const now = Date.now();
    const plansByUser = new Map<string, { name: string; startsAt: number }>();
    entitlements.forEach((row) => {
      const endsAt = row.ends_at ? new Date(row.ends_at).getTime() : null;
      if (row.status !== 'active' || (endsAt !== null && endsAt <= now)) return;
      const startsAt = new Date(row.starts_at).getTime();
      const current = plansByUser.get(row.user_id);
      if (!current || startsAt > current.startsAt) {
        plansByUser.set(row.user_id, { name: row.plan_name, startsAt });
      }
    });
    const normalizedQuery = query.trim().toLowerCase();
    const users: AdminUserRow[] = auth.users
      .filter((user) => !normalizedQuery || user.email?.toLowerCase().includes(normalizedQuery) || user.id.includes(normalizedQuery))
      .slice(0, 100).map((user) => {
        const bannedUntil = user.banned_until ? new Date(user.banned_until).getTime() : 0;
        return {
          id: user.id, email: user.email ?? '—', plan: plansByUser.get(user.id)?.name ?? 'Free',
          isOwner: isOwnerUser(user), creditBalance: balances.get(user.id) ?? null,
          creditsUsed: (usageByUser.get(user.id) ?? 0n).toString(), generationCount: generationsByUser.get(user.id) ?? 0,
          paymentOrderCount: paymentsByUser.get(user.id) ?? 0,
          status: bannedUntil > now ? 'suspended' : user.email_confirmed_at ? 'active' : 'unconfirmed',
          createdAt: user.created_at, lastSignInAt: user.last_sign_in_at ?? null,
        };
      });
    return { available: true, data: { users, total: auth.users.length, query, truncated: auth.truncated } };
  } catch (error) {
    console.error('[admin] user query failed', { message: error instanceof Error ? error.message : 'Unknown error' });
    return failed(empty);
  }
}

export async function getAdminJobs(filters: {
  q?: string; status?: string; modality?: string; provider?: string; model?: string; cursor?: string; seen?: string;
} = {}): Promise<AdminDataResult<AdminJobsData>> {
  const empty: AdminJobsData = { jobs: [], nextCursor: null, total: 0 };
  const client = await requireAdminDataAccess();
  if (!client) return unavailable(empty);
  try {
    const auth = await allAuthUsers(client);
    const emails = new Map(auth.users.map((user) => [user.id, user.email ?? null]));
    const q = (filters.q ?? '').trim().slice(0, 80).replace(/[^\w@.:/\-]/g, '');
    const seen = filters.cursor && /^\d{1,6}$/.test(filters.seen ?? '') ? Number(filters.seen) : 0;
    const matchingUsers = q ? auth.users.filter((user) => user.email?.toLowerCase().includes(q.toLowerCase()) || user.id === q).slice(0, 30).map((user) => user.id) : [];
    const cursor = filters.cursor && !Number.isNaN(Date.parse(filters.cursor)) ? filters.cursor : null;
    let executionsQuery = client.from('ai_executions')
      .select('id,user_id,operation_key,modality,model_id,provider_id,provider_model_id,reservation_id,state,credits_charged,error_code,execution_metadata,created_at,updated_at,completed_at', { count: 'exact' })
      .order('created_at', { ascending: false }).limit(51);
    if (cursor) executionsQuery = executionsQuery.lt('created_at', cursor);
    if (filters.status && filters.status !== 'all') executionsQuery = executionsQuery.eq('state', filters.status);
    if (filters.modality && filters.modality !== 'all') executionsQuery = executionsQuery.eq('modality', filters.modality);
    if (filters.provider && filters.provider !== 'all') executionsQuery = executionsQuery.eq('provider_id', filters.provider);
    if (filters.model && filters.model !== 'all') executionsQuery = executionsQuery.eq('model_id', filters.model);
    if (q) {
      const clauses = [`model_id.ilike.%${q}%`, `provider_id.ilike.%${q}%`, `operation_key.ilike.%${q}%`];
      if (/^[0-9a-f-]{36}$/i.test(q)) clauses.push(`id.eq.${q}`);
      if (matchingUsers.length) clauses.push(`user_id.in.(${matchingUsers.join(',')})`);
      executionsQuery = executionsQuery.or(clauses.join(','));
    }
    let generationsQuery = client.from('generations')
      .select('id,user_id,type,prompt,model_id,status,metadata,error_message,created_at,updated_at', { count: 'exact' })
      .order('created_at', { ascending: false }).limit(51);
    if (cursor) generationsQuery = generationsQuery.lt('created_at', cursor);
    if (filters.status && filters.status !== 'all') generationsQuery = generationsQuery.eq('status', filters.status);
    if (filters.modality && filters.modality !== 'all') generationsQuery = generationsQuery.eq('type', filters.modality);
    if (filters.model && filters.model !== 'all') generationsQuery = generationsQuery.eq('model_id', filters.model);
    if (filters.provider && filters.provider !== 'all') generationsQuery = generationsQuery.eq('metadata->>provider', filters.provider);
    if (q) {
      const clauses = [`model_id.ilike.%${q}%`];
      if (/^[0-9a-f-]{36}$/i.test(q)) clauses.push(`id.eq.${q}`);
      if (matchingUsers.length) clauses.push(`user_id.in.(${matchingUsers.join(',')})`);
      generationsQuery = generationsQuery.or(clauses.join(','));
    }
    const [executions, generations] = await Promise.all([executionsQuery, generationsQuery]);
    if (executions.error) throw executions.error;
    if (generations.error) throw generations.error;
    const reservationIds = (executions.data ?? []).map((row: any) => row.reservation_id).filter(Boolean);
    const [reservations, costs, usage, outbox] = reservationIds.length ? await Promise.all([
      client.from('credit_reservations').select('id,state').in('id', reservationIds),
      client.from('provider_cost_records').select('reservation_id,provider,provider_model,actual_cost_minor,currency').in('reservation_id', reservationIds),
      client.from('usage_records').select('reservation_id,credits_charged').in('reservation_id', reservationIds),
      client.from('provider_dispatch_outbox').select('id,reservation_id').in('reservation_id', reservationIds),
    ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
    for (const result of [reservations, costs, usage, outbox]) if (result.error) throw result.error;
    const outboxIds = (outbox.data ?? []).map((row: any) => row.id);
    const attempts = outboxIds.length ? await client.from('provider_attempts')
      .select('outbox_id,provider,state,error_message,started_at,finished_at')
      .in('outbox_id', outboxIds).order('started_at') : { data: [], error: null };
    if (attempts.error) throw attempts.error;
    const byReservation = <T extends { reservation_id: string }>(rows: T[]) => new Map(rows.map((row) => [row.reservation_id, row]));
    const reservationById = new Map((reservations.data ?? []).map((row: any) => [row.id, row]));
    const costByReservation = byReservation(costs.data ?? []);
    const usageByReservation = byReservation(usage.data ?? []);
    const outboxByReservation = byReservation(outbox.data ?? []);
    const attemptByOutbox = new Map<string, any[]>();
    for (const attempt of attempts.data ?? []) {
      const list = attemptByOutbox.get(attempt.outbox_id) ?? [];
      list.push(attempt);
      attemptByOutbox.set(attempt.outbox_id, list);
    }
    const executionRows: AdminJobRow[] = (executions.data ?? []).map((row: any) => {
      const cost = costByReservation.get(row.reservation_id) as any;
      const usageRecord = usageByReservation.get(row.reservation_id) as any;
      const dispatch = outboxByReservation.get(row.reservation_id) as any;
      const providerAttempts = (dispatch ? attemptByOutbox.get(dispatch.id) : []) ?? [];
      return {
        id: row.id, source: 'execution', userId: row.user_id, modality: row.modality,
        userEmail: emails.get(row.user_id) ?? null,
        provider: row.provider_id, modelId: row.model_id,
        modelName: MODEL_NAMES.get(row.model_id) ?? null,
        status: row.state,
        providerCost: cost?.actual_cost_minor == null ? null : { currency: cost.currency, minor: numericString(cost.actual_cost_minor) },
        creditsCharged: row.credits_charged == null && usageRecord?.credits_charged == null ? null : numericString(row.credits_charged ?? usageRecord.credits_charged),
        latencyMs: row.completed_at ? Math.max(0, new Date(row.completed_at).getTime() - new Date(row.created_at).getTime()) : null,
        error: row.error_code, prompt: null, createdAt: row.created_at, updatedAt: row.updated_at,
        providerModelId: row.provider_model_id,
        reservationState: (reservationById.get(row.reservation_id) as any)?.state ?? null,
        attempts: providerAttempts.map((attempt) => ({ provider: attempt.provider, state: attempt.state, error: attempt.error_message, startedAt: attempt.started_at, finishedAt: attempt.finished_at })),
        usageMetadata: row.execution_metadata && typeof row.execution_metadata === 'object' ? row.execution_metadata : null,
      };
    });
    const generationRows: AdminJobRow[] = (generations.data ?? []).map((row: any) => {
      const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
      return {
        id: row.id, source: 'generation', userId: row.user_id, modality: row.type,
        userEmail: emails.get(row.user_id) ?? null,
        provider: typeof metadata.provider === 'string' ? metadata.provider : null, modelId: row.model_id,
        modelName: MODEL_NAMES.get(row.model_id) ?? null,
        status: row.status, providerCost: null, creditsCharged: null, latencyMs: null,
        error: row.error_message, prompt: row.prompt,
        createdAt: row.created_at, updatedAt: row.updated_at,
        providerModelId: typeof metadata.providerModel === 'string' ? metadata.providerModel : null,
        reservationState: null, attempts: [],
        usageMetadata: null,
      };
    });
    const combined = [...executionRows, ...generationRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const jobs = combined.slice(0, 50);
    return { available: true, data: {
      jobs,
      nextCursor: combined.length > 50 ? jobs.at(-1)?.createdAt ?? null : null,
      total: seen + (executions.count ?? 0) + (generations.count ?? 0),
    } };
  } catch (error) {
    console.error('[admin] jobs query failed', { message: error instanceof Error ? error.message : 'Unknown error' });
    return failed(empty);
  }
}

export async function getAdminPayments(): Promise<AdminDataResult<AdminPaymentRow[]>> {
  const client = await requireAdminDataAccess();
  if (!client) return unavailable([]);
  try {
    const [orders, audits, auth] = await Promise.all([
      client.from('payment_orders')
        .select('id,user_id,plan_id,plan_name,order_kind,payment_method,amount_dzd,credits_amount,payment_reference,customer_reference,proof_storage_path,status,submitted_at,reviewed_at,review_note,resulting_credit_transaction_id,resulting_entitlement_id,created_at')
        .order('created_at', { ascending: false }).limit(200),
      client.from('payment_audit_log').select('id,payment_order_id,actor_user_id,action,created_at')
        .order('created_at', { ascending: false }).limit(1000),
      allAuthUsers(client),
    ]);
    if (orders.error) throw orders.error;
    if (audits.error) throw audits.error;
    const emails = new Map(auth.users.map((user) => [user.id, user.email ?? '—']));
    const auditsByOrder = new Map<string, any[]>();
    for (const audit of audits.data ?? []) {
      const list = auditsByOrder.get(audit.payment_order_id) ?? [];
      list.push(audit);
      auditsByOrder.set(audit.payment_order_id, list);
    }
    const rows = await Promise.all((orders.data ?? []).map(async (order: any) => {
      let proofUrl: string | null = null;
      if (order.proof_storage_path) {
        const { data } = await client.storage.from('payment-proofs')
          .createSignedUrl(order.proof_storage_path, 300);
        proofUrl = data?.signedUrl ?? null;
      }
      return {
        id: order.id,
        userId: order.user_id,
        userEmail: emails.get(order.user_id) ?? '—',
        planId: order.plan_id,
        planName: order.plan_name,
        orderKind: order.order_kind,
        paymentMethod: order.payment_method,
        amountDzd: order.amount_dzd,
        creditsAmount: order.credits_amount == null ? null : numericString(order.credits_amount),
        paymentReference: order.payment_reference,
        customerReference: order.customer_reference,
        proofUrl,
        status: order.status === 'draft' || (order.status === 'pending' && !order.submitted_at)
          ? 'incomplete' : order.status,
        submittedAt: order.submitted_at,
        reviewedAt: order.reviewed_at,
        reviewNote: order.review_note,
        resultingCreditTransactionId: order.resulting_credit_transaction_id,
        resultingEntitlementId: order.resulting_entitlement_id,
        createdAt: order.created_at,
        audit: (auditsByOrder.get(order.id) ?? []).map((audit) => ({
          id: audit.id, action: audit.action, actorUserId: audit.actor_user_id, createdAt: audit.created_at,
        })),
      } satisfies AdminPaymentRow;
    }));
    return { available: true, data: rows };
  } catch (error) {
    console.error('[admin] payment query failed', { message: error instanceof Error ? error.message : 'Unknown error' });
    return failed([]);
  }
}

export async function getAdminPaymentPlans(): Promise<AdminDataResult<AdminPaymentPlan[]>> {
  const client = await requireAdminDataAccess();
  if (!client) return unavailable([]);
  try {
    const { data, error } = await client.from('payment_plans')
      .select('id,slug,name,description,kind,price_dzd,unified_credits,active,display_order,featured')
      .order('display_order').order('created_at');
    if (error) throw error;
    return { available: true, data: (data ?? []).map((plan) => ({
      id: plan.id, slug: plan.slug, name: plan.name, description: plan.description,
      kind: plan.kind, priceDzd: plan.price_dzd, unifiedCredits: Number(plan.unified_credits),
      active: plan.active, displayOrder: plan.display_order, featured: plan.featured,
    })) };
  } catch (error) {
    console.error('[admin] payment plan query failed', { message: error instanceof Error ? error.message : 'Unknown error' });
    return failed([]);
  }
}

export async function getAdminAudit(): Promise<AdminDataResult<AdminAuditRow[]>> {
  const client = await requireAdminDataAccess();
  if (!client) return unavailable([]);
  try {
    const [audits, generalAudits, orders, auth] = await Promise.all([
      client.from('payment_audit_log').select('id,payment_order_id,actor_user_id,action,previous_status,new_status,created_at')
        .order('created_at', { ascending: false }).limit(100),
      client.from('admin_audit_log').select('id,actor_user_id,action,resource_type,resource_id,previous_state,new_state,created_at')
        .order('created_at', { ascending: false }).limit(100),
      client.from('payment_orders').select('id,plan_name').order('created_at', { ascending: false }).limit(500),
      allAuthUsers(client),
    ]);
    if (audits.error) throw audits.error;
    if (generalAudits.error) throw generalAudits.error;
    if (orders.error) throw orders.error;
    const plans = new Map((orders.data ?? []).map((row) => [row.id, row.plan_name]));
    const emails = new Map(auth.users.map((user) => [user.id, user.email ?? null]));
    const paymentRows = (audits.data ?? []).map((row) => ({
      id: row.id, action: row.action, actor: emails.get(row.actor_user_id) ?? null,
      resource: plans.get(row.payment_order_id) ?? 'Payment',
      resourceType: 'payment_order', resourceId: row.payment_order_id,
      detail: row.previous_status ? `${row.previous_status} → ${row.new_status}` : row.new_status,
      previousState: row.previous_status ? { status: row.previous_status } : null,
      newState: row.new_status ? { status: row.new_status } : null,
      createdAt: row.created_at,
    } satisfies AdminAuditRow));
    const generalRows = (generalAudits.data ?? []).map((row) => ({
      id: row.id, action: row.action, actor: emails.get(row.actor_user_id) ?? null,
      resource: row.resource_type.replaceAll('_', ' '), resourceType: row.resource_type,
      resourceId: row.resource_id,
      detail: row.action.replaceAll('_', ' '),
      previousState: row.previous_state as Record<string, unknown> | null,
      newState: row.new_state as Record<string, unknown> | null,
      createdAt: row.created_at,
    } satisfies AdminAuditRow));
    return { available: true, data: [...generalRows, ...paymentRows]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 150) };
  } catch (error) {
    console.error('[admin] audit query failed', { message: error instanceof Error ? error.message : 'Unknown error' });
    return failed([]);
  }
}
