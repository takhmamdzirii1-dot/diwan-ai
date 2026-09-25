import 'server-only';

import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import type { ModelAccessState } from '@/lib/models/model-access';

export async function reserveModelTrialAccess(args: {
  userId: string;
  modelKey: string;
  modelId: string;
  modality: string;
  planCode: string;
  accessState: ModelAccessState;
  operationKey: string;
  reservationId: string | null;
}) {
  if (args.accessState !== 'trial') return null;
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('MODEL_TRIAL_UNCONFIGURED');
  const { data, error } = await client.rpc('reserve_model_trial_access', {
    p_user_id: args.userId,
    p_model_key: args.modelKey,
    p_model_id: args.modelId,
    p_modality: args.modality,
    p_plan_code: args.planCode,
    p_operation_key: args.operationKey,
    p_credit_reservation_id: args.reservationId,
  });
  if (error) {
    const known = /FREE_ACCESS_RESTRICTED|MODEL_TRIAL_(?:EXHAUSTED|UNCONFIGURED)|MODEL_ACCESS_CHANGED/.exec(error.message)?.[0];
    throw new Error(known ?? 'MODEL_TRIAL_UNCONFIGURED');
  }
  return data;
}

export async function finalizeModelTrialAccess(args: {
  userId: string;
  operationKey: string;
  outcome: 'completed' | 'released';
}) {
  const client = getSupabaseAdminClient();
  if (!client) return;
  const { error } = await client.rpc('finalize_model_trial_access', {
    p_user_id: args.userId,
    p_operation_key: args.operationKey,
    p_outcome: args.outcome,
  });
  if (error && !['42883', 'PGRST202'].includes(error.code)) {
    console.error('[model-access] trial finalization failed', { code: error.code });
  }
}
