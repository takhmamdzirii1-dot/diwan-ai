import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(url && anonKey && serviceKey, 'Supabase QA environment is incomplete');
assert.equal(new URL(url).hostname, 'dycnvdlnqbfxcokabfjm.supabase.co', 'Unexpected Supabase project URL');

const createSecretKeyFetch = (secret) => {
  const nativeFetch = globalThis.fetch.bind(globalThis);
  return async (input, init = {}) => {
    const headers = new Headers(init.headers);
    if (secret.startsWith('sb_secret_') && headers.get('authorization') === `Bearer ${secret}`) {
      headers.delete('authorization');
    }
    headers.set('apikey', secret);
    return nativeFetch(input, { ...init, headers });
  };
};

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: createSecretKeyFetch(serviceKey) },
});
const userClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const email = `vantra-lifecycle-${randomUUID()}@example.invalid`;
const password = `Qa-${randomUUID()}-Aa1!`;
const hash = (value) => createHash('sha256').update(value).digest('hex');
let userId = null;
let paymentOrderId = null;

const adminRpc = async (name, args) => {
  const result = await admin.rpc(name, args);
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  return result.data;
};

try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error('QA user creation failed');
  userId = created.data.user.id;
  const signedIn = await userClient.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;

  // Fund only the disposable user through VANTRA's existing audited,
  // idempotent payment grant path—never through a direct balance write.
  const planResult = await admin.from('payment_plans').select('id,unified_credits')
    .eq('active', true).gte('unified_credits', 6).order('unified_credits').limit(1).single();
  if (planResult.error) throw new Error('No active QA-capable payment plan is available');
  const order = await userClient.rpc('create_manual_payment_order', {
    p_plan_id: planResult.data.id,
    p_payment_method: 'baridimob',
  });
  if (order.error) throw order.error;
  paymentOrderId = order.data.id;
  const submitted = await userClient.rpc('submit_manual_payment', {
    p_payment_order_id: order.data.id,
    p_customer_reference: `QA-${randomUUID()}`,
    p_proof_storage_path: null,
  });
  if (submitted.error) throw submitted.error;
  await adminRpc('approve_manual_payment', {
    p_payment_order_id: order.data.id,
    p_actor_user_id: userId,
    p_review_note: 'Disposable generation terminal-policy QA',
  });

  const routeResult = await admin.from('model_provider_routes')
    .select('id,model_key,model_id,modality,provider_id,provider_model_id')
    .eq('enabled', true).order('priority').limit(1).single();
  if (routeResult.error) throw routeResult.error;
  const route = routeResult.data;

  const begin = async (label, amount, streaming = true) => {
    const operationKey = `qa:${label}:${randomUUID()}`;
    const payloadHash = hash(operationKey);
    const execution = await adminRpc('begin_ai_execution', {
      p_user_id: userId, p_operation_key: operationKey, p_payload_hash: payloadHash,
      p_modality: route.modality, p_model_key: route.model_key, p_model_id: route.model_id,
      p_route_id: route.id, p_provider_id: route.provider_id,
      p_provider_model_id: route.provider_model_id,
    });
    let reservationId = null;
    if (amount > 0) {
      const reservation = await adminRpc('reserve_credits', {
        p_user_id: userId, p_operation_key: operationKey, p_payload_hash: payloadHash,
        p_modality: route.modality, p_model_id: route.model_id, p_amount: amount,
        p_pricing_version: 'qa-v1', p_pricing_snapshot: { qa: true, amount },
        p_route_snapshot: { qa: true, routeId: route.id },
        p_expires_at: new Date(Date.now() + 300_000).toISOString(),
      });
      reservationId = reservation.reservation_id;
      if (streaming) await adminRpc('mark_ai_execution_streaming', {
        p_execution_id: execution.execution_id,
        p_user_id: userId,
        p_reservation_id: reservationId,
      });
    }
    return { operationKey, payloadHash, executionId: execution.execution_id, reservationId };
  };

  const finalize = (item, options) => adminRpc('finalize_ai_execution_terminal', {
    p_execution_id: item.executionId, p_user_id: userId,
    p_reservation_id: item.reservationId, p_operation_key: item.operationKey,
    p_payload_hash: item.payloadHash, p_terminal_status: options.status,
    p_customer_charge: options.charge ?? 0,
    p_usage_authoritative: options.authoritative ?? false,
    p_finish_reason: options.finishReason ?? null,
    p_error_code: options.errorCode ?? null,
    p_failure_owner: options.failureOwner ?? null,
    p_failure_category: options.failureCategory ?? null,
    p_actual_usage: options.usage ?? {}, p_provider_cost_minor: options.costMinor ?? null,
    p_provider_cost_currency: options.costCurrency ?? null,
    p_provider_operation_id: null, p_attempt_count: options.attemptCount ?? 1,
  });

  const preflight = await begin('preflight', 0, false);
  const preflightResult = await finalize(preflight, {
    status: 'failed', errorCode: 'QA_PREFLIGHT', failureOwner: 'customer',
    failureCategory: 'pre_execution', attemptCount: 0,
  });
  assert.equal(Number(preflightResult.credits_charged), 0);

  const failed = await begin('provider-failed', 1);
  await finalize(failed, {
    status: 'failed', errorCode: 'QA_PROVIDER_FAILED', failureOwner: 'provider',
    failureCategory: 'provider_execution', costMinor: 7, costCurrency: 'USD',
  });
  const failedReservation = await admin.from('credit_reservations')
    .select('state').eq('id', failed.reservationId).single();
  assert.equal(failedReservation.data?.state, 'released');
  const absorbed = await admin.from('provider_cost_records')
    .select('actual_cost_minor,credits_charged').eq('reservation_id', failed.reservationId).single();
  assert.equal(Number(absorbed.data?.actual_cost_minor), 7);
  assert.equal(Number(absorbed.data?.credits_charged), 0);

  const partial = await begin('partial', 1);
  await finalize(partial, {
    status: 'partial_failed', errorCode: 'QA_STREAM_INTERRUPTED',
    failureOwner: 'provider', failureCategory: 'stream_interrupted',
  });
  const partialExecution = await admin.from('ai_executions')
    .select('state,credits_charged,execution_metadata').eq('id', partial.executionId).single();
  assert.equal(partialExecution.data?.state, 'failed');
  assert.equal(partialExecution.data?.execution_metadata?.terminal_status, 'partial_failed');
  assert.equal(Number(partialExecution.data?.credits_charged), 0);

  const stoppedUnknown = await begin('stop-unknown', 2);
  await finalize(stoppedUnknown, {
    status: 'user_cancelled', errorCode: 'QA_USER_STOPPED',
    failureOwner: 'customer', failureCategory: 'user_cancel',
  });
  const stoppedUnknownReservation = await admin.from('credit_reservations')
    .select('state').eq('id', stoppedUnknown.reservationId).single();
  assert.equal(stoppedUnknownReservation.data?.state, 'released');

  const stoppedKnown = await begin('stop-known', 2);
  await finalize(stoppedKnown, {
    status: 'user_cancelled', charge: 1, authoritative: true,
    errorCode: 'QA_USER_STOPPED', failureOwner: 'customer',
    failureCategory: 'user_cancel', usage: { authoritativeCreditCharge: 1 },
  });
  const stoppedKnownReservation = await admin.from('credit_reservations')
    .select('state,settled_amount').eq('id', stoppedKnown.reservationId).single();
  assert.equal(stoppedKnownReservation.data?.state, 'settled');
  assert.equal(Number(stoppedKnownReservation.data?.settled_amount), 1);

  const success = await begin('success', 1);
  const duplicate = await Promise.all([
    finalize(success, { status: 'completed', charge: 1, finishReason: 'stop' }),
    finalize(success, { status: 'completed', charge: 1, finishReason: 'stop' }),
  ]);
  assert.equal(duplicate.filter((item) => item.idempotent === false).length, 1);
  const settlements = await admin.from('credit_transactions').select('id', { count: 'exact' })
    .eq('reservation_id', success.reservationId).eq('transaction_type', 'settle');
  assert.equal(settlements.count, 1);

  const invalid = await begin('invalid-failure-charge', 1);
  const invalidResult = await admin.rpc('finalize_ai_execution_terminal', {
    p_execution_id: invalid.executionId, p_user_id: userId,
    p_reservation_id: invalid.reservationId, p_operation_key: invalid.operationKey,
    p_payload_hash: invalid.payloadHash, p_terminal_status: 'failed', p_customer_charge: 1,
  });
  assert(invalidResult.error?.message.includes('FAILED_EXECUTION_MUST_NOT_CHARGE'));
  await finalize(invalid, {
    status: 'failed', errorCode: 'QA_CLEANUP', failureOwner: 'vantra',
    failureCategory: 'qa_cleanup',
  });

  const unauthorized = await userClient.rpc('finalize_ai_execution_terminal', {
    p_execution_id: success.executionId, p_user_id: userId,
    p_reservation_id: success.reservationId, p_operation_key: success.operationKey,
    p_payload_hash: success.payloadHash, p_terminal_status: 'completed', p_customer_charge: 1,
  });
  assert(unauthorized.error, 'Authenticated clients must not finalize financial executions');

  const balanceResult = await admin.from('credits').select('balance').eq('user_id', userId).single();
  if (balanceResult.error) throw balanceResult.error;
  const available = Number(balanceResult.data.balance);
  const reserveOnly = async (label) => {
    const op = `qa:${label}:${randomUUID()}`;
    return admin.rpc('reserve_credits', {
      p_user_id: userId, p_operation_key: op, p_payload_hash: hash(op),
      p_modality: route.modality, p_model_id: route.model_id, p_amount: available,
      p_pricing_version: 'qa-v1', p_pricing_snapshot: { qa: true, amount: available },
      p_route_snapshot: { qa: true }, p_expires_at: new Date(Date.now() + 300_000).toISOString(),
    });
  };
  const concurrent = await Promise.all([reserveOnly('overspend-a'), reserveOnly('overspend-b')]);
  assert.equal(concurrent.filter((item) => !item.error).length, 1);
  assert.equal(concurrent.filter((item) => item.error?.message.includes('INSUFFICIENT_CREDITS')).length, 1);

  console.log('GENERATION_TERMINAL_POLICY_QA:PASS');
} finally {
  await userClient.auth.signOut().catch(() => undefined);
  if (userId) {
    const cleanup = await admin.auth.admin.deleteUser(userId);
    if (cleanup.error) {
      console.error('GENERATION_TERMINAL_POLICY_CLEANUP:FAIL');
      process.exitCode = 2;
    } else {
      const userOwnedTables = [
        'credits',
        'credit_reservations',
        'credit_transactions',
        'usage_records',
        'provider_cost_records',
        'provider_dispatch_outbox',
        'ai_executions',
        'payment_orders',
        'user_entitlements',
      ];
      const cleanupChecks = await Promise.all(userOwnedTables.map(async (table) => {
        const result = await admin.from(table).select('user_id', { count: 'exact', head: true }).eq('user_id', userId);
        if (result.error) throw new Error(`Cleanup verification failed for ${table}: ${result.error.message}`);
        return { table, count: result.count ?? 0 };
      }));
      if (paymentOrderId) {
        const audit = await admin.from('payment_audit_log')
          .select('id', { count: 'exact', head: true })
          .eq('payment_order_id', paymentOrderId);
        if (audit.error) throw new Error(`Cleanup verification failed for payment_audit_log: ${audit.error.message}`);
        cleanupChecks.push({ table: 'payment_audit_log', count: audit.count ?? 0 });
      }
      const remaining = cleanupChecks.filter((item) => item.count !== 0);
      if (remaining.length > 0) {
        console.error('GENERATION_TERMINAL_POLICY_CLEANUP:FAIL');
        process.exitCode = 2;
      } else {
        console.log('GENERATION_TERMINAL_POLICY_CLEANUP:PASS');
      }
    }
  }
}
