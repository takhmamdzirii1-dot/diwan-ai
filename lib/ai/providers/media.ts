import 'server-only';

import { getProviderConnection } from './registry';
import type { ResolvedProviderRoute } from './routes';
import { runRunwareTask } from '@/lib/ai/image-providers/runware';

export type MediaProviderInput = {
  prompt: string;
  width?: number;
  height?: number;
  duration?: number;
  referenceImages?: readonly string[];
};

export type NormalizedMediaProviderResult = {
  state: 'completed' | 'queued';
  providerOperationId: string;
  mediaUrl?: string;
  mediaBase64?: string;
  mimeType?: string;
  actualCost?: number;
  rawStatus?: string;
  delivery: 'temporary_provider_url' | 'inline_result' | 'provider_job';
  expiresAt: string | null;
};

export class MediaProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
    options?: { cause?: unknown }
  ) {
    super(code, options);
    this.name = 'MediaProviderError';
  }
}

function validateInput(route: ResolvedProviderRoute, input: MediaProviderInput) {
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > 2_000) throw new MediaProviderError('INVALID_PROMPT', false);
  if (input.referenceImages && input.referenceImages.length > 10) {
    throw new MediaProviderError('TOO_MANY_REFERENCE_IMAGES', false);
  }
  if (route.modality === 'image') {
    const width = input.width ?? 1024;
    const height = input.height ?? 1024;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
      || width < 256 || height < 256 || width > 2048 || height > 2048
      || width % 64 !== 0 || height % 64 !== 0) {
      throw new MediaProviderError('INVALID_IMAGE_DIMENSIONS', false);
    }
  }
  if (route.modality === 'video') {
    const duration = input.duration ?? 5;
    if (!Number.isSafeInteger(duration) || duration < 1 || duration > 20) {
      throw new MediaProviderError('INVALID_VIDEO_DURATION', false);
    }
  }
  return prompt;
}

function responseError(status: number, providerCode?: string) {
  const retryable = status === 408 || status === 409 || status === 429 || status >= 500;
  return new MediaProviderError(
    providerCode ? `PROVIDER_${providerCode.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`
      : retryable ? 'PROVIDER_TRANSIENT_FAILURE' : 'PROVIDER_REQUEST_REJECTED',
    retryable
  );
}

export async function generateWithRunwareRoute(
  route: ResolvedProviderRoute,
  input: MediaProviderInput
): Promise<NormalizedMediaProviderResult> {
  if (route.providerId !== 'runware' || !['image', 'video'].includes(route.modality)) {
    throw new MediaProviderError('INVALID_RUNWARE_ROUTE', false);
  }
  const connection = getProviderConnection('runware');
  if (!connection?.configured) {
    throw new MediaProviderError('PROVIDER_NOT_CONFIGURED', false);
  }
  const prompt = validateInput(route, input);
  const modality: 'image' | 'video' = route.modality === 'video' ? 'video' : 'image';
  const task = await runRunwareTask({
    modality,
    prompt,
    model: route.providerModelId,
    width: input.width,
    height: input.height,
    duration: input.duration,
    referenceImages: input.referenceImages,
  });
  if (!task.success || !task.item) {
    throw new MediaProviderError(
      task.providerCode ? `PROVIDER_${task.providerCode.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}` : 'PROVIDER_EXECUTION_FAILED',
      task.retryable
    );
  }
  const result = task.item;
  const mediaUrl = typeof result.imageURL === 'string' ? result.imageURL : result.videoURL;
  const operationId = result.taskUUID ?? task.taskUUID;
  return {
    state: mediaUrl ? 'completed' : 'queued',
    providerOperationId: operationId,
    mediaUrl,
    actualCost: typeof result.cost === 'number' ? result.cost : undefined,
    rawStatus: typeof result.status === 'string' ? result.status : undefined,
    delivery: mediaUrl ? 'temporary_provider_url' : 'provider_job',
    expiresAt: null,
  };
}

export async function generateWithMicrosoftFoundryRoute(
  route: ResolvedProviderRoute,
  input: MediaProviderInput
): Promise<NormalizedMediaProviderResult> {
  if (route.providerId !== 'microsoft_foundry' || route.modality !== 'image') {
    throw new MediaProviderError('INVALID_MICROSOFT_FOUNDRY_ROUTE', false);
  }
  const connection = getProviderConnection('microsoft_foundry');
  if (!connection?.configured || !connection.apiKey || !connection.baseUrl) {
    throw new MediaProviderError('PROVIDER_NOT_CONFIGURED', false);
  }
  const prompt = validateInput(route, input);
  const width = input.width ?? 1024;
  const height = input.height ?? 1024;
  if (width < 768 || height < 768 || width * height > 1_048_576) {
    throw new MediaProviderError('INVALID_IMAGE_DIMENSIONS', false);
  }

  let response: Response;
  try {
    response = await fetch(
      `${connection.baseUrl.replace(/\/$/, '')}/mai/v1/images/generations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': connection.apiKey },
        body: JSON.stringify({ model: route.providerModelId, prompt, width, height }),
        signal: AbortSignal.timeout(60_000),
        cache: 'no-store',
      }
    );
  } catch (cause) {
    throw new MediaProviderError('PROVIDER_NETWORK_FAILURE', true, { cause });
  }
  const body = await response.json().catch(() => ({})) as {
    data?: Array<{ b64_json?: string }>;
    error?: { code?: string };
  };
  if (!response.ok) throw responseError(response.status, body.error?.code);
  const image = body.data?.find((item) => typeof item.b64_json === 'string')?.b64_json;
  if (!image) throw new MediaProviderError('PROVIDER_INVALID_RESPONSE', true);
  return {
    state: 'completed',
    providerOperationId: crypto.randomUUID(),
    mediaBase64: image,
    mimeType: 'image/png',
    delivery: 'inline_result',
    expiresAt: null,
  };
}
