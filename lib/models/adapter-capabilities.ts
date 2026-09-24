import type { ModelCapabilities, VideoModelCapabilities } from './capabilities';
import type { StudioModality } from '@/src/config/studio-registry';

/** Inputs demonstrated by the exact request adapter, never inferred from labels. */
export function withAdapterInputs(modelKey: string, modality: StudioModality, saved: ModelCapabilities): ModelCapabilities {
  if (modelKey !== 'vantra:video:p-video-2-pro' || modality !== 'video') return saved;
  const video = saved as VideoModelCapabilities;
  return {
    ...video,
    resolutions: video.resolutions ?? ['480p', '768p'],
    generationModes: video.generationModes ?? ['speed', 'quality'],
    outputTypes: video.outputTypes ?? ['video/mp4'],
  };
}
