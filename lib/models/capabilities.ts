import type { StudioModality } from '@/src/config/studio-registry';

export const MODEL_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] as const;
export const MODEL_VIDEO_DURATIONS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
export const MODEL_CAMERA_MOTIONS = ['auto', 'static', 'push-in', 'pull-out', 'pan-left', 'pan-right', 'orbit'] as const;
export const MODEL_VIDEO_RESOLUTIONS = ['480p', '768p'] as const;
export const MODEL_VIDEO_GENERATION_MODES = ['speed', 'quality'] as const;

export type ModelAspectRatio = (typeof MODEL_ASPECT_RATIOS)[number];
export type ModelVideoDuration = (typeof MODEL_VIDEO_DURATIONS)[number];
export type ModelCameraMotion = (typeof MODEL_CAMERA_MOTIONS)[number];
export type ModelVideoResolution = (typeof MODEL_VIDEO_RESOLUTIONS)[number];
export type ModelVideoGenerationMode = (typeof MODEL_VIDEO_GENERATION_MODES)[number];

export type CapabilitySourceType = 'admin_override' | 'provider_metadata' | 'adapter_inferred' | 'unknown';
export type CapabilityConfidence = 'verified' | 'partial' | 'manual' | 'unknown';
export type CapabilitySyncStatus = 'ok' | 'partial' | 'failed';
export type ModelSurfaceVisibility = {
  chat: boolean;
  image: boolean;
  video: boolean;
  textToVideo: boolean;
  imageToVideo: boolean;
  videoToVideo: boolean;
};

export function defaultModelSurfaceVisibility(modality: StudioModality): ModelSurfaceVisibility {
  return {
    chat: modality === 'chat', image: modality === 'image', video: modality === 'video',
    textToVideo: modality === 'video', imageToVideo: modality === 'video', videoToVideo: false,
  };
}

export function normalizeModelSurfaceVisibility(modality: StudioModality, value: unknown): ModelSurfaceVisibility {
  const defaults = defaultModelSurfaceVisibility(modality);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) =>
    [key, typeof record[key] === 'boolean' ? record[key] : fallback]
  )) as ModelSurfaceVisibility;
}

export type ChatModelCapabilities = {
  streaming: boolean;
  visionInput: boolean;
  fileInput: boolean;
  tools: boolean;
};

export type ImageModelCapabilities = {
  textToImage: boolean;
  referenceImage: boolean;
  aspectRatios: ModelAspectRatio[];
  maxOutputs: number;
  negativePrompt: boolean;
  editing?: boolean;
  inpainting?: boolean;
  seed?: boolean;
  upscale?: boolean;
  maxPromptChars?: number;
  outputTypes?: string[];
};

export type VideoModelCapabilities = {
  textToVideo: boolean;
  imageToVideo: boolean;
  durations: ModelVideoDuration[];
  aspectRatios: ModelAspectRatio[];
  cameraMotions: ModelCameraMotion[];
  generatedAudio: boolean;
  negativePrompt: boolean;
  videoToVideo?: boolean;
  startImage?: boolean;
  endImage?: boolean;
  referenceImage?: boolean;
  seed?: boolean;
  maxPromptChars?: number;
  resolutions?: ModelVideoResolution[];
  generationModes?: ModelVideoGenerationMode[];
  imageToVideoAspectRatios?: ModelAspectRatio[];
  imageToVideoResolutions?: ModelVideoResolution[];
  imageToVideoGenerationModes?: ModelVideoGenerationMode[];
  outputTypes?: string[];
};

export type ModelCapabilities = ChatModelCapabilities | ImageModelCapabilities | VideoModelCapabilities;

const EMPTY_CHAT: ChatModelCapabilities = { streaming: false, visionInput: false, fileInput: false, tools: false };
const EMPTY_IMAGE: ImageModelCapabilities = { textToImage: false, referenceImage: false, aspectRatios: [], maxOutputs: 1, negativePrompt: false };
const EMPTY_VIDEO: VideoModelCapabilities = { textToVideo: false, imageToVideo: false, durations: [], aspectRatios: [], cameraMotions: [], generatedAudio: false, negativePrompt: false };

export function emptyModelCapabilities(modality: StudioModality): ModelCapabilities {
  if (modality === 'chat') return { ...EMPTY_CHAT };
  if (modality === 'image') return { ...EMPTY_IMAGE, aspectRatios: [] };
  return { ...EMPTY_VIDEO, durations: [], aspectRatios: [], cameraMotions: [] };
}
