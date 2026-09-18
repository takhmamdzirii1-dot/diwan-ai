import type { StudioModality } from '@/src/config/studio-registry';

export const MODEL_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] as const;
export const MODEL_VIDEO_DURATIONS = [5, 10, 15] as const;
export const MODEL_CAMERA_MOTIONS = ['auto', 'static', 'push-in', 'pull-out', 'pan-left', 'pan-right', 'orbit'] as const;

export type ModelAspectRatio = (typeof MODEL_ASPECT_RATIOS)[number];
export type ModelVideoDuration = (typeof MODEL_VIDEO_DURATIONS)[number];
export type ModelCameraMotion = (typeof MODEL_CAMERA_MOTIONS)[number];

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
};

export type VideoModelCapabilities = {
  textToVideo: boolean;
  imageToVideo: boolean;
  durations: ModelVideoDuration[];
  aspectRatios: ModelAspectRatio[];
  cameraMotions: ModelCameraMotion[];
  generatedAudio: boolean;
  negativePrompt: boolean;
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
