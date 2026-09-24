import type { ModelSurfaceVisibility, VideoModelCapabilities } from './capabilities';

export function videoSourceModes(capabilities: VideoModelCapabilities | null | undefined,
  visibility?: ModelSurfaceVisibility) {
  if (!capabilities || visibility?.video === false) return [] as ('text' | 'image')[];
  return [
    capabilities.textToVideo && visibility?.textToVideo !== false ? 'text' : null,
    capabilities.imageToVideo && visibility?.imageToVideo !== false ? 'image' : null,
  ].filter((mode): mode is 'text' | 'image' => mode !== null);
}

export function videoControlProfile(capabilities: VideoModelCapabilities | null | undefined,
  mode: 'text' | 'image') {
  return {
    durations: capabilities?.durations ?? [],
    aspectRatios: mode === 'text' ? capabilities?.aspectRatios ?? [] : capabilities?.imageToVideoAspectRatios ?? [],
    resolutions: mode === 'text' ? capabilities?.resolutions ?? [] : capabilities?.imageToVideoResolutions ?? [],
    generationModes: mode === 'text' ? capabilities?.generationModes ?? [] : capabilities?.imageToVideoGenerationModes ?? [],
    startImage: mode === 'image' && Boolean(capabilities?.imageToVideo),
    endImage: mode === 'image' && Boolean(capabilities?.imageToVideo && capabilities.endImage),
  };
}
