import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { requireEffectiveRuntimeModel } from '@/lib/models/runtime-config';
import {
  normalizeModelPlanCode,
  type ModelPlanCode,
} from '@/lib/models/plan-entitlements';
import { resolveConfiguredModelAccess } from '@/lib/models/model-access';
import { ModelPlanAccessError } from '@/lib/models/plan-entitlements';
import type { StudioModality } from '@/src/config/studio-registry';

type PlanRelation = { plan_code?: unknown } | { plan_code?: unknown }[] | null;

export async function resolveCurrentModelPlan(userId: string, client?: SupabaseClient): Promise<ModelPlanCode> {
  const serverClient = client ?? getSupabaseAdminClient();
  if (!serverClient) throw new Error('PLAN_ENTITLEMENT_UNAVAILABLE');
  const admin = getSupabaseAdminClient();
  if (admin) {
    const { error: refreshError } = await admin.rpc('activate_due_subscription_period_for_access', { p_user_id: userId });
    if (refreshError && !['PGRST202', '42883'].includes(refreshError.code)) {
      throw new Error('PLAN_ENTITLEMENT_UNAVAILABLE');
    }
  }
  const now = new Date().toISOString();
  const { data, error } = await serverClient
    .from('user_entitlements')
    .select('plan_id,starts_at,ends_at,payment_plans!inner(plan_code)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .lte('starts_at', now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .in('payment_plans.plan_code', ['lite', 'pro', 'max'])
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('PLAN_ENTITLEMENT_UNAVAILABLE');
  if (!data) return 'free';
  const relation = data.payment_plans as PlanRelation;
  const planCode = Array.isArray(relation) ? relation[0]?.plan_code : relation?.plan_code;
  return normalizeModelPlanCode(planCode);
}

export async function requireEntitledRuntimeModel(
  userId: string,
  modelId: string,
  modality: StudioModality
) {
  const resolved = await resolveRuntimeModelAccess(userId, modelId, modality);
  return resolved.model;
}

export async function resolveRuntimeModelAccess(
  userId: string,
  modelId: string,
  modality: StudioModality
) {
  const model = await requireEffectiveRuntimeModel(modelId, modality);
  const currentPlan = await resolveCurrentModelPlan(userId);
  const access = resolveConfiguredModelAccess(model.planAccess, currentPlan);
  if (access.state === 'locked') throw new ModelPlanAccessError(access.requiredPlan);
  if (access.state === 'trial' && access.trialAllowance == null) {
    throw new ModelPlanAccessError(access.requiredPlan, 'MODEL_TRIAL_UNCONFIGURED');
  }
  return { model, currentPlan, access };
}
