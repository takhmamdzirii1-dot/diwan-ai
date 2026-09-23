import { resolveConfiguredModelAccess } from '@/lib/models/model-access';

export const MODEL_PLAN_CODES = ['free', 'lite', 'pro', 'max'] as const;
export type ModelPlanCode = (typeof MODEL_PLAN_CODES)[number];

const planCodes = new Set<string>(MODEL_PLAN_CODES);

export const DEFAULT_MODEL_ALLOWED_PLANS: Readonly<Record<string, readonly ModelPlanCode[]>> = {
  'nvidia/nemotron-3-ultra-550b-a55b:free': ['free', 'lite', 'pro', 'max'],
  'z-ai/glm-5.2:free': ['pro', 'max'],
  'poolside/laguna-s-2.1:free': ['pro', 'max'],
  'minimax/minimax-m3:free': ['pro', 'max'],
  flux: ['free', 'lite', 'pro', 'max'],
  'vantra-glm-5.3-flash': ['free', 'lite', 'pro', 'max'],
  'vantra-hy3': ['lite', 'pro', 'max'],
  'vantra-union-alpha': ['pro', 'max'],
  'vantra-deepseek-v4-flash': ['lite', 'pro', 'max'],
  'vantra-qwen-3.8-flash': ['lite', 'pro', 'max'],
  'vantra-qwen-3.8-flash-next': ['pro', 'max'],
  'vantra-agnes-3.0-flash': ['lite', 'pro', 'max'],
  'vantra-muse-image': ['lite', 'pro', 'max'],
  'vantra-z-image': ['lite', 'pro', 'max'],
  'vantra-flux-klein': ['pro', 'max'],
  'vantra-mai-image-2.6-flash': ['free', 'lite', 'pro', 'max'],
  'vantra-p-video': ['lite', 'pro', 'max'],
  'vantra-p-video-2': ['lite', 'pro', 'max'],
  'vantra-p-video-2-pro': ['free', 'lite', 'pro', 'max'],
  'vantra-h3-max': ['pro', 'max'],
  'vantra-h3-max-turbo': ['pro', 'max'],
};

export function isModelPlanCode(value: unknown): value is ModelPlanCode {
  return typeof value === 'string' && planCodes.has(value.toLowerCase());
}

export function normalizeModelPlanCode(value: unknown): ModelPlanCode {
  return isModelPlanCode(value) ? value.toLowerCase() as ModelPlanCode : 'free';
}

export function normalizeAllowedPlans(value: unknown): ModelPlanCode[] {
  if (!Array.isArray(value)) return [];
  return MODEL_PLAN_CODES.filter((plan) => value.some((candidate) =>
    typeof candidate === 'string' && candidate.toLowerCase() === plan));
}

export function isHierarchicalAllowedPlans(value: readonly ModelPlanCode[]) {
  return value.includes('max')
    && (!value.includes('free') || (value.includes('lite') && value.includes('pro')))
    && (!value.includes('lite') || value.includes('pro'));
}

export function defaultAllowedPlansForModel(modelId: string): ModelPlanCode[] {
  return [...(DEFAULT_MODEL_ALLOWED_PLANS[modelId] ?? [])];
}

export function resolveModelPlanAccess(
  allowedPlans: readonly ModelPlanCode[],
  currentPlan: ModelPlanCode
) {
  const allowed = allowedPlans.includes(currentPlan);
  return {
    allowed,
    requiredPlan: allowed ? null : (MODEL_PLAN_CODES.find((plan) => allowedPlans.includes(plan)) ?? null),
  };
}

export function applyModelPlanAccess<T extends { allowedPlans: readonly ModelPlanCode[] }>(
  model: T,
  currentPlan: ModelPlanCode
) {
  if ('planAccess' in model && model.planAccess) {
    const configured = resolveConfiguredModelAccess(model.planAccess as import('@/lib/models/model-access').ModelPlanAccessMap, currentPlan);
    return {
      ...model,
      planAccessible: configured.state !== 'locked',
      requiredPlan: configured.requiredPlan,
      accessState: configured.state,
      trialAllowance: configured.trialAllowance,
    };
  }
  const access = resolveModelPlanAccess(model.allowedPlans, currentPlan);
  return { ...model, planAccessible: access.allowed, requiredPlan: access.requiredPlan, accessState: access.allowed ? 'included' as const : 'locked' as const, trialAllowance: null };
}

export class ModelPlanAccessError extends Error {
  readonly code: 'MODEL_PLAN_ACCESS_REQUIRED' | 'MODEL_TRIAL_UNCONFIGURED';

  constructor(readonly requiredPlan: ModelPlanCode | null, code: 'MODEL_PLAN_ACCESS_REQUIRED' | 'MODEL_TRIAL_UNCONFIGURED' = 'MODEL_PLAN_ACCESS_REQUIRED') {
    super(code);
    this.code = code;
    this.name = 'ModelPlanAccessError';
  }
}

export function assertModelPlanAccess(
  allowedPlans: readonly ModelPlanCode[],
  currentPlan: ModelPlanCode
) {
  const access = resolveModelPlanAccess(allowedPlans, currentPlan);
  if (!access.allowed) throw new ModelPlanAccessError(access.requiredPlan);
  return currentPlan;
}

export function modelPlanErrorPayload(cause: unknown) {
  return cause instanceof ModelPlanAccessError
    ? { error: cause.code, reason: cause.code === 'MODEL_TRIAL_UNCONFIGURED' ? 'trial_unconfigured' : 'plan_required', requiredPlan: cause.requiredPlan }
    : null;
}
