import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CapabilitySourceType, ModelCapabilities } from './capabilities';
import type { StudioModality } from '@/src/config/studio-registry';
import { providerConfigurationSummary } from '@/lib/ai/providers/registry';
import { resolveCapabilityPriority } from './capability-resolution';
import { CHAT_NATIVE_CAPABILITIES, resolveRouteCapabilities, type ChatNativeCapability, type RouteCapabilityStore } from './capability-v2';
import { lookupModelsDevModel, mapModelsDevCapabilities, modelsDevCatalog, vantraFallbackCapabilities } from './models-dev-catalog';

export type CapabilitySyncDiagnostics = {
  provider: string; route: string; backendModelId: string; canonicalLookupId: string;
  modelsDevMatch: boolean; providerMetadataMatch: boolean; finalSources: string[]; categories: string[];
};

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
    .eq('model_key', input.modelKey).eq('enabled', true).order('priority');
  if (routes.error) throw routes.error;
  let route = routes.data?.[0];
  if (input.modality === 'chat' && routes.data?.length) {
    const providers = await client.from('provider_runtime_configs')
      .select('provider_id,enabled,emergency_disabled,archived,adapter_type,base_endpoint')
      .in('provider_id', [...new Set(routes.data.map((item) => String(item.provider_id)))]);
    if (providers.error) throw providers.error;
    const ready = new Map((providers.data ?? []).map((item) => [String(item.provider_id),
      Boolean(item.enabled) && !Boolean(item.archived) && !Boolean(item.emergency_disabled)
        && providerConfigurationSummary(String(item.provider_id), item).configured]));
    route = routes.data.find((item) => ready.get(String(item.provider_id)));
  }
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
    result.syncError = 'No active configured provider route is available for this model.';
  }
  const routeCapabilitiesV2 = { ...(input.routeCapabilitiesV2 ?? {}) };
  let diagnostics: CapabilitySyncDiagnostics | null = null;
  if (route && input.modality === 'chat') {
    const identity = { id: String(route.id), providerId: String(route.provider_id), providerModelId: String(route.provider_model_id) };
    const catalogResult = await modelsDevCatalog.load();
    const lookup = catalogResult.catalog ? lookupModelsDevModel(catalogResult.catalog, identity) : null;
    const modelsDevEvidence = mapModelsDevCapabilities(lookup?.model ?? null);
    const localFallback = vantraFallbackCapabilities(identity);
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
    const finalSources = [...new Set(Object.values(resolution.resolved).filter((item) => item.state !== 'unknown').map((item) => item.source))];
    const categories = [
      ...(Object.keys(routeProviderEvidence).length ? ['matched_provider_metadata'] : [readerError ? 'metadata_refresh_failed' : 'provider_metadata_unavailable']),
      ...(lookup?.model ? ['matched_models_dev'] : [catalogResult.catalog ? (identity.providerModelId.trim() ? 'model_not_found' : 'provider_model_id_missing') : 'catalog_unavailable']),
      ...(lookup?.aliasUsed ? ['canonical_alias_used'] : []),
      ...(Object.keys(localFallback).length ? ['matched_vantra_fallback'] : []),
    ];
    diagnostics = { provider: identity.providerId, route: identity.id, backendModelId: identity.providerModelId,
      canonicalLookupId: lookup?.canonicalLookupId ?? identity.providerModelId, modelsDevMatch: Boolean(lookup?.model),
      providerMetadataMatch: Object.keys(routeProviderEvidence).length > 0, finalSources, categories };
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
  return { ...result, routeCapabilitiesV2, diagnostics, updatedAt: String(data.updated_at) };
}
