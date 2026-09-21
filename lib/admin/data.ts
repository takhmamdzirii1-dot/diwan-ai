import 'server-only';

import { notFound } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { getOwnerAccess, isOwnerUser } from '@/lib/auth/owner';
import { AUTO_FALLBACK_CHAIN, PROVIDER_REGISTRY } from '@/lib/ai/image-providers/router';
import { SERVER_PROVIDER_REGISTRY, getProviderConnection, providerConfigurationSummary, resolveServerProvider } from '@/lib/ai/providers/registry';
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
      archived: model.archived,
      routes: [], providerOptions: [], audit: [],
    };
  });
}

export async function getAdminOverview(): Promise<AdminDataResult<AdminOverviewData>> {
  const empty: AdminOverviewData = {
    generatedAt: new Date().toISOString(), totalUsers: null, usersThisMonth: null,
    generations7d: null, generationsPrevious7d: null, successfulJobs7d: null, failedJobs7d: null,
    providerIssues: null, modelsMissingPricing: null, modelsMissingRoute: null, pendingPayments: null,
    providerHealth: null, activeModels: null, testingModels: null, disabledModels: null,
    recentActivity: [], partialFailures: [],
  };
  const client = await requireAdminDataAccess();
  if (!client) return unavailable(empty);

  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const previousWeekStart = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const checked = <T extends { error: unknown }>(result: T) => {
    if (result.error) throw result.error;
    return result;
  };
  const countJobs = (table: string, statusColumn: string, status?: string, from = weekStart, to?: string) => {
    let query = client.from(table).select('id', { count: 'exact', head: true }).gte('created_at', from);
    if (to) query = query.lt('created_at', to);
    if (status) query = query.eq(statusColumn, status);
    return query;
  };

  const groups = await Promise.allSettled([
    (async () => {
      const auth = await allAuthUsers(client);
      return {
        total: auth.truncated ? null : auth.users.length,
        thisMonth: auth.truncated ? null : auth.users.filter((user) => user.created_at >= monthStart).length,
        emails: new Map(auth.users.map((user) => [user.id, user.email ?? null])),
      };
    })(),
    (async () => {
      const results = await Promise.all([
        countJobs('ai_executions', 'state'), countJobs('generations', 'status'),
        countJobs('ai_executions', 'state', undefined, previousWeekStart, weekStart),
        countJobs('generations', 'status', undefined, previousWeekStart, weekStart),
        countJobs('ai_executions', 'state', 'completed'), countJobs('generations', 'status', 'completed'),
        countJobs('ai_executions', 'state', 'failed'), countJobs('generations', 'status', 'failed'),
        client.from('ai_executions').select('id,user_id,model_id,created_at').eq('state', 'failed')
          .order('created_at', { ascending: false }).limit(8),
        client.from('generations').select('id,user_id,model_id,created_at').eq('status', 'failed')
          .order('created_at', { ascending: false }).limit(8),
      ]);
      results.forEach(checked);
      const counts = results.slice(0, 8).map((result) => result.count);
      return {
        current: counts[0] == null || counts[1] == null ? null : counts[0] + counts[1],
        previous: counts[2] == null || counts[3] == null ? null : counts[2] + counts[3],
        successful: counts[4] == null || counts[5] == null ? null : counts[4] + counts[5],
        failed: counts[6] == null || counts[7] == null ? null : counts[6] + counts[7],
        failedExecutions: results[8].data ?? [], failedGenerations: results[9].data ?? [],
      };
    })(),
    (async () => {
      const [pending, audits, orders] = await Promise.all([
        client.from('payment_orders').select('id', { count: 'exact', head: true })
          .eq('status', 'pending').not('submitted_at', 'is', null),
        client.from('payment_audit_log').select('id,payment_order_id,action,metadata,created_at')
          .in('action', ['submitted', 'approved', 'rejected', 'cancelled']).order('created_at', { ascending: false }).limit(24),
        client.from('payment_orders').select('id,user_id,plan_name,order_kind,status')
          .order('created_at', { ascending: false }).limit(300),
      ]);
      [pending, audits, orders].forEach(checked);
      return { pending: pending.count ?? null, audits: audits.data ?? [], orders: orders.data ?? [] };
    })(),
    (async () => {
      const [providers, routes, models] = await Promise.all([
        client.from('provider_runtime_configs').select('provider_id,enabled,emergency_disabled,last_error_code,last_checked_at,display_name,adapter_type,base_endpoint,archived'),
        client.from('model_provider_routes').select('model_key,provider_id,enabled'),
        getEffectiveRuntimeModels(client),
      ]);
      checked(providers);
      checked(routes);
      const enabledProviders = (providers.data ?? []).filter((row) => row.enabled && !row.archived);
      const states = new Map<string, 'ready' | 'degraded' | 'unavailable' | 'misconfigured'>();
      for (const provider of enabledProviders) {
        const id = String(provider.provider_id);
        states.set(id, !providerConfigurationSummary(id, provider).configured ? 'misconfigured'
          : provider.emergency_disabled ? 'unavailable' : provider.last_error_code ? 'degraded' : 'ready');
      }
      const providerHealth = {
        ready: [...states.values()].filter((state) => state === 'ready').length,
        degraded: [...states.values()].filter((state) => state === 'degraded').length,
        unavailable: [...states.values()].filter((state) => state === 'unavailable').length,
        misconfigured: [...states.values()].filter((state) => state === 'misconfigured').length,
        enabled: enabledProviders.length,
      };
      const modelRows = buildAdminModelRows(models, new Map());
      const active = modelRows.filter((model) => model.enabled && !model.archived);
      const usableRoutes = new Set((routes.data ?? []).filter((route) => route.enabled
        && ['ready', 'degraded'].includes(states.get(String(route.provider_id)) ?? '')).map((route) => String(route.model_key)));
      return {
        providerHealth, providers: enabledProviders,
        providerIssues: providerHealth.degraded + providerHealth.unavailable + providerHealth.misconfigured,
        missingPricing: active.filter(isMissingCustomerPricing).length,
        missingRoute: active.filter((model) => !usableRoutes.has(model.key)).length,
        active: active.length,
        testing: active.filter((model) => ['preview', 'beta', 'internal_test'].includes(model.availability)).length,
        disabled: modelRows.filter((model) => !model.enabled && !model.archived).length,
      };
    })(),
    (async () => {
      const audits = await client.from('admin_audit_log').select('id,action,resource_type,resource_id,created_at')
        .order('created_at', { ascending: false }).limit(30);
      checked(audits);
      return audits.data ?? [];
    })(),
  ]);

  const labels = ['users', 'jobs', 'payments', 'configuration', 'activity'];
  const partialFailures = labels.filter((_, index) => groups[index].status === 'rejected');
  groups.forEach((group, index) => {
    if (group.status === 'rejected') console.error('[admin] overview partial query failed', {
      group: labels[index], message: group.reason instanceof Error ? group.reason.message : 'Unknown error',
    });
  });
  if (partialFailures.length === groups.length) return failed({ ...empty, partialFailures });

  const users = groups[0].status === 'fulfilled' ? groups[0].value : null;
  const jobs = groups[1].status === 'fulfilled' ? groups[1].value : null;
  const payments = groups[2].status === 'fulfilled' ? groups[2].value : null;
  const configuration = groups[3].status === 'fulfilled' ? groups[3].value : null;
  const generalAudits = groups[4].status === 'fulfilled' ? groups[4].value : [];
  const emails = users?.emails ?? new Map<string, string | null>();
  const orderById = new Map((payments?.orders ?? []).map((order: any) => [String(order.id), order]));
  const activity: AdminActivity[] = [];

  for (const audit of payments?.audits ?? []) {
    const order: any = orderById.get(String(audit.payment_order_id));
    if (!order) continue;
    const lifecycle = audit.metadata && typeof audit.metadata === 'object'
      ? String((audit.metadata as Record<string, unknown>).lifecycle_type ?? '') : '';
    const title = audit.action === 'submitted' ? 'Payment awaiting review'
      : audit.action === 'rejected' ? 'Payment rejected'
        : audit.action === 'cancelled' ? 'Payment canceled'
          : order.order_kind === 'credit_pack' ? 'Top-up approved'
            : lifecycle === 'upgrade' ? 'Subscription upgraded'
              : lifecycle === 'same_plan_renewal' ? 'Subscription renewed' : 'New subscription';
    activity.push({
      id: `payment:${audit.id}`, kind: order.order_kind === 'credit_pack' ? 'credit' : lifecycle ? 'subscription' : 'payment',
      title, context: `${emails.get(String(order.user_id)) ?? 'Customer'} · ${order.plan_name}`,
      status: audit.action === 'submitted' ? 'pending' : audit.action, createdAt: audit.created_at,
      href: `/admin/payments?view=payments&status=${audit.action === 'submitted' ? 'pending' : audit.action}`,
    });
  }
  for (const row of [...(jobs?.failedExecutions ?? []), ...(jobs?.failedGenerations ?? [])]) activity.push({
    id: `generation:${row.id}`, kind: 'generation', title: 'Generation failed',
    context: `${emails.get(String(row.user_id)) ?? 'Customer'} · ${MODEL_NAMES.get(row.model_id) ?? row.model_id}`,
    status: 'failed', createdAt: row.created_at, href: `/admin/jobs?range=7d&status=failed&q=${encodeURIComponent(row.id)}`,
  });
  for (const provider of configuration?.providers ?? []) {
    const state = !providerConfigurationSummary(String(provider.provider_id), provider).configured ? 'misconfigured'
      : provider.emergency_disabled ? 'unavailable' : provider.last_error_code ? 'degraded' : null;
    if (!state || !provider.last_checked_at) continue;
    activity.push({ id: `provider:${provider.provider_id}:${provider.last_checked_at}`, kind: 'provider',
      title: `Provider ${state}`, context: String(provider.display_name ?? provider.provider_id), status: state,
      createdAt: provider.last_checked_at, href: '/admin/providers' });
  }
  for (const audit of generalAudits) {
    const resource = String(audit.resource_type);
    const isModel = resource === 'model';
    const isProvider = resource === 'provider';
    const isPlan = resource === 'payment_plan' || resource === 'plan';
    const isCredit = String(audit.action).includes('credit');
    if (!isModel && !isProvider && !isPlan && !isCredit) continue;
    activity.push({ id: `admin:${audit.id}`, kind: isModel ? 'model' : isProvider ? 'provider' : isPlan ? 'plan' : 'credit',
      title: isModel ? 'Model updated' : isProvider ? 'Provider updated' : isPlan ? 'Plan updated' : 'Credit adjustment',
      context: String(audit.resource_id).replaceAll('_', ' '), status: 'updated', createdAt: audit.created_at,
      href: isModel ? '/admin/models' : isProvider ? '/admin/providers' : isPlan ? '/admin/payments?view=plans' : `/admin/users?q=${encodeURIComponent(audit.resource_id)}` });
  }

  return { available: true, data: {
    generatedAt: now.toISOString(), totalUsers: users?.total ?? null, usersThisMonth: users?.thisMonth ?? null,
    generations7d: jobs?.current ?? null, generationsPrevious7d: jobs?.previous ?? null,
    successfulJobs7d: jobs?.successful ?? null, failedJobs7d: jobs?.failed ?? null,
    providerIssues: configuration?.providerIssues ?? null, modelsMissingPricing: configuration?.missingPricing ?? null,
    modelsMissingRoute: configuration?.missingRoute ?? null, pendingPayments: payments?.pending ?? null,
    providerHealth: configuration?.providerHealth ?? null, activeModels: configuration?.active ?? null,
    testingModels: configuration?.testing ?? null, disabledModels: configuration?.disabled ?? null,
    recentActivity: activity.sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 5),
    partialFailures,
  } };
}

