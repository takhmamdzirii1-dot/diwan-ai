import type {
  ModelAspectRatio,
  ModelVideoDuration,
  VideoModelCapabilities,
} from '@/lib/models/capabilities';

export const PRUNA_VIDEO_MODEL_ID = 'vantra-p-video-2-pro';
export const PRUNA_VIDEO_RESOLUTIONS = ['480p', '768p'] as const;
export const PRUNA_VIDEO_MODES = ['speed', 'quality'] as const;
export const PRUNA_VIDEO_SOURCE_MODES = ['text', 'image'] as const;
export const PRUNA_SOURCE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PRUNA_SOURCE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export type PrunaVideoResolution = (typeof PRUNA_VIDEO_RESOLUTIONS)[number];
export type PrunaVideoMode = (typeof PRUNA_VIDEO_MODES)[number];
export type PrunaVideoSourceMode = (typeof PRUNA_VIDEO_SOURCE_MODES)[number];

export class VideoRequestError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'VideoRequestError';
  }
}

export type ValidatedPrunaVideoRequest = {
  prompt: string;
  modelId: typeof PRUNA_VIDEO_MODEL_ID;
  sourceMode: PrunaVideoSourceMode;
  sourceImage?: File;
  endImage?: File;
  duration: ModelVideoDuration;
  aspectRatio?: ModelAspectRatio;
  resolution: PrunaVideoResolution;
  mode: PrunaVideoMode;
  operationId?: string;
};

export function validatePrunaVideoRequest(
  value: unknown,
  capabilities: VideoModelCapabilities,
  sourceImage?: unknown,
  endImage?: unknown
): ValidatedPrunaVideoRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new VideoRequestError('INVALID_VIDEO_REQUEST');
  }
  const body = value as Record<string, unknown>;
  const allowedKeys = new Set([
    'prompt', 'modelId', 'sourceMode', 'duration', 'aspectRatio', 'resolution', 'mode', 'operationId',
  ]);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw new VideoRequestError('UNSUPPORTED_VIDEO_PARAMETER');
  }
  const sourceMode = (body.sourceMode ?? 'text') as PrunaVideoSourceMode;
  if (!PRUNA_VIDEO_SOURCE_MODES.includes(sourceMode)) {
    throw new VideoRequestError('UNSUPPORTED_VIDEO_SOURCE_MODE');
  }
  if (sourceMode === 'text' ? !capabilities.textToVideo : !capabilities.imageToVideo) {
    throw new VideoRequestError('MODEL_CAPABILITY_UNSUPPORTED');
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > 2_000) throw new VideoRequestError('INVALID_PROMPT');
  if (body.modelId !== PRUNA_VIDEO_MODEL_ID) throw new VideoRequestError('INVALID_MODEL');

  const requestedDuration = body.duration == null ? capabilities.durations[0] : Number(body.duration);
  if (!Number.isSafeInteger(requestedDuration) || requestedDuration! < 5 || requestedDuration! > 15
    || !capabilities.durations.includes(requestedDuration as ModelVideoDuration)) {
    throw new VideoRequestError('UNSUPPORTED_VIDEO_DURATION');
  }
  const duration = requestedDuration as ModelVideoDuration;
  let aspectRatio: ModelAspectRatio | undefined;
  if (sourceMode === 'image') {
    if (body.aspectRatio != null) throw new VideoRequestError('UNSUPPORTED_VIDEO_PARAMETER');
    if (!(sourceImage instanceof File) || sourceImage.size === 0
      || sourceImage.size > PRUNA_SOURCE_IMAGE_MAX_BYTES
      || !PRUNA_SOURCE_IMAGE_TYPES.includes(sourceImage.type as (typeof PRUNA_SOURCE_IMAGE_TYPES)[number])) {
      throw new VideoRequestError('INVALID_SOURCE_IMAGE');
    }
    if (endImage != null && (!(endImage instanceof File) || endImage.size === 0
      || endImage.size > PRUNA_SOURCE_IMAGE_MAX_BYTES
      || !PRUNA_SOURCE_IMAGE_TYPES.includes(endImage.type as (typeof PRUNA_SOURCE_IMAGE_TYPES)[number]))) {
      throw new VideoRequestError('INVALID_END_IMAGE');
    }
  } else {
    if (sourceImage != null || endImage != null) throw new VideoRequestError('UNSUPPORTED_VIDEO_PARAMETER');
    aspectRatio = (body.aspectRatio ?? capabilities.aspectRatios[0]) as ModelAspectRatio;
    if (!capabilities.aspectRatios.includes(aspectRatio)) {
      throw new VideoRequestError('UNSUPPORTED_ASPECT_RATIO');
    }
  }
  const resolution = (body.resolution ?? '768p') as PrunaVideoResolution;
  if (!PRUNA_VIDEO_RESOLUTIONS.includes(resolution)) {
    throw new VideoRequestError('UNSUPPORTED_VIDEO_RESOLUTION');
  }
  const mode = (body.mode ?? 'speed') as PrunaVideoMode;
  if (!PRUNA_VIDEO_MODES.includes(mode)) {
    throw new VideoRequestError('UNSUPPORTED_VIDEO_MODE');
  }
  if (body.operationId != null && typeof body.operationId !== 'string') {
    throw new VideoRequestError('INVALID_IDEMPOTENCY_KEY');
  }

  return {
    prompt,
    modelId: PRUNA_VIDEO_MODEL_ID,
    sourceMode,
    ...(sourceMode === 'image' ? { sourceImage: sourceImage as File } : {}),
    ...(sourceMode === 'image' && endImage instanceof File ? { endImage } : {}),
    duration,
    ...(aspectRatio ? { aspectRatio } : {}),
    resolution,
    mode,
    ...(typeof body.operationId === 'string' && body.operationId
      ? { operationId: body.operationId }
      : {}),
  };
}

/** Published Pruna pricing, represented in half-cents per output second. */
const COST_HALF_CENTS_PER_SECOND = {
  '480p': { speed: 4, quality: 8 },
  '768p': { speed: 7, quality: 15 },
} as const;

export function prunaProviderCostMinor(input: Pick<ValidatedPrunaVideoRequest, 'duration' | 'resolution' | 'mode'>) {
  const halfCents = COST_HALF_CENTS_PER_SECOND[input.resolution][input.mode] * input.duration;
  return halfCents % 2 === 0 ? halfCents / 2 : null;
}
