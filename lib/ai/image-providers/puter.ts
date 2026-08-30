/**
 * Puter.js provider — client-side only, verified against developer.puter.com (current docs).
 *
 * Flow: `import { puter } from '@heyputer/puter.js'` → `puter.ai.txt2img(prompt, { model })`
 *       → resolves with an <img> element whose src is a data URL of the render.
 *
 * Cost  : "User-Pays" — the end user covers usage via their own Puter account
 *         (Puter shows its own auth popup for guests). VANTRA is never billed
 *         and never holds a key for this path.
 * Models: gpt-image-2, gpt-image-1.5, gpt-image-1-mini, gpt-image-1
 */

import type { ImageGenerateParams, ImageGenerationResult, ImageProvider, ProviderMeta } from './types';

export const PUTER_MODELS = [
  { id: 'gpt-image-2', name: 'GPT Image 2' },
  { id: 'gpt-image-1.5', name: 'GPT Image 1.5' },
  { id: 'gpt-image-1-mini', name: 'GPT Image 1 Mini' },
] as const;

export const puterMeta: ProviderMeta = {
  id: 'puter',
  name: 'Puter',
  type: 'image',
  pricing: 'user_associated',
  requiresApiKey: false,
  requiresAuthorization: true,
  clientSide: true,
  models: PUTER_MODELS.map((m) => ({ id: m.id, name: m.name })),
  note: 'Uses your own Puter account — free for VANTRA, you cover your usage',
};

/** Minimal shape of the parts of the official SDK we use. */
interface PuterSdk {
  ai: {
    txt2img: (
      prompt: string,
      options?: { model?: string }
    ) => Promise<HTMLImageElement>;
  };
}

let sdkPromise: Promise<PuterSdk> | null = null;

async function loadPuter(): Promise<PuterSdk> {
  if (!sdkPromise) {
    sdkPromise = import('@heyputer/puter.js').then((mod) => {
      const sdk = (mod as { puter?: PuterSdk }).puter;
      if (!sdk?.ai?.txt2img) throw new Error('Puter.js failed to initialise');
      return sdk;
    });
  }
  return sdkPromise;
}

export async function generateWithPuter(params: ImageGenerateParams): Promise<ImageGenerationResult> {
  const { prompt, model = 'gpt-image-2' } = params;

  if (!prompt?.trim()) {
    return { success: false, provider: 'puter', error: 'Prompt is required' };
  }

  try {
    const puter = await loadPuter();
    const img = await puter.ai.txt2img(prompt.trim(), { model });
    const src = (img as HTMLImageElement)?.src;
    if (!src) {
      return { success: false, provider: 'puter', error: 'Provider returned no image' };
    }
    return {
      success: true,
      provider: 'puter',
      model,
      imageUrl: src,
      userFunded: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const auth =
      /auth|sign|permission|denied|login/i.test(msg) || msg.includes('401');
    return {
      success: false,
      provider: 'puter',
      error: auth
        ? 'Your Puter authorization is required — a sign-in popup was shown; approve it and retry'
        : /rate|limit|429/i.test(msg)
          ? 'Provider rate limit reached — try again shortly'
          : 'Puter provider unavailable — try another provider',
    };
  }
}

export const puterProvider: ImageProvider = {
  meta: puterMeta,
  generateImage: generateWithPuter,
};
