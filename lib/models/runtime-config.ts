import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { PROVIDER_REGISTRY } from '@/lib/ai/image-providers/router';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import {
  DEFAULT_CHAT_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  STUDIO_MODELS,
  type StudioModality,
} from '@/src/config/studio-registry';

export type ModelRoutingRole = 'primary' | 'backup' | 'unassigned';
export type ProviderCostStatus = 'free' | 'known' | 'unknown';

export type RegistryModelReference = {
  key: string;
  modelId: string;
  displayName: string;
  provider: string;
  modality: StudioModality;
  availability: string;
  activationSupported: boolean;
  baseEnabled: boolean;
  baseRoutingRole: ModelRoutingRole;
  baseCustomerCreditPrice: number | null;
};

export type ModelRuntimeOverride = {
  modelKey: string;
  modelId: string;
  modality: StudioModality;
  enabled: boolean;
  routingRole: ModelRoutingRole;
  customerCreditPrice: number | null;
  providerCostStatus: ProviderCostStatus | null;
  providerCostMinor: string | null;
  providerCostCurrency: string | null;
  updatedAt: string;
};

export type EffectiveRuntimeModel = RegistryModelReference & {
  enabled: boolean;
  routingRole: ModelRoutingRole;
  customerCreditPrice: number | null;
  providerCostStatus: ProviderCostStatus | null;
  providerCostMinor: string | null;
  providerCostCurrency: string | null;
  persisted: boolean;
  updatedAt: string | null;
};

const defaultModelIds = new Set([
  DEFAULT_CHAT_MODEL?.id,
  DEFAULT_IMAGE_MODEL?.id,
  DEFAULT_VIDEO_MODEL?.id,
].filter((value): value is string => Boolean(value)));

const registryModels: RegistryModelReference[] = STUDIO_MODELS.map((model) => ({
  key: `studio:${model.modality}:${model.id}`,
  modelId: model.id,
  displayName: model.displayName,
  provider: model.provider,
  modality: model.modality,
  availability: model.availability,
  activationSupported: model.availability === 'available' || model.availability === 'beta',
  baseEnabled: model.enabled,
  baseRoutingRole: defaultModelIds.has(model.id)
    ? 'primary'
    : model.fallbackAvailable ? 'backup' : 'unassigned',
  baseCustomerCreditPrice: typeof model.verifiedCreditCost === 'number'
    && Number.isSafeInteger(model.verifiedCreditCost)
    && model.verifiedCreditCost >= 0
    ? model.verifiedCreditCost
    : null,
}));

const registeredModelIds = new Set(STUDIO_MODELS.map((model) => model.id));
for (const provider of Object.values(PROVIDER_REGISTRY)) {
  for (const model of provider.models) {
    if (registeredModelIds.has(model.id)) continue;
    registryModels.push({
      key: `provider:${provider.id}:${model.id}`,
      modelId: model.id,
      displayName: model.name,
      provider: provider.name,
      modality: 'image',
      availability: provider.id === 'runware' ? 'internal_test' : 'not_in_studio',
      activationSupported: false,
      baseEnabled: false,
      baseRoutingRole: 'unassigned',
      baseCustomerCreditPrice: null,
    });
  }
}

export const MODEL_REGISTRY_REFERENCES: readonly RegistryModelReference[] = registryModels;

export function findRegistryModel(modelKey: string) {
  return MODEL_REGISTRY_REFERENCES.find((model) => model.key === modelKey) ?? null;
}

export function findStudioRegistryModel(modelId: string, modality: StudioModality) {
  return MODEL_REGISTRY_REFERENCES.find((model) =>
    model.key.startsWith('studio:') && model.modelId === modelId && model.modality === modality) ?? null;
}

function mapOverride(row: any): ModelRuntimeOverride {
  return {
    modelKey: String(row.model_key),
    modelId: String(row.model_id),
    modality: row.modality,
    enabled: Boolean(row.enabled),
    routingRole: row.routing_role,
    customerCreditPrice: row.customer_credit_price == null ? null : Number(row.customer_credit_price),
    providerCostStatus: row.provider_cost_status,
    providerCostMinor: row.provider_cost_minor == null ? null : String(row.provider_cost_minor),
    providerCostCurrency: row.provider_cost_currency,
    updatedAt: String(row.updated_at),
  };
}

export async function loadModelRuntimeOverrides(client: SupabaseClient, modelKey?: string) {
  let query = client.from('model_runtime_configs').select(
    'model_key,model_id,modality,enabled,routing_role,customer_credit_price,provider_cost_status,provider_cost_minor,provider_cost_currency,updated_at'
  );
  if (modelKey) query = query.eq('model_key', modelKey);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapOverride);
}

export function applyModelRuntimeOverrides(overrides: readonly ModelRuntimeOverride[]) {
  const overrideByKey = new Map(overrides.map((override) => [override.modelKey, override]));
  const explicitPrimaryModalities = new Set(
    overrides
      .filter((override) => override.enabled && override.routingRole === 'primary')
      .map((override) => override.modality)
  );

  return MODEL_REGISTRY_REFERENCES.map((model): EffectiveRuntimeModel => {
    const override = overrideByKey.get(model.key);
    const enabled = model.activationSupported && (override ? override.enabled : model.baseEnabled);
    let routingRole = override?.routingRole ?? model.baseRoutingRole;
    if (!override && explicitPrimaryModalities.has(model.modality) && routingRole === 'primary') {
      routingRole = 'unassigned';
    }
    if (!enabled) routingRole = 'unassigned';

    return {
      ...model,
      enabled,
      routingRole,
      customerCreditPrice: override ? override.customerCreditPrice : model.baseCustomerCreditPrice,
      providerCostStatus: override?.providerCostStatus ?? null,
      providerCostMinor: override?.providerCostMinor ?? null,
      providerCostCurrency: override?.providerCostCurrency ?? null,
      persisted: Boolean(override),
      updatedAt: override?.updatedAt ?? null,
    };
  });
}

export async function getEffectiveRuntimeModels(client?: SupabaseClient) {
  const serverClient = client ?? getSupabaseAdminClient();
  if (!serverClient) throw new Error('MODEL_RUNTIME_CONFIG_UNAVAILABLE');
  return applyModelRuntimeOverrides(await loadModelRuntimeOverrides(serverClient));
}

export async function requireEffectiveRuntimeModel(modelId: string, modality: StudioModality) {
  const registryModel = findStudioRegistryModel(modelId, modality);
  if (!registryModel) throw new Error('MODEL_NOT_REGISTERED');
  const serverClient = getSupabaseAdminClient();
  if (!serverClient) throw new Error('MODEL_RUNTIME_CONFIG_UNAVAILABLE');
  const overrides = await loadModelRuntimeOverrides(serverClient, registryModel.key);
  const model = applyModelRuntimeOverrides(overrides).find((candidate) => candidate.key === registryModel.key);
  if (!model) throw new Error('MODEL_NOT_REGISTERED');
  if (!model.enabled || !model.activationSupported) throw new Error('MODEL_NOT_AVAILABLE');
  if (model.customerCreditPrice == null) throw new Error('MODEL_CUSTOMER_PRICE_UNCONFIGURED');
  return model;
}
