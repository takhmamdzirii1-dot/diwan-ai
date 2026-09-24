import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { PROVIDER_REGISTRY } from '@/lib/ai/image-providers/router';
import { PROVIDER_CATALOG_MODELS } from '@/lib/models/provider-catalog';
import { isRetiredModelReference } from '@/lib/models/retired-providers';
import { modelBrand, modelIconUrl } from '@/src/config/model-catalog';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { providerConfigurationSummary } from '@/lib/ai/providers/registry';
import { emptyModelCapabilities, normalizeModelSurfaceVisibility, type CapabilityConfidence, type CapabilitySourceType, type CapabilitySyncStatus, type ModelCapabilities, type ModelSurfaceVisibility } from '@/lib/models/capabilities';
import { normalizeModelCapabilities } from '@/lib/models/capability-validation';
import { withAdapterInputs } from '@/lib/models/adapter-capabilities';
import {
  defaultAllowedPlansForModel,
  normalizeAllowedPlans,
  type ModelPlanCode,
} from '@/lib/models/plan-entitlements';
import {
  applyStoredModelPlanAccess,
  defaultModelPlanAccess,
  type ModelPlanAccessMap,
  type StoredModelPlanAccess,
} from '@/lib/models/model-access';
import {
  DEFAULT_CHAT_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  STUDIO_MODELS,
  type StudioModality,
  type StudioRuntimeModelDefinition,
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
  baseVisibleInStudio: boolean;
  baseSortOrder: number;
  baseCapabilities: ModelCapabilities;
  baseAllowedPlans: readonly ModelPlanCode[];
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
  customerDisplayName: string | null;
  customerShortDescription: string | null;
  customerMediaUrl: string | null;
  customerCategory: string | null;
  customerSortOrder: number | null;
  studioVisible: boolean | null;
  customerAvailabilityLabel: string | null;
  capabilities: ModelCapabilities;
  capabilitySourceType?: CapabilitySourceType;
  capabilityConfidence?: CapabilityConfidence;
  capabilitySyncStatus?: CapabilitySyncStatus;
  capabilitySyncError?: string | null;
  capabilityLastSyncedAt?: string | null;
  capabilitySchemaAvailable?: boolean;
  surfaceVisibility?: ModelSurfaceVisibility;
  allowedPlans: ModelPlanCode[];
  archived: boolean;
  updatedAt: string;
};

export type EffectiveRuntimeModel = RegistryModelReference & {
  enabled: boolean;
  routingRole: ModelRoutingRole;
  customerCreditPrice: number | null;
  providerCostStatus: ProviderCostStatus | null;
  providerCostMinor: string | null;
  providerCostCurrency: string | null;
  shortDescription: string | null;
  mediaUrl: string | null;
  category: string | null;
  sortOrder: number;
  visibleInStudio: boolean;
  availabilityLabel: string | null;
  capabilities: ModelCapabilities;
  capabilitySourceType: CapabilitySourceType;
  capabilityConfidence: CapabilityConfidence;
  capabilitySyncStatus: CapabilitySyncStatus;
  capabilitySyncError: string | null;
  capabilityLastSyncedAt: string | null;
  surfaceVisibility: ModelSurfaceVisibility;
  allowedPlans: ModelPlanCode[];
  planAccess: ModelPlanAccessMap;
  archived: boolean;
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
  baseVisibleInStudio: true,
  baseSortOrder: model.displayOrder,
  baseCapabilities: emptyModelCapabilities(model.modality),
  baseAllowedPlans: defaultAllowedPlansForModel(model.id),
}));

const registeredModelIds = new Set(STUDIO_MODELS.map((model) => model.id));
for (const model of PROVIDER_CATALOG_MODELS) {
  registryModels.push({
    key: model.key,
    modelId: model.modelId,
    displayName: model.displayName,
    provider: 'VANTRA',
    modality: model.modality,
    availability: 'provider_config_required',
    activationSupported: model.routeVerified,
    baseEnabled: false,
    baseRoutingRole: 'unassigned',
    baseCustomerCreditPrice: null,
    baseVisibleInStudio: false,
    baseSortOrder: 100,
    baseCapabilities: emptyModelCapabilities(model.modality),
    baseAllowedPlans: defaultAllowedPlansForModel(model.modelId),
  });
  registeredModelIds.add(model.modelId);
}
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
      baseVisibleInStudio: false,
      baseSortOrder: 100,
      baseCapabilities: emptyModelCapabilities('image'),
      baseAllowedPlans: defaultAllowedPlansForModel(model.id),
    });
  }
}

