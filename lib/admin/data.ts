import 'server-only';

import { notFound } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { getOwnerAccess } from '@/lib/auth/owner';
import { AUTO_FALLBACK_CHAIN, PROVIDER_REGISTRY } from '@/lib/ai/image-providers/router';
import {
  DEFAULT_CHAT_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  STUDIO_MODELS,
} from '@/src/config/studio-registry';
import { getSupabaseAdminClient } from './supabase-admin';
import type {
  AdminActivity,
  AdminDataResult,
  AdminJobRow,
  AdminModelRow,
  AdminOverviewData,
  AdminPaymentRow,
  AdminPaymentPlan,
  AdminProviderRow,
  AdminUserRow,
  AdminUsersData,
  CostAmount,
} from './types';

const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

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

export async function getAdminOverview(): Promise<AdminDataResult<AdminOverviewData>> {
  const empty: AdminOverviewData = {
    totalUsers: null, totalGenerations: null, successfulJobs: null, failedJobs: null,
    creditsConsumed: null, providerCosts: [], recentActivity: [],
  };
  const client = await requireAdminDataAccess();
  if (!client) return unavailable(empty);

  try {
    const [auth, generations, usage, costs, transactions, generationCount, completedCount, failedCount] = await Promise.all([
      allAuthUsers(client),
      client.from('generations').select('id,type,model_id,status,error_message,created_at')
        .order('created_at', { ascending: false }).limit(8),
      allRows(client, 'usage_records', 'credits_charged,created_at'),
      allRows(client, 'provider_cost_records', 'provider,actual_cost_minor,currency,created_at'),
      client.from('credit_transactions').select('id,transaction_type,amount,reason,created_at')
        .order('created_at', { ascending: false }).limit(8),
      client.from('generations').select('id', { count: 'exact', head: true }),
      client.from('generations').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      client.from('generations').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    ]);
    for (const result of [generations, transactions, generationCount, completedCount, failedCount]) {
      if (result.error) throw result.error;
    }
    const generationActivity: AdminActivity[] = (generations.data ?? [])
      .map((row) => ({
        id: `generation:${row.id}`, kind: 'generation', label: `${row.type} · ${row.model_id}`,
        detail: row.error_message ?? row.status, status: row.status, createdAt: row.created_at,
      }));
    const creditActivity: AdminActivity[] = (transactions.data ?? []).map((row: any) => ({
      id: `credit:${row.id}`, kind: 'credit', label: row.transaction_type,
      detail: `${numericString(row.amount)} · ${row.reason}`, status: row.transaction_type, createdAt: row.created_at,
    }));

    return { available: true, data: {
      totalUsers: auth.truncated ? null : auth.users.length,
      totalGenerations: generationCount.count ?? null,
      successfulJobs: completedCount.count ?? null,
      failedJobs: failedCount.count ?? null,
      creditsConsumed: usage.length >= PAGE_SIZE * MAX_PAGES ? null : sumIntegerValues(usage, 'credits_charged'),
      providerCosts: totalCosts(costs),
      recentActivity: [...generationActivity, ...creditActivity]
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
    const [attempts, costs] = client ? await Promise.all([
      allRows(client, 'provider_attempts', 'provider,state,error_message,started_at,finished_at'),
      allRows(client, 'provider_cost_records', 'provider,actual_cost_minor,currency,created_at'),
    ]) : [[], []];
    const groupedCosts = groupCosts(costs);
    const imageDefinitions = Object.values(PROVIDER_REGISTRY).map((provider) => ({
      id: provider.id, name: provider.name, modalities: ['image'],
      enabled: provider.id === 'runware' ? Boolean(process.env.RUNWARE_API_KEY) : true,
      configured: provider.id === 'runware' ? Boolean(process.env.RUNWARE_API_KEY)
        : provider.id === 'mock' || provider.id === 'puter' || !provider.requiresApiKey,
      statusOverride: provider.id === 'mock' ? 'demo' as const : provider.clientSide ? 'client_managed' as const : null,
      role: AUTO_FALLBACK_CHAIN[0] === provider.id ? 'primary' as const
        : AUTO_FALLBACK_CHAIN.slice(1).includes(provider.id) ? 'backup' as const
          : provider.id === 'puter' ? 'optional' as const : 'unassigned' as const,
    }));
    const definitions = [{
      id: 'openrouter', name: 'OpenRouter', modalities: ['chat'],
      enabled: Boolean(process.env.OPENROUTER_API_KEY), configured: Boolean(process.env.OPENROUTER_API_KEY),
      statusOverride: null, role: 'primary' as const,
    }, ...imageDefinitions];

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
      const status = provider.statusOverride ?? (!provider.configured ? 'unconfigured'
        : lastAttempt?.state === 'failed' ? 'attention' : providerAttempts.length ? 'healthy' : 'idle');
      return {
        id: provider.id, name: provider.name, modalities: provider.modalities,
        enabled: provider.enabled, status, role: provider.role,
        requestCount: providerAttempts.length, failures: failures.length,
        averageLatencyMs: completedDurations.length
          ? Math.round(completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length) : null,
        accumulatedCosts: groupedCosts.get(provider.id.toLowerCase()) ?? [],
        lastError: lastFailure?.error_message ?? null,
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
    const costs = client
      ? await allRows(client, 'provider_cost_records', 'provider,provider_model,actual_cost_minor,currency,created_at')
      : [];
    const latestCostByModel = new Map<string, CostAmount>();
    costs.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).forEach((row) => {
      const key = String(row.provider_model);
      if (!latestCostByModel.has(key) && row.actual_cost_minor != null) {
        latestCostByModel.set(key, { currency: String(row.currency), minor: numericString(row.actual_cost_minor) });
      }
    });
    const defaultIds = new Set([DEFAULT_CHAT_MODEL?.id, DEFAULT_IMAGE_MODEL?.id, DEFAULT_VIDEO_MODEL?.id].filter(Boolean));
    const registeredIds = new Set(STUDIO_MODELS.map((model) => model.id));
    const rows: AdminModelRow[] = STUDIO_MODELS.map((model) => ({
      key: `studio:${model.modality}:${model.id}`, provider: model.provider, modelId: model.id,
      displayName: model.displayName, modality: model.modality, enabled: model.enabled,
      availability: model.availability, providerCost: latestCostByModel.get(model.id) ?? null,
      creditPrice: model.verifiedCreditCost ?? null,
      priority: defaultIds.has(model.id) ? 'primary' : model.fallbackAvailable ? 'backup' : 'unassigned',
    }));
    for (const provider of Object.values(PROVIDER_REGISTRY)) {
      for (const model of provider.models) {
        if (registeredIds.has(model.id)) continue;
        rows.push({
          key: `provider:${provider.id}:${model.id}`, provider: provider.name, modelId: model.id,
          displayName: model.name, modality: 'image', enabled: false,
          availability: provider.id === 'runware' ? 'internal_test' : 'not_in_studio',
          providerCost: latestCostByModel.get(model.id) ?? null, creditPrice: null, priority: 'unassigned',
        });
      }
    }
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
    const [auth, credits, usage, generations] = await Promise.all([
      allAuthUsers(client), allRows(client, 'credits', 'user_id,balance'),
      allRows(client, 'usage_records', 'user_id,credits_charged'), allRows(client, 'generations', 'user_id'),
    ]);
    const balances = new Map(credits.map((row) => [row.user_id, numericString(row.balance)]));
    const usageByUser = new Map<string, bigint>();
    usage.forEach((row) => usageByUser.set(row.user_id,
      (usageByUser.get(row.user_id) ?? 0n) + BigInt(numericString(row.credits_charged))));
    const generationsByUser = new Map<string, number>();
    generations.forEach((row) => generationsByUser.set(row.user_id, (generationsByUser.get(row.user_id) ?? 0) + 1));
    const now = Date.now();
    const normalizedQuery = query.trim().toLowerCase();
    const users: AdminUserRow[] = auth.users
      .filter((user) => !normalizedQuery || user.email?.toLowerCase().includes(normalizedQuery) || user.id.includes(normalizedQuery))
      .slice(0, 100).map((user) => {
        const bannedUntil = user.banned_until ? new Date(user.banned_until).getTime() : 0;
        return {
          id: user.id, email: user.email ?? '—', plan: 'Free', creditBalance: balances.get(user.id) ?? null,
          creditsUsed: (usageByUser.get(user.id) ?? 0n).toString(), generationCount: generationsByUser.get(user.id) ?? 0,
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

export async function getAdminJobs(): Promise<AdminDataResult<AdminJobRow[]>> {
  const client = await requireAdminDataAccess();
  if (!client) return unavailable([]);
  try {
    const [generations, outbox, attempts, costs] = await Promise.all([
      client.from('generations').select('id,user_id,type,prompt,model_id,status,metadata,error_message,created_at,updated_at')
        .order('created_at', { ascending: false }).limit(100),
      client.from('provider_dispatch_outbox').select('id,reservation_id,user_id,modality,model_id,state,last_error,created_at,updated_at')
        .order('created_at', { ascending: false }).limit(100),
      client.from('provider_attempts').select('outbox_id,provider,state,error_message,started_at,finished_at')
        .order('started_at', { ascending: false }).limit(300),
      client.from('provider_cost_records').select('reservation_id,provider,provider_model,actual_cost_minor,currency,created_at')
        .order('created_at', { ascending: false }).limit(300),
    ]);
    for (const result of [generations, outbox, attempts, costs]) if (result.error) throw result.error;
    const latestAttempt = new Map<string, any>();
    (attempts.data ?? []).forEach((attempt: any) => { if (!latestAttempt.has(attempt.outbox_id)) latestAttempt.set(attempt.outbox_id, attempt); });
    const costByReservation = new Map<string, any>();
    (costs.data ?? []).forEach((cost: any) => { if (!costByReservation.has(cost.reservation_id)) costByReservation.set(cost.reservation_id, cost); });
    const dispatchRows: AdminJobRow[] = (outbox.data ?? []).map((row: any) => {
      const attempt = latestAttempt.get(row.id);
      const cost = costByReservation.get(row.reservation_id);
      return {
        id: row.id, source: 'dispatch', userId: row.user_id, modality: row.modality,
        provider: attempt?.provider ?? cost?.provider ?? null, modelId: row.model_id,
        status: attempt?.state ?? row.state,
        providerCost: cost?.actual_cost_minor == null ? null : { currency: cost.currency, minor: numericString(cost.actual_cost_minor) },
        error: attempt?.error_message ?? row.last_error ?? null, prompt: null, createdAt: row.created_at,
        updatedAt: attempt?.finished_at ?? row.updated_at,
      };
    });
    const generationRows: AdminJobRow[] = (generations.data ?? []).map((row: any) => {
      const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
      return {
        id: row.id, source: 'generation', userId: row.user_id, modality: row.type,
        provider: typeof metadata.provider === 'string' ? metadata.provider : null, modelId: row.model_id,
        status: row.status, providerCost: null, error: row.error_message, prompt: row.prompt,
        createdAt: row.created_at, updatedAt: row.updated_at,
      };
    });
    return { available: true, data: [...dispatchRows, ...generationRows]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 150) };
  } catch (error) {
    console.error('[admin] jobs query failed', { message: error instanceof Error ? error.message : 'Unknown error' });
    return failed([]);
  }
}

export async function getAdminPayments(): Promise<AdminDataResult<AdminPaymentRow[]>> {
  const client = await requireAdminDataAccess();
  if (!client) return unavailable([]);
  try {
    const [orders, audits, auth] = await Promise.all([
      client.from('payment_orders')
        .select('id,user_id,plan_id,plan_name,order_kind,amount_dzd,credits_amount,payment_reference,customer_reference,proof_storage_path,status,submitted_at,reviewed_at,review_note,resulting_credit_transaction_id,resulting_entitlement_id,created_at')
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
        amountDzd: order.amount_dzd,
        creditsAmount: order.credits_amount == null ? null : numericString(order.credits_amount),
        paymentReference: order.payment_reference,
        customerReference: order.customer_reference,
        proofUrl,
        status: order.status,
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
