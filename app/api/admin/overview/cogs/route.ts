import { NextResponse } from 'next/server';
import { getOwnerAccess } from '@/lib/auth/owner';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';

export const dynamic = 'force-dynamic';

type CostRow = { reservation_id: string; provider: string; provider_model: string; actual_cost_minor: number | string | null; currency: string };
type Group = { name: string; currency: string; minor: string; records: number };

export async function GET() {
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  const start = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const costs = await client.from('provider_cost_records')
    .select('reservation_id,provider,provider_model,actual_cost_minor,currency')
    .gte('created_at', start).not('actual_cost_minor', 'is', null)
    .order('created_at', { ascending: false }).limit(1001);
  if (costs.error) return NextResponse.json({ error: 'COGS_UNAVAILABLE' }, { status: 503 });
  const truncated = (costs.data ?? []).length > 1000;
  const rows = (costs.data ?? []).slice(0, 1000) as CostRow[];
  const reservationIds = rows.map((row) => row.reservation_id);
  const reservations = reservationIds.length ? await client.from('credit_reservations')
    .select('id,allowance_entitlement_id,funding_source').in('id', reservationIds) : { data: [], error: null };
  if (reservations.error) return NextResponse.json({ error: 'COGS_UNAVAILABLE' }, { status: 503 });
  const reservationById = new Map((reservations.data ?? []).map((row) => [row.id, row]));
  const entitlementIds = [...new Set((reservations.data ?? []).map((row) => row.allowance_entitlement_id).filter((id): id is string => Boolean(id)))];
  const entitlements = entitlementIds.length ? await client.from('user_entitlements')
    .select('id,plan_id').in('id', entitlementIds) : { data: [], error: null };
  if (entitlements.error) return NextResponse.json({ error: 'COGS_UNAVAILABLE' }, { status: 503 });
  const planIds = [...new Set((entitlements.data ?? []).map((row) => row.plan_id))];
  const plans = planIds.length ? await client.from('payment_plans')
    .select('id,plan_code').in('id', planIds) : { data: [], error: null };
  if (plans.error) return NextResponse.json({ error: 'COGS_UNAVAILABLE' }, { status: 503 });
  const planById = new Map((plans.data ?? []).map((row) => [row.id, row.plan_code]));
  const planByEntitlement = new Map((entitlements.data ?? []).map((row) => [row.id, planById.get(row.plan_id) ?? 'Unknown']));
  const groups = { plan: new Map<string, { minor: bigint; records: number }>(),
    model: new Map<string, { minor: bigint; records: number }>(),
    provider: new Map<string, { minor: bigint; records: number }>() };
  const usdCosts: bigint[] = [];
  for (const row of rows) {
    let minor: bigint;
    try { minor = BigInt(String(row.actual_cost_minor)); } catch { continue; }
    if (minor < 0n || !/^[A-Z]{3}$/.test(row.currency)) continue;
    const reservation = reservationById.get(row.reservation_id);
    const plan = reservation?.allowance_entitlement_id
      ? planByEntitlement.get(reservation.allowance_entitlement_id) ?? 'Unknown'
      : reservation?.funding_source?.startsWith('free_trial_') ? 'Free' : 'Unknown';
    for (const [dimension, name] of [
      ['plan', plan], ['model', row.provider_model], ['provider', row.provider],
    ] as const) {
      const key = `${row.currency}:${name || 'Unknown'}`;
      const current = groups[dimension].get(key) ?? { minor: 0n, records: 0 };
      groups[dimension].set(key, { minor: current.minor + minor, records: current.records + 1 });
    }
    if (row.currency === 'USD') usdCosts.push(minor);
  }
  const serialize = (group: Map<string, { minor: bigint; records: number }>): Group[] =>
    [...group.entries()].map(([key, value]) => ({ name: key.slice(4), currency: key.slice(0, 3),
      minor: value.minor.toString(), records: value.records }))
      .sort((a, b) => BigInt(b.minor) > BigInt(a.minor) ? 1 : BigInt(b.minor) < BigInt(a.minor) ? -1 : 0);
  usdCosts.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const percentile = (p: number) => usdCosts[Math.ceil(usdCosts.length * p) - 1]?.toString() ?? null;
  return NextResponse.json({ groups: { plan: serialize(groups.plan), model: serialize(groups.model), provider: serialize(groups.provider) },
    percentiles: usdCosts.length >= 20 && !truncated ? { p50: percentile(.5), p90: percentile(.9), p99: percentile(.99) } : null,
    recordedJobs: rows.length, truncated, window: '7d' },
    { headers: { 'Cache-Control': 'private, no-store' } });
}
