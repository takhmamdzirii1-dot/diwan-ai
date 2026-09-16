import 'server-only';

import type { ImageGenerateParams, ImageGenerationResult, ImageProvider } from './types';
import { runwareMeta, RUNWARE_TEST_MODEL } from './runware-meta';

const RUNWARE_ENDPOINT = 'https://api.runware.ai/v1';

export const VERIFIED_RUNWARE_MODELS = new Set([
  RUNWARE_TEST_MODEL,
  'minimax:h3@max',
  'minimax:h3@max-turbo',
  'prunaai:p-video@0',
  'prunaai:p-video@2',
  'meta:muse@image',
  'runware:z-image@0',
]);

type RunwareDataItem = {
  taskType?: string;
  taskUUID?: string;
  imageUUID?: string;
  imageURL?: string;
  videoURL?: string;
  status?: string;
  seed?: number;
  cost?: number;
};

type RunwareErrorItem = {
  code?: string;
  message?: string;
  taskUUID?: string;
};

type RunwareApiResponse = {
  data?: RunwareDataItem[];
  errors?: RunwareErrorItem[];
};

export type RunwareTaskParams = {
  modality: 'image' | 'video';
  prompt: string;
  model: string;
  width?: number;
  height?: number;
  duration?: number;
  referenceImages?: readonly string[];
};

export type RunwareTaskResult = {
  success: boolean;
  taskUUID: string;
  item?: RunwareDataItem;
  providerCode?: string;
  error?: string;
  retryable: boolean;
};

export async function runRunwareTask(params: RunwareTaskParams): Promise<RunwareTaskResult> {
  const apiKey = process.env.RUNWARE_API_KEY;
  const taskUUID = crypto.randomUUID();
  const prompt = params.prompt.trim();
  if (!apiKey) return { success: false, taskUUID, error: 'Provider is not configured', retryable: false };
  if (!prompt) return { success: false, taskUUID, error: 'Prompt is required', retryable: false };
  if (!VERIFIED_RUNWARE_MODELS.has(params.model)) {
    return { success: false, taskUUID, error: 'Model is not allowed', retryable: false };
  }
  const isVideo = params.modality === 'video';
  const payload: Record<string, unknown> = {
    taskType: isVideo ? 'videoInference' : 'imageInference',
    taskUUID,
    positivePrompt: prompt,
    model: params.model,
    numberResults: 1,
    includeCost: true,
    deliveryMethod: isVideo ? 'async' : 'sync',
  };
  if (params.width != null && params.height != null) {
    payload.width = params.width;
    payload.height = params.height;
  }
  if (isVideo) payload.duration = params.duration ?? 5;
  if (params.referenceImages?.length) {
    payload.inputs = isVideo
      ? { frameImages: [...params.referenceImages] }
      : { referenceImages: [...params.referenceImages] };
  }
  try {
    const response = await fetch(RUNWARE_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([payload]),
      signal: AbortSignal.timeout(isVideo ? 20_000 : 60_000),
      cache: 'no-store',
    });
    const body = (await response.json().catch(() => ({}))) as RunwareApiResponse;
    const providerError = body.errors?.[0];
    const item = body.data?.find((candidate) => candidate.taskUUID === taskUUID) ?? body.data?.[0];
    if (!response.ok || providerError || !item) {
      return {
        success: false,
        taskUUID,
        providerCode: providerError?.code,
        error: response.ok ? 'Provider returned no result' : `Provider request failed (${response.status})`,
        retryable: response.status === 408 || response.status === 409
          || response.status === 429 || response.status >= 500,
      };
    }
    return { success: true, taskUUID, item, retryable: false };
  } catch (error) {
    const timedOut = error instanceof Error
      && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return {
      success: false,
      taskUUID,
      error: timedOut ? 'Provider request timed out' : 'Provider is unavailable',
      retryable: true,
    };
  }
}

export type RunwareResponseSummary = {
  taskUUID: string;
  imageUUID: string | null;
  model: string;
  seed: number | null;
  cost: number | null;
};

export type RunwareGenerationResult = ImageGenerationResult & {
  summary?: RunwareResponseSummary;
};

export async function generateWithRunware(
  params: ImageGenerateParams
): Promise<RunwareGenerationResult> {
  const prompt = params.prompt?.trim();
  const model = params.model || RUNWARE_TEST_MODEL;
  const result = await runRunwareTask({
    modality: 'image', prompt: prompt ?? '', model,
    width: params.width ?? 512, height: params.height ?? 512,
  });
  const item = result.item;
  if (!result.success || !item?.imageURL) {
    console.error('[runware-test] generation failed', {
      taskUUID: result.taskUUID,
      providerCode: result.providerCode ?? null,
      hasImage: Boolean(item?.imageURL),
    });
    return { success: false, provider: 'runware', model, requestId: result.taskUUID, error: result.error ?? 'Provider returned no image' };
  }
  return {
      success: true, provider: 'runware', model,
      imageUrl: item.imageURL, requestId: result.taskUUID,
      summary: {
        taskUUID: result.taskUUID,
        imageUUID: item.imageUUID ?? null,
        model,
        seed: typeof item.seed === 'number' ? item.seed : null,
        cost: typeof item.cost === 'number' ? item.cost : null,
      },
    };
}

export const runwareProvider: ImageProvider = {
  meta: runwareMeta,
  generateImage: generateWithRunware,
};
