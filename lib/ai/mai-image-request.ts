import type { ImageModelCapabilities, ModelAspectRatio } from '@/lib/models/capabilities';

const MAI_IMAGE_DIMENSIONS: Record<ModelAspectRatio, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 },
  '3:2': { width: 1152, height: 768 },
  '2:3': { width: 768, height: 1152 },
};

export class ImageRequestError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'ImageRequestError';
  }
}

export type ValidatedMaiImageRequest = {
  prompt: string;
  modelId: string;
  aspectRatio: ModelAspectRatio;
  outputCount: 1;
  width: number;
  height: number;
  operationId?: string;
};

export function validateMaiImageRequest(
  value: unknown,
  capabilities: ImageModelCapabilities
): ValidatedMaiImageRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ImageRequestError('INVALID_IMAGE_REQUEST');
  }
  const body = value as Record<string, unknown>;
  const allowedKeys = new Set(['prompt', 'modelId', 'aspectRatio', 'outputCount', 'operationId']);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw new ImageRequestError('UNSUPPORTED_IMAGE_PARAMETER');
  }
  if (!capabilities.textToImage) {
    throw new ImageRequestError('MODEL_CAPABILITY_UNSUPPORTED');
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const modelId = typeof body.modelId === 'string' ? body.modelId.trim() : '';
  if (!prompt || prompt.length > 2_000) throw new ImageRequestError('INVALID_PROMPT');
  if (!modelId || modelId.length > 160) throw new ImageRequestError('INVALID_MODEL');

  const requestedRatio = typeof body.aspectRatio === 'string'
    ? body.aspectRatio as ModelAspectRatio
    : capabilities.aspectRatios[0];
  if (!requestedRatio || !capabilities.aspectRatios.includes(requestedRatio)) {
    throw new ImageRequestError('UNSUPPORTED_ASPECT_RATIO');
  }
  const dimensions = MAI_IMAGE_DIMENSIONS[requestedRatio];
  if (!dimensions) throw new ImageRequestError('UNSUPPORTED_ASPECT_RATIO');

  const outputCount = body.outputCount == null ? 1 : Number(body.outputCount);
  if (!Number.isSafeInteger(outputCount) || outputCount !== 1 || outputCount > capabilities.maxOutputs) {
    throw new ImageRequestError('UNSUPPORTED_OUTPUT_COUNT');
  }

  const operationId = body.operationId;
  if (operationId != null && typeof operationId !== 'string') {
    throw new ImageRequestError('INVALID_IDEMPOTENCY_KEY');
  }
  const normalizedOperationId = typeof operationId === 'string' && operationId
    ? operationId
    : undefined;

  return {
    prompt,
    modelId,
    aspectRatio: requestedRatio,
    outputCount: 1,
    ...dimensions,
    ...(normalizedOperationId ? { operationId: normalizedOperationId } : {}),
  };
}
