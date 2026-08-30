/**
 * Pollinations provider — verified against the official API docs (github.com/pollinations/pollinations, APIDOCS.md).
 *
 * Endpoint : GET https://image.pollinations.ai/prompt/{encodedPrompt}
 * Models   : GET https://image.pollinations.ai/models  (flux, turbo, kontext, …)
 * Auth     : Anonymous tier = 1 request / 15s, no key.
 *            Web apps identify via `referrer`; per-user Bearer tokens (auth.pollinations.ai)
 *            are the documented BYOP path — stored server-side per user when that flow lands.
 * Cost     : free tier (images may be watermarked on the anonymous tier).
 */

import type { ImageGenerateParams, ImageGenerationResult, ImageProvider, ProviderMeta } from './types';

export const POLLINATIONS_MODELS = [
  { id: 'flux', name: 'Flux' },
  { id: 'turbo', name: 'Turbo' },
  { id: 'kontext', name: 'Kontext (img2img)' },
] as const;

export const pollinationsMeta: ProviderMeta = {
  id: 'pollinations',
  name: 'Pollinations',
  type: 'image',
  pricing: 'free',
  requiresApiKey: false,
  requiresAuthorization: false,
  clientSide: false,
  models: POLLINATIONS_MODELS.map((m) => ({ id: m.id, name: m.name })),
  note: 'Free public tier — anonymous requests are rate-limited to 1 / 15s',
};

export async function generateWithPollinations(
  params: ImageGenerateParams & {
    referrer?: string;
    /** BYOP — the authenticated user's own Pollinations token (Seed tier+). */
    token?: string;
  }
): Promise<ImageGenerationResult> {
  const {
    prompt,
    model = 'flux',
    width = 1024,
    height = 1024,
    imageUrl,
    referrer = 'vantra-studio',
    token,
  } = params;

  if (!prompt?.trim()) {
    return { success: false, provider: 'pollinations', error: 'Prompt is required' };
  }

  try {
    const search = new URLSearchParams({
      model,
      width: String(width),
      height: String(height),
      referrer,
    });
    if (imageUrl) search.set('image', imageUrl); // kontext img2img

    // Authenticated Seed-tier users can remove the watermark via their own token.
    if (token) {
      search.set('nologo', 'true');
      search.set('private', 'true');
    } else {
      search.set('nologo', 'false');
    }

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.trim())}?${search}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(90_000),
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    });

    if (!res.ok) {
      if (res.status === 429) {
        return {
          success: false,
          provider: 'pollinations',
          error: 'Provider rate limit reached — wait ~15s and try again',
        };
      }
      return {
        success: false,
        provider: 'pollinations',
        error: `Provider error (${res.status})`,
      };
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return { success: false, provider: 'pollinations', error: 'Provider returned a non-image response' };
    }

    return {
      success: true,
      provider: 'pollinations',
      model,
      imageData: `data:${contentType};base64,${buffer.toString('base64')}`,
      requestId: res.headers.get('x-request-id') || undefined,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'TimeoutError';
    return {
      success: false,
      provider: 'pollinations',
      error: aborted ? 'Generation timed out' : 'Provider unavailable',
    };
  }
}

export const pollinationsProvider: ImageProvider = {
  meta: pollinationsMeta,
  generateImage: generateWithPollinations,
};
