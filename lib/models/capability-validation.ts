import { z } from 'zod';
import {
  MODEL_ASPECT_RATIOS,
  MODEL_CAMERA_MOTIONS,
  MODEL_VIDEO_DURATIONS,
  MODEL_VIDEO_RESOLUTIONS,
  MODEL_VIDEO_GENERATION_MODES,
  emptyModelCapabilities,
  type ModelCapabilities,
} from './capabilities';
import type { StudioModality } from '@/src/config/studio-registry';

const chatCapabilities = z.object({
  streaming: z.boolean(),
  visionInput: z.boolean(),
  fileInput: z.boolean(),
  tools: z.boolean(),
}).strict();

const imageCapabilities = z.object({
  textToImage: z.boolean(),
  referenceImage: z.boolean(),
  aspectRatios: z.array(z.enum(MODEL_ASPECT_RATIOS)).max(MODEL_ASPECT_RATIOS.length),
  maxOutputs: z.number().int().min(1).max(4),
  negativePrompt: z.boolean(),
  editing: z.boolean().optional(),
  inpainting: z.boolean().optional(),
  seed: z.boolean().optional(),
  upscale: z.boolean().optional(),
  maxPromptChars: z.number().int().positive().max(100000).optional(),
  outputTypes: z.array(z.string().min(1).max(100)).max(10).optional(),
}).strict();

const videoCapabilities = z.object({
  textToVideo: z.boolean(),
  imageToVideo: z.boolean(),
  durations: z.array(z.number().int().min(5).max(15)).max(MODEL_VIDEO_DURATIONS.length),
  aspectRatios: z.array(z.enum(MODEL_ASPECT_RATIOS)).max(MODEL_ASPECT_RATIOS.length),
  cameraMotions: z.array(z.enum(MODEL_CAMERA_MOTIONS)).max(MODEL_CAMERA_MOTIONS.length),
  generatedAudio: z.boolean(),
  negativePrompt: z.boolean(),
  videoToVideo: z.boolean().optional(),
  startImage: z.boolean().optional(),
  endImage: z.boolean().optional(),
  referenceImage: z.boolean().optional(),
  seed: z.boolean().optional(),
  maxPromptChars: z.number().int().positive().max(100000).optional(),
  resolutions: z.array(z.enum(MODEL_VIDEO_RESOLUTIONS)).max(MODEL_VIDEO_RESOLUTIONS.length).optional(),
  generationModes: z.array(z.enum(MODEL_VIDEO_GENERATION_MODES)).max(MODEL_VIDEO_GENERATION_MODES.length).optional(),
  imageToVideoAspectRatios: z.array(z.enum(MODEL_ASPECT_RATIOS)).max(MODEL_ASPECT_RATIOS.length).optional(),
  imageToVideoResolutions: z.array(z.enum(MODEL_VIDEO_RESOLUTIONS)).max(MODEL_VIDEO_RESOLUTIONS.length).optional(),
  imageToVideoGenerationModes: z.array(z.enum(MODEL_VIDEO_GENERATION_MODES)).max(MODEL_VIDEO_GENERATION_MODES.length).optional(),
  outputTypes: z.array(z.string().min(1).max(100)).max(10).optional(),
}).strict();

const schemas = { chat: chatCapabilities, image: imageCapabilities, video: videoCapabilities } as const;

export function validateModelCapabilities(modality: StudioModality, value: unknown) {
  return schemas[modality].safeParse(value) as z.SafeParseReturnType<unknown, ModelCapabilities>;
}

export function normalizeModelCapabilities(modality: StudioModality, value: unknown): ModelCapabilities {
  const result = validateModelCapabilities(modality, value);
  return result.success ? result.data : emptyModelCapabilities(modality);
}