export const MODEL_REGISTRY_REFERENCES: readonly RegistryModelReference[] = registryModels;

export function findRegistryModel(modelKey: string) {
  return MODEL_REGISTRY_REFERENCES.find((model) => model.key === modelKey) ?? null;
}

export function findRegistryModelById(modelId: string, modality: StudioModality) {
  return MODEL_REGISTRY_REFERENCES.find((model) =>
    model.modelId === modelId && model.modality === modality) ?? null;
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
    customerDisplayName: row.customer_display_name == null ? null : String(row.customer_display_name),
    customerShortDescription: row.customer_short_description == null ? null : String(row.customer_short_description),
    customerMediaUrl: row.customer_media_url == null ? null : String(row.customer_media_url),
    customerCategory: row.customer_category == null ? null : String(row.customer_category),
    customerSortOrder: row.customer_sort_order == null ? null : Number(row.customer_sort_order),
    studioVisible: row.studio_visible == null ? null : Boolean(row.studio_visible),
    customerAvailabilityLabel: row.customer_availability_label == null ? null : String(row.customer_availability_label),
    capabilities: normalizeModelCapabilities(row.modality, row.capabilities),
    capabilitySourceType: row.capability_source_type ?? 'unknown',
    capabilityConfidence: row.capability_confidence ?? 'unknown',
    capabilitySyncStatus: row.capability_sync_status ?? 'partial',
    capabilitySyncError: row.capability_sync_error ?? null,
    capabilityLastSyncedAt: row.capability_last_synced_at ?? null,
    capabilitySchemaAvailable: Object.prototype.hasOwnProperty.call(row, 'capability_source_type'),
    surfaceVisibility: normalizeModelSurfaceVisibility(row.modality, row.surface_visibility),
    allowedPlans: normalizeAllowedPlans(row.allowed_plans),
    archived: Boolean(row.archived),
    updatedAt: String(row.updated_at),
  };
}

export async function loadModelRuntimeOverrides(client: SupabaseClient, modelKey?: string) {
  const legacyColumns = 'model_key,model_id,modality,enabled,routing_role,customer_credit_price,provider_cost_status,provider_cost_minor,provider_cost_currency,customer_display_name,customer_short_description,customer_media_url,customer_category,customer_sort_order,studio_visible,customer_availability_label,capabilities,allowed_plans,archived,updated_at';
  const syncColumns = ',capability_source_type,capability_confidence,capability_sync_status,capability_sync_error,capability_last_synced_at,surface_visibility';
  let query = client.from('model_runtime_configs').select(legacyColumns + syncColumns);
  if (modelKey) query = query.eq('model_key', modelKey);
  const current = await query;
  let data: any[] | null = current.data as any[] | null;
  let error = current.error;
  // The application remains readable while the additive migration is applied.
  if (error && ['42703', 'PGRST204'].includes(error.code)) {
    let legacyQuery = client.from('model_runtime_configs').select(legacyColumns);
    if (modelKey) legacyQuery = legacyQuery.eq('model_key', modelKey);
    const legacy = await legacyQuery;
    data = legacy.data as any[] | null;
    error = legacy.error;
  }
  if (error) throw error;
  return (data ?? []).map(mapOverride);
}

export async function loadModelPlanAccess(client: SupabaseClient) {
  const { data, error } = await client.from('model_plan_access_configs')
    .select('model_key,plan_code,access_state,trial_allowance');
  if (error) {
    if (['42P01', 'PGRST204', 'PGRST205'].includes(error.code)) return [];
    throw error;
  }
  return (data ?? []).map((row): StoredModelPlanAccess => ({
    modelKey: String(row.model_key),
    planCode: row.plan_code as ModelPlanCode,
    state: row.access_state,
    trialAllowance: row.trial_allowance == null ? null : Number(row.trial_allowance),
  }));
}

