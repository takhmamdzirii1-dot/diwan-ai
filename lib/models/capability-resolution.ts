import { validateModelCapabilities } from './capability-validation';
import { emptyModelCapabilities, type CapabilityConfidence, type CapabilitySourceType, type CapabilitySyncStatus, type ModelCapabilities } from './capabilities';
import type { StudioModality } from '@/src/config/studio-registry';

export type CapabilitySyncResult = {
  capabilities: ModelCapabilities;
  sourceType: CapabilitySourceType;
  confidence: CapabilityConfidence;
  syncStatus: CapabilitySyncStatus;
  syncError: string | null;
  lastSyncedAt: string;
};

export function resolveCapabilityPriority(input: {
  modality: StudioModality;
  saved: ModelCapabilities;
  savedSource: CapabilitySourceType;
  providerMetadata?: Partial<ModelCapabilities> | null;
  adapterInferred?: Partial<ModelCapabilities> | null;
  now?: string;
}): CapabilitySyncResult {
  const lastSyncedAt = input.now ?? new Date().toISOString();
  if (input.savedSource === 'admin_override') return {
    capabilities: input.saved, sourceType: 'admin_override', confidence: 'manual',
    syncStatus: 'ok', syncError: null, lastSyncedAt,
  };
  const evidence = input.providerMetadata ?? input.adapterInferred;
  if (!evidence) return {
    capabilities: input.savedSource === 'unknown' ? emptyModelCapabilities(input.modality) : input.saved,
    sourceType: input.savedSource, confidence: input.savedSource === 'provider_metadata'
      ? 'verified' : input.savedSource === 'adapter_inferred' ? 'partial' : 'unknown',
    syncStatus: 'partial', syncError: 'Provider capability metadata is unavailable.', lastSyncedAt,
  };
  const candidate = validateModelCapabilities(input.modality, {
    ...emptyModelCapabilities(input.modality),
    ...evidence,
  });
  if (!candidate.success) return {
    capabilities: input.savedSource === 'unknown' ? emptyModelCapabilities(input.modality) : input.saved,
    sourceType: input.savedSource, confidence: input.savedSource === 'provider_metadata'
      ? 'verified' : input.savedSource === 'adapter_inferred' ? 'partial' : 'unknown',
    syncStatus: 'failed', syncError: 'Provider capability metadata failed validation.', lastSyncedAt,
  };
  return {
    capabilities: candidate.data,
    sourceType: input.providerMetadata ? 'provider_metadata' : 'adapter_inferred',
    confidence: input.providerMetadata ? 'verified' : 'partial',
    syncStatus: input.providerMetadata ? 'ok' : 'partial',
    syncError: input.providerMetadata ? null : 'Provider metadata unavailable; using verified adapter inputs only.',
    lastSyncedAt,
  };
}
