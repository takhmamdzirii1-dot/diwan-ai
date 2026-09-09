import 'server-only';

import type { ImageGenerateParams, ImageGenerationResult, ImageProvider } from './types';
import { runwareMeta, RUNWARE_TEST_MODEL } from './runware-meta';

const RUNWARE_ENDPOINT = 'https://api.runware.ai/v1';

type RunwareDataItem = {
  taskType?: string;
  taskUUID?: string;
  imageUUID?: string;
  imageURL?: string;
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
  const apiKey = process.env.RUNWARE_API_KEY;
  const prompt = params.prompt?.trim();
  const model = params.model || RUNWARE_TEST_MODEL;
  const taskUUID = crypto.randomUUID();

  if (!apiKey) {
    return { success: false, provider: 'runware', model, requestId: taskUUID, error: 'Provider is not configured' };
  }
  if (!prompt) {
    return { success: false, provider: 'runware', model, requestId: taskUUID, error: 'Prompt is required' };
  }
  if (model !== RUNWARE_TEST_MODEL) {
    return { success: false, provider: 'runware', model, requestId: taskUUID, error: 'Model is not allowed' };
  }

  try {
    const response = await fetch(RUNWARE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          taskType: 'imageInference',
          taskUUID,
          positivePrompt: prompt,
          model,
          width: params.width ?? 512,
          height: params.height ?? 512,
          numberResults: 1,
          includeCost: true,
        },
      ]),
      signal: AbortSignal.timeout(55_000),
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => ({}))) as RunwareApiResponse;
    const providerError = payload.errors?.[0];
    const item = payload.data?.find(
      (candidate) => candidate.taskUUID === taskUUID && typeof candidate.imageURL === 'string'
    );

    if (!response.ok || providerError || !item?.imageURL) {
      console.error('[runware-test] generation failed', {
        taskUUID,
        status: response.status,
        providerCode: providerError?.code ?? null,
        hasImage: Boolean(item?.imageURL),
      });
      return {
        success: false,
        provider: 'runware',
        model,
        requestId: taskUUID,
        error: response.ok ? 'Provider returned no image' : `Provider request failed (${response.status})`,
      };
    }

    return {
      success: true,
      provider: 'runware',
      model,
      imageUrl: item.imageURL,
      requestId: taskUUID,
      summary: {
        taskUUID,
        imageUUID: item.imageUUID ?? null,
        model,
        seed: typeof item.seed === 'number' ? item.seed : null,
        cost: typeof item.cost === 'number' ? item.cost : null,
      },
    };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    console.error('[runware-test] request exception', {
      taskUUID,
      kind: timedOut ? 'timeout' : 'network',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      success: false,
      provider: 'runware',
      model,
      requestId: taskUUID,
      error: timedOut ? 'Provider request timed out' : 'Provider is unavailable',
    };
  }
}

export const runwareProvider: ImageProvider = {
  meta: runwareMeta,
  generateImage: generateWithRunware,
};
