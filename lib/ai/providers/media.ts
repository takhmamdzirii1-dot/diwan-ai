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
  aspectRatio?: '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '1:1';
  resolution?: '480p' | '768p';
  mode?: 'speed' | 'quality';
  autoAspectRatio?: boolean;
  webGrounding?: boolean;
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

export type PrunaPredictionStatus = NormalizedMediaProviderResult & {
  state: 'completed' | 'queued';
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
  if (!connection?.configured || !connection.apiKey || !connection.baseUrl
    || !connection.deploymentName) {
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
        body: JSON.stringify({
          model: connection.deploymentName,
          prompt,
          width,
          height,
          output_format: 'png',
          ...(input.autoAspectRatio == null ? {} : { auto_aspect_ratio: input.autoAspectRatio }),
          ...(input.webGrounding == null ? {} : { web_grounding: input.webGrounding }),
        }),
        signal: AbortSignal.timeout(60_000),
        cache: 'no-store',
      }
    );
  } catch (cause) {
    throw new MediaProviderError('PROVIDER_NETWORK_FAILURE', true, { cause });
  }
  const body = await response.json().catch(() => ({})) as {
    id?: string;
    data?: Array<{ b64_json?: string; url?: string }>;
    error?: { code?: string };
  };
  if (!response.ok) throw responseError(response.status, body.error?.code);
  const item = body.data?.find((candidate) =>
    typeof candidate.b64_json === 'string' || typeof candidate.url === 'string');
  if (!item) throw new MediaProviderError('PROVIDER_INVALID_RESPONSE', true);
  return {
    state: 'completed',
    providerOperationId: body.id
      ?? response.headers.get('x-request-id')
      ?? crypto.randomUUID(),
    mediaUrl: item.url,
    mediaBase64: item.b64_json,
    mimeType: 'image/png',
    delivery: item.url ? 'temporary_provider_url' : 'inline_result',
    expiresAt: null,
  };
}

type PrunaPredictionBody = {
  id?: string;
  status?: string;
  generation_url?: string;
  output?: string | { url?: string } | Array<string | { url?: string }>;
  error?: string | { message?: string; code?: string };
};

function prunaOutputUrl(output: PrunaPredictionBody['output']) {
  const candidate = Array.isArray(output) ? output[0] : output;
  if (typeof candidate === 'string') return candidate;
  return candidate?.url;
}

function prunaMediaUrl(body: PrunaPredictionBody) {
  return body.generation_url ?? prunaOutputUrl(body.output);
}

function validatePrunaInput(input: MediaProviderInput) {
  const duration = input.duration ?? 5;
  if (!Number.isSafeInteger(duration) || duration < 5 || duration > 15) {
    throw new MediaProviderError('INVALID_VIDEO_DURATION', false);
  }
  const resolution = input.resolution ?? '768p';
  const mode = input.mode ?? 'quality';
  const aspectRatio = input.aspectRatio ?? '16:9';
  if (!['480p', '768p'].includes(resolution)
    || !['speed', 'quality'].includes(mode)
    || !['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1'].includes(aspectRatio)) {
    throw new MediaProviderError('INVALID_VIDEO_CONFIGURATION', false);
  }
  return { duration, resolution, mode, aspectRatio };
}

function prunaConnection() {
  const connection = getProviderConnection('pruna_ai');
  if (!connection?.configured || !connection.apiKey || !connection.baseUrl) {
    throw new MediaProviderError('PROVIDER_NOT_CONFIGURED', false);
  }
  return connection;
}

