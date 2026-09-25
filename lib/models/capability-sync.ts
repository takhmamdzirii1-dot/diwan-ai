import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CapabilitySourceType, ModelCapabilities } from './capabilities';
import type { StudioModality } from '@/src/config/studio-registry';
import { resolveCapabilityPriority } from './capability-resolution';
import { CHAT_NATIVE_CAPABILITIES, resolveRouteCapabilities, type ChatNativeCapability, type RouteCapabilityStore } from './capability-v2';
import { findModelsDevModel, mapModelsDevCapabilities, modelsDevCatalog, vantraFallbackCapabilities } from './models-dev-catalog';

type ReaderInput = { providerId: string; providerModelId: string; modality: StudioModality };
type CapabilityReader = (input: ReaderInput) => Promise<Partial<ModelCapabilities> | null>;

// A reader must only return fields evidenced by its provider's API or by the
// exact adapter request contract. Missing native fields remain Unknown.
const providerMetadataReaders: Partial<Record<string, CapabilityReader>> = {};
const adapterReaders: Partial<Record<string, CapabilityReader>> = {
  pruna_ai: async ({ providerModelId, modality }) => {
    if (modality !== 'video' || providerModelId !== 'p-video-2-pro') return null;
    // Exact P-Video-2 Pro request contract. Pruna documents both modes,
    // first/last frames, 5–15 s, and 480p/768p. A reference image determines
    // I2V aspect ratio, so that control remains unavailable in I2V.
    return {
      textToVideo: true,
      imageToVideo: true,
      startImage: true,
      endImage: true,
      durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      aspectRatios: ['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1'],
      resolutions: ['480p', '768p'],
      generationModes: ['speed', 'quality'],
      imageToVideoAspectRatios: [],
      imageToVideoResolutions: ['480p', '768p'],
      imageToVideoGenerationModes: ['speed', 'quality'],
    };
  },
};

export async function syncModelCapabilities(client: SupabaseClient, input: {
  modelKey: string;
  modelId: string;
  modality: StudioModality;
  capabilities: ModelCapabilities;
  sourceType: CapabilitySourceType;
  actorId: string;
  routeCapabilitiesV2?: RouteCapabilityStore;
}) {
  const routes = await client.from('model_provider_routes')
    .select('id,provider_id,provider_model_id,priority')
    .eq('model_key', input.modelKey).eq('enabled', true).order('priority').limit(1);
  if (routes.error) throw routes.error;
  const route = routes.data?.[0];
  let providerMetadata: Partial<ModelCapabilities> | null = null;
  let adapterInferred: Partial<ModelCapabilities> | null = null;
  let readerError: string | null = null;
  if (route) {
    const readerInput = {
      providerId: String(route.provider_id), providerModelId: String(route.provider_model_id),
      modality: input.modality,
    };
    try {
      providerMetadata = await providerMetadataReaders[readerInput.providerId]?.(readerInput) ?? null;
      if (!providerMetadata) adapterInferred = await adapterReaders[readerInput.providerId]?.(readerInput) ?? null;
    } catch {
      readerError = 'Provider capability metadata refresh failed.';
    }
  }
  const result = resolveCapabilityPriority({
    modality: input.modality, saved: input.capabilities, savedSource: input.sourceType,
    providerMetadata, adapterInferred,
  });
  if (readerError) {
    result.syncStatus = 'failed';
    result.syncError = readerError;
  } else if (!route) {
    result.syncStatus = 'partial';
    result.syncError = 'No enabled provider route is configured for this model.';
  }
  const routeCapabilitiesV2 = { ...(input.routeCapabilitiesV2 ?? {}) };
  if (route && input.modality === 'chat') {
    const identity = { id: String(route.id), providerId: String(route.provider_id), providerModelId: String(route.provider_model_id) };
    const catalogResult = await modelsDevCatalog.load();
    const catalogModel = catalogResult.catalog ? findModelsDevModel(catalogResult.catalog, identity) : null;
    const modelsDevEvidence = mapModelsDevCapabilities(catalogModel);
    const localFallback = catalogModel ? undefined : vantraFallbackCapabilities(identity);
    const routeProviderEvidence: Partial<Record<ChatNativeCapability, boolean>> = {};
    const providerFields = providerMetadata as Record<string, unknown> | null;
    for (const key of CHAT_NATIVE_CAPABILITIES) {
      if (typeof providerFields?.[key] === 'boolean') routeProviderEvidence[key] = providerFields[key] as boolean;
    }
    const resolution = resolveRouteCapabilities({ route: identity, stored: routeCapabilitiesV2,
      providerMetadata: routeProviderEvidence,
      modelsDev: modelsDevEvidence, modelsDevCheckedAt: catalogResult.checkedAt,
      catalog: localFallback, now: result.lastSyncedAt });
    routeCapabilitiesV2[identity.id] = resolution.record;
    const hasResolvedEvidence = Object.values(resolution.resolved).some((entry) => entry.state !== 'unknown');
    if (catalogResult.status === 'stale') {
      result.syncStatus = 'partial';
      result.syncError = 'Capability catalog could not be refreshed. Last known safe evidence is being used.';
    } else if (catalogResult.status === 'unavailable' && hasResolvedEvidence && !Object.keys(localFallback ?? {}).length) {
      result.syncStatus = 'partial';
      result.syncError = 'Capability catalog could not be refreshed. Last known safe evidence is being used.';
    } else if (catalogResult.status === 'unavailable' && !hasResolvedEvidence) {
      result.syncStatus = 'partial';
      result.syncError = 'No verified capability information is available for this route. Unknown features remain disabled.';
    } else if (!providerMetadata && Object.keys(modelsDevEvidence).length) {
      result.syncStatus = 'partial';
      result.syncError = 'Provider metadata is unavailable. Models.dev catalog evidence is being used.';
    } else if (!providerMetadata && Object.keys(localFallback ?? {}).length) {
      result.syncStatus = 'partial';
      result.syncError = 'Provider metadata is unavailable. VANTRA catalog evidence is being used.';
    } else if (!providerMetadata && hasResolvedEvidence) {
      result.syncStatus = 'partial';
      result.syncError = 'Fresh metadata is unavailable. Last known safe route evidence is being used.';
    } else if (!hasResolvedEvidence) {
      result.syncStatus = 'partial';
      result.syncError = 'No verified capability information is available for this route. Unknown features remain disabled.';
    }
  }
  const update = {
    capabilities: result.capabilities,
    capability_source_type: result.sourceType,
    capability_confidence: result.confidence,
    capability_sync_status: result.syncStatus,
    capability_sync_error: result.syncError,
    capability_last_synced_at: result.lastSyncedAt,
    route_capabilities_v2: routeCapabilitiesV2,
    updated_by: input.actorId,
  };
  let { data, error } = await client.from('model_runtime_configs').update(update)
    .eq('model_key', input.modelKey).eq('model_id', input.modelId).select('updated_at').maybeSingle();
  if (error && ['42703', 'PGRST204'].includes(error.code)) {
    const { route_capabilities_v2: _pendingMigration, ...legacyUpdate } = update;
    const fallback = await client.from('model_runtime_configs').update(legacyUpdate)
      .eq('model_key', input.modelKey).eq('model_id', input.modelId).select('updated_at').maybeSingle();
    data = fallback.data; error = fallback.error;
  }
  if (error || !data) throw new Error(error?.message ?? 'MODEL_RUNTIME_CONFIG_REQUIRED');
  return { ...result, routeCapabilitiesV2, updatedAt: String(data.updated_at) };
}
