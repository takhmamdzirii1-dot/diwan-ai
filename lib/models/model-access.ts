import type { ModelPlanCode } from '@/lib/models/plan-entitlements';
import type { StudioModality } from '@/src/config/studio-registry';

export const MODEL_ACCESS_STATES = ['included', 'trial', 'locked'] as const;
const PLAN_CODES: readonly ModelPlanCode[] = ['free', 'lite', 'pro', 'max'];
export type ModelAccessState = typeof MODEL_ACCESS_STATES[number];
export type ModelPlanAccessEntry = { state: ModelAccessState; trialAllowance: number | null };
export type ModelPlanAccessMap = Record<ModelPlanCode, ModelPlanAccessEntry>;
export type RuntimeModelAccessReason = 'included' | 'trial_available' | 'trial_exhausted' | 'trial_unconfigured'
  | 'plan_required' | 'free_media_expired' | 'media_allowance_exhausted' | 'model_unconfigured' | 'model_disabled';

export type StoredModelPlanAccess = {
  modelKey: string;
  planCode: ModelPlanCode;
  state: ModelAccessState;
  trialAllowance: number | null;
};

const entry = (state: ModelAccessState, trialAllowance: number | null = null): ModelPlanAccessEntry => ({ state, trialAllowance });
const matrix = (free: ModelPlanAccessEntry, lite: ModelPlanAccessEntry, pro = entry('included'), max = entry('included')): ModelPlanAccessMap => ({ free, lite, pro, max });
const I = entry('included');
const L = entry('locked');
const T = (allowance: number | null = null) => entry('trial', allowance);
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

const FINAL_ACCESS_MATRIX = new Map<string, ModelPlanAccessMap>();
function define(modality: StudioModality, names: string[], access: ModelPlanAccessMap) {
  for (const name of names) FINAL_ACCESS_MATRIX.set(`${modality}:${normalize(name)}`, access);
}

define('chat', ['GPT-5.6 Luna', 'Luna', 'GPT-5.6 Terra', 'Terra', 'Gemini 3.8 Flash'], matrix(I, I));
define('chat', ['Claude Sonnet 5', 'Claude 3.5 Sonnet', 'Sonnet', 'GPT-5.6 Sol', 'GPT Sol', 'Kimi K3'], matrix(T(), I));
define('chat', ['GPT-6 Astra', 'GPT Astra', 'Claude Fable 5.1', 'Fable 5.1', 'Claude Opus 5', 'Opus', 'Grok 4.6', 'Gemini 3.1 Pro'], matrix(T(), T()));

define('image', ['Seedream 5.0 Pro', 'Nano Banana 2 Pro', 'Nano Banana Pro'], matrix(I, I));
define('image', ['GPT Image 2.5', 'GPT-Image-2.5'], matrix(T(1), I));
define('image', ['Grok Imagine Image 2.0'], matrix(L, T(1)));

define('video', ['Gemini Omni Flash'], matrix(I, I));
define('video', ['Kling 3.0 Pro', 'Kling 3.0'], matrix(L, I));
define('video', ['Seedance 2.5'], matrix(L, T()));

export function legacyPlanAccess(allowedPlans: readonly ModelPlanCode[]): ModelPlanAccessMap {
  return Object.fromEntries(PLAN_CODES.map((plan) => [plan, entry(allowedPlans.includes(plan) ? 'included' : 'locked')])) as ModelPlanAccessMap;
}

export function defaultModelPlanAccess(displayName: string, modality: StudioModality, allowedPlans: readonly ModelPlanCode[]) {
  const configured = FINAL_ACCESS_MATRIX.get(`${modality}:${normalize(displayName)}`);
  return configured ? structuredClone(configured) : legacyPlanAccess(allowedPlans);
}

export function applyStoredModelPlanAccess(base: ModelPlanAccessMap, rows: readonly StoredModelPlanAccess[]) {
  const next = structuredClone(base);
  for (const row of rows) next[row.planCode] = entry(row.state, row.state === 'trial' ? row.trialAllowance : null);
  return next;
}

export function includedPlans(access: ModelPlanAccessMap) {
  return PLAN_CODES.filter((plan) => access[plan].state === 'included');
}

export function resolveConfiguredModelAccess(access: ModelPlanAccessMap, currentPlan: ModelPlanCode) {
  const current = access[currentPlan];
  const requiredPlan = current.state === 'locked'
    ? PLAN_CODES.find((plan) => access[plan].state !== 'locked') ?? null
    : null;
  return { ...current, requiredPlan };
}

export function runtimeAccessReasonForError(code: string): RuntimeModelAccessReason | null {
  if (code === 'MODEL_PLAN_ACCESS_REQUIRED') return 'plan_required';
  if (code === 'FREE_ACCESS_RESTRICTED') return 'plan_required';
  if (code === 'MODEL_TRIAL_EXHAUSTED') return 'trial_exhausted';
  if (code === 'MODEL_TRIAL_UNCONFIGURED') return 'trial_unconfigured';
  if (code === 'FREE_MEDIA_EXPIRED') return 'free_media_expired';
  if (/FREE_(?:IMAGE|VIDEO)_TRIAL_EXHAUSTED|LITE_VIDEO_ALLOWANCE_EXHAUSTED/.test(code)) return 'media_allowance_exhausted';
  if (/MODEL_CUSTOMER_PRICE_UNCONFIGURED|MODEL_RUNTIME_CONFIG_UNAVAILABLE|NO_CONFIGURED_PROVIDER_ROUTE/.test(code)) return 'model_unconfigured';
  if (/MODEL_NOT_AVAILABLE|MODEL_DISABLED/.test(code)) return 'model_disabled';
  return null;
}
