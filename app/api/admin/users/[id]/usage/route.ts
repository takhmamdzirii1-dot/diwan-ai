import { NextResponse } from 'next/server';
import { getOwnerAccess } from '@/lib/auth/owner';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { listUserUsageRows } from '@/lib/admin/user-usage-data';
import { currentPlanView, inUsageRange, settledBucketTotal, summarizeChat, summarizeMedia, summarizeTrials, usageRangeStart, type ChatRecord, type UsageRange } from '@/lib/admin/user-usage';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getOwnerAccess();
  if (!access.user) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  if (!access.isOwner) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'INVALID_USER_ID' }, { status: 400 });
  const rangeValue = new URL(request.url).searchParams.get('range') ?? 'cycle';
  if (!['cycle', '7d', '30d', 'all'].includes(rangeValue)) {
    return NextResponse.json({ error: 'INVALID_RANGE' }, { status: 400 });
  }
  const range = rangeValue as UsageRange;
  const client = getSupabaseAdminClient();
  if (!client) return NextResponse.json({ error: 'ADMIN_DATA_UNAVAILABLE' }, { status: 503 });
  try {
    const [auth, account, entitlements, periods, limitsResult, modelsResult] = await Promise.all([
      client.auth.admin.getUserById(id),
      client.from('credits').select('subscription_balance,subscription_rollover_balance,purchased_balance,free_image_remaining,free_video_remaining,lite_video_remaining,subscription_entitlement_id,lite_video_entitlement_id').eq('user_id', id).maybeSingle(),
      client.from('user_entitlements').select('id,plan_name,status,starts_at,ends_at,plan_id,payment_plans(plan_code)').eq('user_id', id).order('starts_at', { ascending: false }).limit(50),
      client.from('subscription_periods').select('entitlement_id,plan_code,period_starts_at,period_ends_at,base_allowance,rollover_amount,included_videos,state').eq('user_id', id).eq('state', 'active').maybeSingle(),
      client.from('chat_plan_limits').select('plan_code,five_hour_limit,weekly_limit'),
      client.from('model_runtime_configs').select('model_key,model_id,customer_display_name,modality'),
    ]);
    if (auth.error || !auth.data.user) return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
    if ([account, entitlements, periods, limitsResult, modelsResult].some((item) => item.error)) throw new Error('USAGE_SOURCE_UNAVAILABLE');
    const nowMs = Date.now();
    const active = (entitlements.data ?? []).find((item) => item.status === 'active'
      && Date.parse(item.starts_at) <= nowMs && (!item.ends_at || Date.parse(item.ends_at) > nowMs));
    const planRelation = active?.payment_plans as { plan_code?: string } | { plan_code?: string }[] | null;
    const plan = active ? (Array.isArray(planRelation) ? planRelation[0]?.plan_code : planRelation?.plan_code) ?? 'free' : 'free';
    const planView = currentPlanView(active ? { planCode: plan, startsAt: active.starts_at, endsAt: active.ends_at } : null,
      !active && entitlements.data?.length ? { name: entitlements.data[0].plan_name,
        status: entitlements.data[0].ends_at && Date.parse(entitlements.data[0].ends_at) <= nowMs ? 'expired' : entitlements.data[0].status } : null,
      auth.data.user.created_at);
    const period = periods.data?.entitlement_id === active?.id ? periods.data : null;
    const start = usageRangeStart(range, nowMs, period?.period_starts_at ?? active?.starts_at ?? auth.data.user.created_at);
    const weekStart = new Date(nowMs - 7 * 86_400_000).toISOString();
    const chatStart = !start || Date.parse(start) < Date.parse(weekStart) ? start : weekStart;
    const ledgerStart = period && start && Date.parse(start) > Date.parse(period.period_starts_at) ? period.period_starts_at : start;
    const [chatRows, jobs, legacyGenerations, usageRows, trialRows, ledgerRows, trialConfigs] = await Promise.all([
      listUserUsageRows(client, 'chat_usage_records', 'model_key,weight,status,created_at,expires_at', id, chatStart),
      listUserUsageRows(client, 'ai_executions', 'id,model_key,model_id,modality,provider_id,state,credits_charged,reservation_id,created_at', id, start),
      listUserUsageRows(client, 'generations', 'id,model_id,type,status,created_at', id, start),
      listUserUsageRows(client, 'usage_records', 'reservation_id,model_id,modality,status,credits_charged,created_at', id, start),
      listUserUsageRows(client, 'model_trial_usages', 'model_key,plan_code,trial_scope,state,expires_at,created_at', id),
      listUserUsageRows(client, 'credit_transactions', 'id,transaction_type,amount,reason,metadata,created_at', id, ledgerStart),
      client.from('model_plan_access_configs').select('model_key,plan_code,access_state,trial_allowance').eq('plan_code', plan).eq('access_state', 'trial'),
    ]);
    if (trialConfigs.error) throw trialConfigs.error;
    const names = new Map((modelsResult.data ?? []).map((model) => [model.model_key, model.customer_display_name || model.model_id]));
    const backendNames = new Map<string, string | null>();
    for (const model of modelsResult.data ?? []) backendNames.set(model.model_id,
      backendNames.has(model.model_id) ? null : model.customer_display_name || model.model_id);
    const nameFor = (key: string) => names.get(key) ?? backendNames.get(key) ?? key;
    const limitRow = (limitsResult.data ?? []).find((row) => row.plan_code === plan);
    const chat = summarizeChat(chatRows as ChatRecord[], nowMs, {
      fiveHour: limitRow?.five_hour_limit == null ? null : Number(limitRow.five_hour_limit),
      weekly: limitRow?.weekly_limit == null ? null : Number(limitRow.weekly_limit),
    });
    const chatActivity = chatRows.filter((row) => row.status === 'completed' && inUsageRange(row.created_at, start));
    const chatByModel = new Map<string, { model: string; requests: number; weightedUsage: number }>();
    for (const row of chatActivity) {
      const value = chatByModel.get(row.model_key) ?? { model: nameFor(row.model_key), requests: 0, weightedUsage: 0 };
      value.requests += 1;
      value.weightedUsage += Number(row.weight);
      chatByModel.set(row.model_key, value);
    }
    const usageByReservation = new Map(usageRows.map((row) => [row.reservation_id, row]));
    // Library rows use the execution ID for current jobs. Keep older standalone
    // generations visible without counting the current execution twice.
    const executionIds = new Set(jobs.map((row) => row.id));
    const mediaJobs = [...jobs, ...legacyGenerations.filter((row) => !executionIds.has(row.id)).map((row) => ({
      id: row.id, model_key: row.model_id, model_id: row.model_id, modality: row.type,
      provider_id: null, state: row.status, credits_charged: null, reservation_id: null, created_at: row.created_at,
    }))].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const media = summarizeMedia(mediaJobs.map((row) => ({
      model_key: String(row.model_key), modality: String(row.modality), state: String(row.state),
      reservation_id: row.reservation_id == null ? null : String(row.reservation_id),
    })), usageRows.map((row) => ({
      reservation_id: String(row.reservation_id), modality: String(row.modality), status: String(row.status),
      credits_charged: row.credits_charged == null ? null : String(row.credits_charged),
    })), nameFor);
    const rangeLedger = ledgerRows.filter((row) => inUsageRange(row.created_at, start));
    const ledgerForBuckets = ledgerRows.map((row) => ({
      transaction_type: String(row.transaction_type), created_at: String(row.created_at),
      metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : null,
    }));
    const relevantScope = plan === 'free' ? 'free:one-time' : active ? `entitlement:${active.id}` : null;
    const trials = summarizeTrials(trialConfigs.data ?? [], trialRows.map((row) => ({
      model_key: String(row.model_key), trial_scope: String(row.trial_scope), state: String(row.state),
      expires_at: String(row.expires_at),
    })), plan, relevantScope, nowMs, nameFor);
    const recent = jobs.slice(0, 20);
    const reservationIds = recent.map((row) => row.reservation_id).filter((value): value is string => Boolean(value));
    const costs = reservationIds.length ? await client.from('provider_cost_records')
      .select('reservation_id,actual_cost_minor,currency').eq('user_id', id).in('reservation_id', reservationIds) : { data: [], error: null };
    if (costs.error) throw costs.error;
    const costsByReservation = new Map((costs.data ?? []).map((row) => [row.reservation_id, row]));
    return NextResponse.json({
      range,
      plan: { ...planView, rollover: period?.rollover_amount == null ? null : String(period.rollover_amount) },
      chat: { ...chat, requests: chatActivity.length, breakdown: [...chatByModel.values()].sort((a, b) => b.weightedUsage - a.weightedUsage) },
      media,
      allowances: { freeMediaEndsAt: new Date(Date.parse(auth.data.user.created_at) + 7 * 86_400_000).toISOString(),
        freeImageRemaining: account.data?.free_image_remaining ?? null, freeVideoRemaining: account.data?.free_video_remaining ?? null,
        liteVideoTotal: period?.plan_code === 'lite' ? period.included_videos : null,
        liteVideoRemaining: period?.plan_code === 'lite' && account.data?.lite_video_entitlement_id === period.entitlement_id ? account.data.lite_video_remaining : null },
      credits: { subscriptionBalance: account.data?.subscription_balance == null ? null : String(account.data.subscription_balance),
        purchasedBalance: account.data?.purchased_balance == null ? null : String(account.data.purchased_balance),
        rolloverBalance: account.data?.subscription_rollover_balance == null ? null : String(account.data.subscription_rollover_balance),
        subscriptionConsumedCycle: period ? settledBucketTotal(ledgerForBuckets, 'subscription_charged', period.period_starts_at, period.period_ends_at) : null,
        purchasedConsumed: settledBucketTotal(ledgerForBuckets, 'purchased_charged', start),
        ledger: rangeLedger.slice(0, 15).map((row) => ({ id: row.id, type: row.transaction_type, amount: String(row.amount), reason: row.reason, createdAt: row.created_at })) },
      trials,
      jobs: [...recent, ...mediaJobs.filter((row) => !executionIds.has(row.id)).slice(0, 20)].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20).map((row) => {
        const cost = costsByReservation.get(row.reservation_id);
        const settled = usageByReservation.get(row.reservation_id);
        return { id: row.id, createdAt: row.created_at, modality: row.modality, model: nameFor(row.model_key),
          provider: row.provider_id ?? null, status: row.state,
          charge: row.state === 'completed' && settled ? String(settled.credits_charged) : null,
          providerCost: cost?.actual_cost_minor == null ? null : { minor: String(cost.actual_cost_minor), currency: cost.currency } };
      }),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[admin] user usage query failed', { message: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'USER_USAGE_QUERY_FAILED' }, { status: 503 });
  }
}