export async function getAdminProviders(): Promise<AdminDataResult<AdminProviderRow[]>> {
  const client = await requireAdminDataAccess();
  try {
    const [attempts, costs, runtimeConfigs, routes] = client ? await Promise.all([
      allRows(client, 'provider_attempts', 'provider,state,error_message,started_at,finished_at'),
      allRows(client, 'provider_cost_records', 'provider,actual_cost_minor,currency,created_at'),
      allRows(client, 'provider_runtime_configs', 'provider_id,display_name,adapter_type,base_endpoint,archived,enabled,priority,emergency_disabled,daily_spend_limit_minor,spend_currency,last_error_code,last_checked_at'),
      allRows(client, 'model_provider_routes', 'model_key,model_id,provider_id,provider_model_id'),
    ]) : [[], [], [], []];
    const groupedCosts = costs.length >= PAGE_SIZE * MAX_PAGES ? new Map<string, CostAmount[]>() : groupCosts(costs);
    const configByProvider = new Map(runtimeConfigs.map((row) => [String(row.provider_id), row]));
    const providerIds = [...new Set([
      ...SERVER_PROVIDER_REGISTRY.map((provider) => provider.id),
      ...runtimeConfigs.map((row) => String(row.provider_id)),
    ])];
    const definitions = providerIds.map((providerId) => {
      const config = configByProvider.get(providerId);
      const provider = resolveServerProvider(providerId, config);
      const connection = providerConfigurationSummary(providerId, config);
      const enabled = Boolean(config?.enabled);
      return {
        id: providerId,
        name: provider?.name ?? String(config?.display_name ?? providerId),
        modalities: [...(provider?.modalities ?? [])],
        adapterType: provider?.adapter ?? String(config?.adapter_type ?? 'not-connected'),
        baseEndpoint: getProviderConnection(providerId, config)?.baseUrl ?? (config?.base_endpoint ? String(config.base_endpoint) : null),
        archived: Boolean(config?.archived),
        testSupported: provider?.adapter === 'openai-compatible-chat',
        enabled,
        configured: connection.configured,
        priority: Number(config?.priority ?? 100),
        emergencyDisabled: Boolean(config?.emergency_disabled),
        dailySpendLimitMinor: config?.daily_spend_limit_minor == null
          ? null : numericString(config.daily_spend_limit_minor),
        spendCurrency: config?.spend_currency == null ? null : String(config.spend_currency),
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
      const status: AdminProviderRow['status'] = provider.archived || !provider.enabled || provider.emergencyDisabled
        ? 'disabled' : !provider.configured ? 'misconfigured'
          : runtimeFailure ? 'unavailable' : 'ready';
      const associatedModels = routes
        .filter((route) => String(route.provider_id) === provider.id)
        .map((route) => {
          const key = String(route.model_key);
          const providerModelId = String(route.provider_model_id);
          return { key, name: MODEL_NAMES.get(key) ?? MODEL_NAMES.get(providerModelId) ?? key, providerModelId };
        })
        .filter((route, index, all) => all.findIndex((candidate) => candidate.key === route.key
          && candidate.providerModelId === route.providerModelId) === index);
      return {
        id: provider.id, name: provider.name, modalities: provider.modalities,
        adapterType: provider.adapterType, baseEndpoint: provider.baseEndpoint,
        archived: provider.archived,
        routeCount: routes.filter((route) => String(route.provider_id) === provider.id).length,
        testSupported: provider.testSupported,
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
    const [costs, routes, providerConfigs, modelAudits] = client ? await Promise.all([
      allRows(client, 'provider_cost_records', 'provider,provider_model,actual_cost_minor,currency,created_at'),
      allRows(client, 'model_provider_routes', 'id,model_key,provider_id,provider_model_id,enabled,priority,fallback'),
      allRows(client, 'provider_runtime_configs', 'provider_id,display_name,adapter_type,base_endpoint,archived,enabled,emergency_disabled'),
      client.from('admin_audit_log').select('id,action,resource_id,previous_state,new_state,created_at').eq('resource_type', 'model').order('created_at', { ascending: false }).limit(500),
    ]) : [[], [], [], { data: [], error: null }];
    if (modelAudits.error) console.warn('[admin] model audit history unavailable', { message: modelAudits.error.message });
    const providerEnabled = new Map(providerConfigs.map((row) => [String(row.provider_id), Boolean(row.enabled) && !Boolean(row.archived) && !Boolean(row.emergency_disabled)]));
    const providerDefinitions = [...new Set([
      ...SERVER_PROVIDER_REGISTRY.map((provider) => provider.id),
      ...providerConfigs.map((row) => String(row.provider_id)),
    ])].map((id) => {
      const config = providerConfigs.find((row) => String(row.provider_id) === id);
      return { id, config, provider: resolveServerProvider(id, config) };
    }).filter((entry) => entry.provider && !entry.config?.archived);
    const rows = buildAdminModelRows(
      client ? await getEffectiveRuntimeModels(client) : applyModelRuntimeOverrides([]),
      latestCostsByModel(costs),
    ).map((model) => ({
      ...model,
      audit: (modelAudits.data ?? []).filter((audit) => audit.resource_id === model.key).map((audit) => ({
        id: String(audit.id), action: String(audit.action), createdAt: String(audit.created_at),
        previousState: audit.previous_state && typeof audit.previous_state === 'object' ? audit.previous_state as Record<string, unknown> : null,
        newState: audit.new_state && typeof audit.new_state === 'object' ? audit.new_state as Record<string, unknown> : null,
      })),
      providerOptions: providerDefinitions
        .filter(({ provider }) => provider!.modalities.some((modality) => modality === model.modality))
        .map(({ id, config, provider }) => ({
          id,
          name: provider!.name,
          configured: providerConfigurationSummary(id, config).configured,
          enabled: providerEnabled.get(id) ?? false,
        })),
      routes: routes.filter((route) => String(route.model_key) === model.key).map((route) => ({
        id: String(route.id),
        providerId: String(route.provider_id),
        providerModelId: String(route.provider_model_id),
        enabled: Boolean(route.enabled),
        priority: Number(route.priority),
        fallback: Boolean(route.fallback),
        configured: providerConfigurationSummary(String(route.provider_id), providerConfigs.find((provider) => String(provider.provider_id) === String(route.provider_id))).configured,
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
      allAuthUsers(client), allRows(client, 'credits', 'user_id,balance,subscription_balance,subscription_rollover_balance,purchased_balance,free_image_remaining,free_video_remaining,lite_video_remaining'),
      allRows(client, 'usage_records', 'user_id,credits_charged'), allRows(client, 'generations', 'user_id'),
      allRows(client, 'ai_executions', 'user_id'),
      allRows(client, 'payment_orders', 'user_id'),
      allRows(client, 'user_entitlements', 'user_id,plan_name,status,starts_at,ends_at'),
    ]);
    const balances = new Map(credits.map((row) => [row.user_id, row]));
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
        const userBalances = balances.get(user.id);
        const rawDisplayName = user.user_metadata?.full_name ?? user.user_metadata?.display_name ?? user.user_metadata?.name;
        return {
          id: user.id, email: user.email ?? '—', plan: plansByUser.get(user.id)?.name ?? 'Free',
          displayName: typeof rawDisplayName === 'string' && rawDisplayName.trim() ? rawDisplayName.trim() : null,
          emailConfirmed: Boolean(user.email_confirmed_at),
          isOwner: isOwnerUser(user), creditBalance: userBalances ? numericString(userBalances.balance) : null,
          subscriptionBalance: userBalances ? numericString(userBalances.subscription_balance) : null,
          subscriptionRolloverBalance: userBalances ? numericString(userBalances.subscription_rollover_balance) : null,
          purchasedBalance: userBalances ? numericString(userBalances.purchased_balance) : null,
          freeImageRemaining: userBalances?.free_image_remaining == null ? null : Number(userBalances.free_image_remaining),
          freeVideoRemaining: userBalances?.free_video_remaining == null ? null : Number(userBalances.free_video_remaining),
          liteVideoRemaining: userBalances?.lite_video_remaining == null ? null : Number(userBalances.lite_video_remaining),
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
  q?: string; status?: string; modality?: string; provider?: string; model?: string; range?: string; cursor?: string; seen?: string;
} = {}): Promise<AdminDataResult<AdminJobsData>> {
  const empty: AdminJobsData = { jobs: [], nextCursor: null, total: 0 };
  const client = await requireAdminDataAccess();
  if (!client) return unavailable(empty);
  try {
    const [auth, effectiveModels] = await Promise.all([allAuthUsers(client), getEffectiveRuntimeModels(client)]);
    const visibleNames = new Map<string, string | null>();
    effectiveModels.forEach((model) => visibleNames.set(model.modelId,
      visibleNames.has(model.modelId) ? null : model.displayName));
    const emails = new Map(auth.users.map((user) => [user.id, user.email ?? null]));
    const rawQuery = (filters.q ?? '').trim().slice(0, 80);
    const q = rawQuery.replace(/[^\w@.:/\-]/g, '');
    const seen = filters.cursor && /^\d{1,6}$/.test(filters.seen ?? '') ? Number(filters.seen) : 0;
    const matchingUsers = q ? auth.users.filter((user) => user.email?.toLowerCase().includes(q.toLowerCase()) || user.id === q).slice(0, 30).map((user) => user.id) : [];
    const matchingModels = rawQuery ? effectiveModels.filter((model) => model.displayName.toLowerCase().includes(rawQuery.toLowerCase())).slice(0, 30).map((model) => model.modelId) : [];
    const cursor = filters.cursor && !Number.isNaN(Date.parse(filters.cursor)) ? filters.cursor : null;
    const rangeStart = filters.range === 'all' ? null : new Date(Date.now() - (filters.range === '30d' ? 30 : 7) * 86_400_000).toISOString();
    let executionsQuery = client.from('ai_executions')
      .select('id,user_id,operation_key,modality,model_id,provider_id,provider_model_id,reservation_id,state,credits_charged,error_code,execution_metadata,created_at,updated_at,completed_at', { count: 'exact' })
      .order('created_at', { ascending: false }).limit(51);
    if (cursor) executionsQuery = executionsQuery.lt('created_at', cursor);
    if (rangeStart) executionsQuery = executionsQuery.gte('created_at', rangeStart);
    if (filters.status && filters.status !== 'all') executionsQuery = executionsQuery.eq('state', filters.status);
    if (filters.modality && filters.modality !== 'all') executionsQuery = executionsQuery.eq('modality', filters.modality);
    if (filters.provider && filters.provider !== 'all') executionsQuery = executionsQuery.eq('provider_id', filters.provider);
    if (filters.model && filters.model !== 'all') executionsQuery = executionsQuery.eq('model_id', filters.model);
    if (q) {
      const clauses = [`model_id.ilike.%${q}%`, `provider_id.ilike.%${q}%`, `operation_key.ilike.%${q}%`];
      if (/^[0-9a-f-]{36}$/i.test(q)) clauses.push(`id.eq.${q}`);
      if (matchingUsers.length) clauses.push(`user_id.in.(${matchingUsers.join(',')})`);
      if (matchingModels.length) clauses.push(`model_id.in.(${matchingModels.join(',')})`);
      executionsQuery = executionsQuery.or(clauses.join(','));
    }
    let generationsQuery = client.from('generations')
      .select('id,user_id,type,prompt,model_id,status,metadata,error_message,created_at,updated_at', { count: 'exact' })
      .order('created_at', { ascending: false }).limit(51);
    if (cursor) generationsQuery = generationsQuery.lt('created_at', cursor);
    if (rangeStart) generationsQuery = generationsQuery.gte('created_at', rangeStart);
    if (filters.status && filters.status !== 'all') generationsQuery = generationsQuery.eq('status', filters.status);
    if (filters.modality && filters.modality !== 'all') generationsQuery = generationsQuery.eq('type', filters.modality);
    if (filters.model && filters.model !== 'all') generationsQuery = generationsQuery.eq('model_id', filters.model);
    if (filters.provider && filters.provider !== 'all') generationsQuery = generationsQuery.eq('metadata->>provider', filters.provider);
    if (q) {
      const clauses = [`model_id.ilike.%${q}%`];
      if (/^[0-9a-f-]{36}$/i.test(q)) clauses.push(`id.eq.${q}`);
      if (matchingUsers.length) clauses.push(`user_id.in.(${matchingUsers.join(',')})`);
      if (matchingModels.length) clauses.push(`model_id.in.(${matchingModels.join(',')})`);
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
        vantraModelName: visibleNames.get(row.model_id) ?? null,
        status: row.state,
        providerCost: cost?.actual_cost_minor == null ? null : { currency: cost.currency, minor: numericString(cost.actual_cost_minor) },
        creditsCharged: row.credits_charged == null && usageRecord?.credits_charged == null ? null : numericString(row.credits_charged ?? usageRecord.credits_charged),
        latencyMs: row.completed_at ? Math.max(0, new Date(row.completed_at).getTime() - new Date(row.created_at).getTime()) : null,
        error: row.error_code, prompt: null, createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at,
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
        vantraModelName: visibleNames.get(row.model_id) ?? null,
        status: row.status, providerCost: null, creditsCharged: null, latencyMs: null,
        error: row.error_message, prompt: row.prompt,
        createdAt: row.created_at, updatedAt: row.updated_at, completedAt: null,
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
        .select('id,user_id,plan_id,plan_name,order_kind,payment_method,amount_dzd,credits_amount,entitlement,payment_reference,customer_reference,proof_storage_path,status,submitted_at,reviewed_at,reviewed_by,review_note,resulting_credit_transaction_id,resulting_entitlement_id,created_at')
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
        entitlementSnapshot: order.entitlement && typeof order.entitlement === 'object' ? order.entitlement : null,
        paymentReference: order.payment_reference,
        customerReference: order.customer_reference,
        proofUrl,
        proofStoragePath: order.proof_storage_path,
        status: order.status === 'draft' || (order.status === 'pending' && !order.submitted_at)
          ? 'incomplete' : order.status,
        submittedAt: order.submitted_at,
        reviewedAt: order.reviewed_at,
        reviewedBy: order.reviewed_by,
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
    const current = await client.from('payment_plans')
      .select('id,slug,name,description,kind,price_dzd,unified_credits,subscription_credit_allowance,included_video_allowance,active,display_order,featured')
      .order('display_order').order('created_at');
    const missingVideoColumn = current.error?.code === '42703'
      && current.error.message.includes('included_video_allowance');
    const { data, error } = missingVideoColumn
      ? await client.from('payment_plans')
        .select('id,slug,name,description,kind,price_dzd,unified_credits,subscription_credit_allowance,active,display_order,featured')
        .order('display_order').order('created_at')
      : current;
    if (error) throw error;
    return { available: true, data: (data ?? []).map((plan) => ({
      id: plan.id, slug: plan.slug, name: plan.name, description: plan.description,
      kind: plan.kind, priceDzd: plan.price_dzd, unifiedCredits: Number(plan.unified_credits),
      subscriptionCreditAllowance: plan.subscription_credit_allowance == null ? null : Number(plan.subscription_credit_allowance),
      includedVideoAllowance: 'included_video_allowance' in plan && plan.included_video_allowance != null
        ? Number(plan.included_video_allowance) : null,
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