export function applyModelRuntimeOverrides(overrides: readonly ModelRuntimeOverride[], storedAccess: readonly StoredModelPlanAccess[] = []) {
  const overrideByKey = new Map(overrides.map((override) => [override.modelKey, override]));
  const explicitPrimaryModalities = new Set(
    overrides
      .filter((override) => override.enabled && override.routingRole === 'primary')
      .map((override) => override.modality)
  );

  const dynamicModels: RegistryModelReference[] = overrides
    .filter((override) => !MODEL_REGISTRY_REFERENCES.some((model) => model.key === override.modelKey))
    .map((override) => ({
      key: override.modelKey,
      modelId: override.modelId,
      displayName: override.customerDisplayName ?? override.modelId,
      provider: 'VANTRA',
      modality: override.modality,
      availability: 'admin_configured',
      activationSupported: true,
      baseEnabled: false,
      baseRoutingRole: 'unassigned',
      baseCustomerCreditPrice: null,
      baseVisibleInStudio: false,
      baseSortOrder: 100,
      baseCapabilities: emptyModelCapabilities(override.modality),
      baseAllowedPlans: [],
    }));

  return [...MODEL_REGISTRY_REFERENCES, ...dynamicModels].map((model): EffectiveRuntimeModel => {
    const override = overrideByKey.get(model.key);
    const archived = override?.archived ?? false;
    const retired = isRetiredModelReference(model);
    const enabled = !retired && !archived && model.activationSupported && (override ? override.enabled : model.baseEnabled);
    let routingRole = override?.routingRole ?? model.baseRoutingRole;
    if (!override && explicitPrimaryModalities.has(model.modality) && routingRole === 'primary') {
      routingRole = 'unassigned';
    }
    if (!enabled) routingRole = 'unassigned';

    const allowedPlans = override ? override.allowedPlans : [...model.baseAllowedPlans];
    const planAccess = applyStoredModelPlanAccess(
      defaultModelPlanAccess(override?.customerDisplayName ?? model.displayName, model.modality, allowedPlans),
      storedAccess.filter((row) => row.modelKey === model.key)
    );
    const savedCapabilities = override?.capabilitySchemaAvailable
      && (override.capabilitySourceType ?? 'unknown') === 'unknown'
      ? emptyModelCapabilities(model.modality)
      : override?.capabilities ?? model.baseCapabilities;
    return {
      ...model,
      displayName: override?.customerDisplayName ?? model.displayName,
      enabled,
      routingRole,
      customerCreditPrice: override ? override.customerCreditPrice : model.baseCustomerCreditPrice,
      providerCostStatus: override?.providerCostStatus ?? null,
      providerCostMinor: override?.providerCostMinor ?? null,
      providerCostCurrency: override?.providerCostCurrency ?? null,
      shortDescription: override?.customerShortDescription ?? null,
      mediaUrl: override?.customerMediaUrl ?? null,
      category: override?.customerCategory ?? null,
      sortOrder: override?.customerSortOrder ?? model.baseSortOrder,
      visibleInStudio: !retired && (override?.studioVisible ?? model.baseVisibleInStudio),
      availabilityLabel: override?.customerAvailabilityLabel ?? null,
      capabilities: withAdapterInputs(model.key, model.modality, savedCapabilities),
      capabilitySourceType: override?.capabilitySourceType ?? 'unknown',
      capabilityConfidence: override?.capabilityConfidence ?? 'unknown',
      capabilitySyncStatus: override?.capabilitySyncStatus ?? 'partial',
      capabilitySyncError: override?.capabilitySyncError ?? null,
      capabilityLastSyncedAt: override?.capabilityLastSyncedAt ?? null,
      surfaceVisibility: override?.surfaceVisibility ?? normalizeModelSurfaceVisibility(model.modality, null),
      allowedPlans,
      planAccess,
      archived: archived || retired,
      persisted: Boolean(override),
      updatedAt: override?.updatedAt ?? null,
    };
  });
}

export async function getEffectiveRuntimeModels(client?: SupabaseClient) {
  const serverClient = client ?? getSupabaseAdminClient();
  if (!serverClient) throw new Error('MODEL_RUNTIME_CONFIG_UNAVAILABLE');
  const [overrides, access] = await Promise.all([
    loadModelRuntimeOverrides(serverClient),
    loadModelPlanAccess(serverClient),
  ]);
  return applyModelRuntimeOverrides(overrides, access);
}