export async function submitPrunaVideoRoute(
  route: ResolvedProviderRoute,
  input: MediaProviderInput
): Promise<NormalizedMediaProviderResult> {
  if (route.providerId !== 'pruna_ai' || route.modality !== 'video'
    || route.providerModelId !== 'p-video-2-pro') {
    throw new MediaProviderError('INVALID_PRUNA_ROUTE', false);
  }
  const connection = prunaConnection();
  const prompt = validateInput(route, input);
  const { duration, resolution, mode, aspectRatio } = validatePrunaInput(input);
  let response: Response;
  try {
    response = await fetch(`${connection.baseUrl}/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: connection.apiKey,
        Model: route.providerModelId,
      },
      body: JSON.stringify({
        input: {
          prompt,
          duration,
          resolution,
          mode,
          aspect_ratio: aspectRatio,
          ...(input.referenceImages?.[0] ? { image: input.referenceImages[0] } : {}),
        },
      }),
      signal: AbortSignal.timeout(60_000),
      cache: 'no-store',
    });
  } catch (cause) {
    throw new MediaProviderError('PROVIDER_NETWORK_FAILURE', true, { cause });
  }
  const body = await response.json().catch(() => ({})) as PrunaPredictionBody;
  const providerCode = typeof body.error === 'object' ? body.error.code : undefined;
  if (!response.ok) throw responseError(response.status, providerCode);
  if (!body.id) throw new MediaProviderError('PROVIDER_INVALID_RESPONSE', true);
  return {
    state: body.status === 'succeeded' ? 'completed' : 'queued',
    providerOperationId: body.id,
    mediaUrl: prunaMediaUrl(body),
    rawStatus: body.status,
    delivery: body.status === 'succeeded' ? 'temporary_provider_url' : 'provider_job',
    expiresAt: null,
  };
}

export async function getPrunaPredictionStatus(
  providerOperationId: string
): Promise<PrunaPredictionStatus> {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(providerOperationId)) {
    throw new MediaProviderError('INVALID_PROVIDER_OPERATION_ID', false);
  }
  const connection = prunaConnection();
  let response: Response;
  try {
    response = await fetch(
      `${connection.baseUrl}/predictions/status/${encodeURIComponent(providerOperationId)}`,
      {
        headers: { apikey: connection.apiKey },
        signal: AbortSignal.timeout(30_000),
        cache: 'no-store',
      }
    );
  } catch (cause) {
    throw new MediaProviderError('PROVIDER_NETWORK_FAILURE', true, { cause });
  }
  const body = await response.json().catch(() => ({})) as PrunaPredictionBody;
  const providerCode = typeof body.error === 'object' ? body.error.code : undefined;
  if (!response.ok) throw responseError(response.status, providerCode);
  const status = body.status?.toLowerCase();
  if (!status) throw new MediaProviderError('PROVIDER_INVALID_RESPONSE', true);
  if (status === 'failed' || status === 'canceled') {
    throw new MediaProviderError(
      status === 'canceled' ? 'PROVIDER_CANCELLED' : 'PROVIDER_EXECUTION_FAILED',
      false
    );
  }
  const mediaUrl = prunaMediaUrl(body);
  if (status === 'succeeded' && !mediaUrl) {
    throw new MediaProviderError('PROVIDER_INVALID_RESPONSE', true);
  }
  return {
    state: status === 'succeeded' ? 'completed' : 'queued',
    providerOperationId,
    mediaUrl,
    rawStatus: status,
    delivery: status === 'succeeded' ? 'temporary_provider_url' : 'provider_job',
    expiresAt: null,
  };
}

export async function waitForPrunaPrediction(
  providerOperationId: string,
  options: { maxAttempts?: number; initialDelayMs?: number; signal?: AbortSignal } = {}
) {
  const maxAttempts = Math.min(12, Math.max(1, options.maxAttempts ?? 8));
  const initialDelayMs = Math.min(15_000, Math.max(500, options.initialDelayMs ?? 1_000));
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      const delay = Math.min(15_000, initialDelayMs * (2 ** (attempt - 1)));
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delay);
        options.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new MediaProviderError('REQUEST_CANCELLED', false));
        }, { once: true });
      });
    }
    const result = await getPrunaPredictionStatus(providerOperationId);
    if (result.state === 'completed') return result;
  }
  return getPrunaPredictionStatus(providerOperationId);
}
