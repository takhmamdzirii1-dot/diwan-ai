import type { ModelCapabilities, ModelSurfaceVisibility, VideoModelCapabilities } from './capabilities';
import type { StudioModality } from '@/src/config/studio-registry';

export type StudioVisibilityCandidate = {
  modality: StudioModality;
  enabled: boolean;
  archived: boolean;
  visibleInStudio: boolean;
  surfaceVisibility: ModelSurfaceVisibility;
  capabilities: ModelCapabilities;
};

/** Catalog visibility is independent from plan access and runtime readiness. */
export function isStudioCatalogVisible(model: StudioVisibilityCandidate) {
  if (model.archived || !model.enabled || !model.visibleInStudio) return false;
  if (!model.surfaceVisibility[model.modality]) return false;
  if (model.modality !== 'video') return true;

  const capabilities = model.capabilities as VideoModelCapabilities;
  return (model.surfaceVisibility.textToVideo && capabilities.textToVideo)
    || (model.surfaceVisibility.imageToVideo && capabilities.imageToVideo);
}

/** Chat capability provenance must not hide an otherwise configured route. */
export function isStudioRuntimeReady(model: Pick<StudioVisibilityCandidate, 'modality' | 'capabilities'> & {
  customerCreditPrice: number | null;
}, routeReady: boolean) {
  if (model.customerCreditPrice == null || !routeReady) return false;
  if (model.modality !== 'video') return true;

  const capabilities = model.capabilities as VideoModelCapabilities;
  return capabilities.textToVideo || capabilities.imageToVideo;
}