export async function getStudioRuntimeModels(client?: SupabaseClient): Promise<StudioRuntimeModelDefinition[]> {
  const serverClient = client ?? getSupabaseAdminClient();
  if (!serverClient) throw new Error('MODEL_RUNTIME_CONFIG_UNAVAILABLE');
  const [models, routesResult, providersResult] = await Promise.all([
    getEffectiveRuntimeModels(serverClient),
    serverClient.from('model_provider_routes').select('model_key,provider_id,enabled'),
    serverClient.from('provider_runtime_configs').select('provider_id,enabled,emergency_disabled,display_name,adapter_type,base_endpoint,archived'),
  ]);
  if (routesResult.error) throw routesResult.error;
  if (providersResult.error) throw providersResult.error;
  const providerReady = new Map((providersResult.data ?? []).map((row) => [
    String(row.provider_id),
    Boolean(row.enabled) && !Boolean(row.archived) && !Boolean(row.emergency_disabled)
      && providerConfigurationSummary(String(row.provider_id), row).configured,
  ]));
  const routeReady = new Set((routesResult.data ?? [])
    .filter((row) => row.enabled && providerReady.get(String(row.provider_id)))
    .map((row) => String(row.model_key)));
  const studioModels = models
    .filter((model) => !model.archived && model.visibleInStudio && model.enabled
      && model.surfaceVisibility[model.modality]
      && (model.modality !== 'video' || (
        (model.surfaceVisibility.textToVideo && 'textToVideo' in model.capabilities && model.capabilities.textToVideo)
        || (model.surfaceVisibility.imageToVideo && 'imageToVideo' in model.capabilities && model.capabilities.imageToVideo)
      )))
    .sort((a, b) => a.modality.localeCompare(b.modality) || a.sortOrder - b.sortOrder)
    .map((model) => {
      const billableReady = model.customerCreditPrice != null;
      const modeSupported = model.modality !== 'chat' || ('streaming' in model.capabilities && model.capabilities.streaming);
      const selectable = model.enabled && billableReady && routeReady.has(model.key) && modeSupported;
      const knownAvailability = ['available', 'beta', 'preview', 'unavailable', 'temporarily_unavailable']
        .includes(model.availability)
        ? model.availability
        : null;
      const adminBrand = model.category?.trim() ? model.category.trim() : null;
      const brand = modelBrand(model.displayName, model.modality, model.provider, model.modelId, adminBrand);
      return {
        id: model.modelId,
        displayName: model.displayName,
        provider: model.provider,
        modality: model.modality,
        enabled: selectable,
        availability: selectable
          ? (knownAvailability === 'beta' ? 'beta' : 'available')
          : (knownAvailability === 'preview' ? 'preview' : 'unavailable'),
        verifiedCapabilities: Object.entries(model.capabilities).filter(([, value]) => value === true).map(([key]) => key),
        verifiedCreditCost: model.customerCreditPrice ?? undefined,
        supportedControls: [],
        fallbackAvailable: false,
        displayOrder: model.sortOrder,
        brand: adminBrand ?? brand.name,
        shortDescription: model.shortDescription ?? undefined,
        iconUrl: model.mediaUrl ?? modelIconUrl(brand),
        category: model.category ?? undefined,
        availabilityLabel: model.availabilityLabel ?? undefined,
        capabilities: model.capabilities,
        surfaceVisibility: model.surfaceVisibility,
        allowedPlans: model.allowedPlans,
        planAccess: model.planAccess,
      } satisfies StudioRuntimeModelDefinition;
    })
    .filter((model) => model.enabled);
  return studioModels;
}

export async function requireEffectiveRuntimeModel(modelId: string, modality: StudioModality) {
  const serverClient = getSupabaseAdminClient();
  if (!serverClient) throw new Error('MODEL_RUNTIME_CONFIG_UNAVAILABLE');
  const models = await getEffectiveRuntimeModels(serverClient);
  const model = models.find((candidate) => candidate.modelId === modelId && candidate.modality === modality);
  if (!model) throw new Error('MODEL_NOT_REGISTERED');
  if (model.archived || !model.enabled || !model.activationSupported) throw new Error('MODEL_NOT_AVAILABLE');
  if (model.customerCreditPrice == null) throw new Error('MODEL_CUSTOMER_PRICE_UNCONFIGURED');
  return model;
}

export async function resolveRuntimeModelReference(client: SupabaseClient, modelKey: string) {
  const registryModel = findRegistryModel(modelKey);
  if (registryModel) return registryModel;
  const overrides = await loadModelRuntimeOverrides(client, modelKey);
  const model = applyModelRuntimeOverrides(overrides).find((candidate) => candidate.key === modelKey);
  return model ? {
    key: model.key,
    modelId: model.modelId,
    displayName: model.displayName,
    provider: model.provider,
    modality: model.modality,
    availability: model.availability,
    activationSupported: model.activationSupported,
    baseEnabled: false,
    baseRoutingRole: 'unassigned' as const,
    baseCustomerCreditPrice: null,
    baseVisibleInStudio: false,
    baseSortOrder: model.sortOrder,
    baseCapabilities: model.capabilities,
    baseAllowedPlans: model.allowedPlans,
  } : null;
}
