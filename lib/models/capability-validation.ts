import { z } from 'zod';
import {
  MODEL_ASPECT_RATIOS,
  MODEL_CAMERA_MOTIONS,
  MODEL_VIDEO_DURATIONS,
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
}).strict();

const videoCapabilities = z.object({
  textToVideo: z.boolean(),
  imageToVideo: z.boolean(),
  durations: z.array(z.union(MODEL_VIDEO_DURATIONS.map((value) => z.literal(value)) as [z.ZodLiteral<5>, z.ZodLiteral<10>, z.ZodLiteral<15>])).max(MODEL_VIDEO_DURATIONS.length),
  aspectRatios: z.array(z.enum(MODEL_ASPECT_RATIOS)).max(MODEL_ASPECT_RATIOS.length),
  cameraMotions: z.array(z.enum(MODEL_CAMERA_MOTIONS)).max(MODEL_CAMERA_MOTIONS.length),
  generatedAudio: z.boolean(),
  negativePrompt: z.boolean(),
}).strict();

const schemas = { chat: chatCapabilities, image: imageCapabilities, video: videoCapabilities } as const;

export function validateModelCapabilities(modality: StudioModality, value: unknown) {
  return schemas[modality].safeParse(value) as z.SafeParseReturnType<unknown, ModelCapabilities>;
}

export function normalizeModelCapabilities(modality: StudioModality, value: unknown): ModelCapabilities {
  const result = validateModelCapabilities(modality, value);
  return result.success ? result.data : emptyModelCapabilities(modality);
}
