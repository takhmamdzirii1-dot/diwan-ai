/**
 * Provider router — the single entry point the UI talks to.
 *
 * `generateImageViaRouter()` runs **in the browser** and dispatches:
 *   - puter        → client-side Puter.js (User-Pays, keyless)
 *   - pollinations → POST /api/generate-image (server route → Pollinations, free tier)
 *   - mock         → POST /api/generate-image (offline placeholder)
 *
 * Fallback policy:
 *   - free ↔ free auto-fallback is allowed (pollinations ⇄ mock)
 *   - user_associated (Puter) NEVER silently falls back to a VANTRA-funded
 *     provider — the user explicitly picked their wallet.
 */

import type { ImageGenerateParams, ImageGenerationResult, ProviderMeta } from './types';
import { pollinationsMeta } from './pollinations';
import { puterMeta } from './puter';
import { mockMeta } from './mock';

export const PROVIDER_REGISTRY: Record<string, ProviderMeta> = {
  [puterMeta.id]: puterMeta,
  [pollinationsMeta.id]: pollinationsMeta,
  [mockMeta.id]: mockMeta,
};

export const PROVIDER_ORDER = ['puter', 'pollinations', 'mock'] as const;
export type ProviderId = (typeof PROVIDER_ORDER)[number] | 'auto';

export const AUTO_FALLBACK_CHAIN: string[] = ['pollinations', 'mock'];

function providerModels(provider: string): { id: string; name: string }[] {
  return PROVIDER_REGISTRY[provider]?.models ?? [];
}

/** All providers flattened for the picker, with the models each exposes. */
export function listProviderOptions() {
  return PROVIDER_ORDER.map((id) => PROVIDER_REGISTRY[id]);
}

export function modelsForProvider(provider: string): { id: string; name: string }[] {
  if (provider === 'auto') {
    // Auto = Pollinations first (free), so surface its models.
    return providerModels('pollinations');
  }
  return providerModels(provider);
}

interface RouterPayload extends ImageGenerateParams {
  provider: string;
  count?: number;
  /** Authenticated callers pass their Supabase access token — validated server-side. */
  accessToken?: string;
}

async function callApiRoute(
  payload: RouterPayload
): Promise<ImageGenerationResult & { images?: { url: string }[] }> {
  const res = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Generation failed (${res.status})`);
  return data;
}

export async function generateImageViaRouter(
  payload: RouterPayload
): Promise<{ images: { url: string }[]; provider: string; userFunded: boolean; requestId?: string }> {
  const { provider = 'auto', ...params } = payload;

  // ── Puter: client-side, User-Pays, no silent fallback ──
  if (provider === 'puter') {
    const mod = await import('./puter');
    const result = await mod.generateWithPuter(params);
    if (!result.success) throw new Error(result.error || 'Puter generation failed');
    return {
      images: [{ url: result.imageUrl! }],
      provider: 'puter',
      userFunded: true,
      requestId: result.requestId,
    };
  }

  // ── Pollinations: free server route ──
  if (provider === 'pollinations') {
    try {
      const data = await callApiRoute({ ...params, provider: 'pollinations' });
      const imgs = (data.images || []).map((im) => ({ url: im.url }));
      if (imgs.length === 0) throw new Error(data.error || 'No image returned');
      return { images: imgs, provider: 'pollinations', userFunded: false, requestId: data.requestId };
    } catch (err) {
      // Free ↔ free auto-fallback only
      const msg = err instanceof Error ? err.message : '';
      const fallbackToMock = !/credit|auth/i.test(msg);
      if (!fallbackToMock) throw err;
      const data = await callApiRoute({ ...params, provider: 'mock' });
      const imgs = (data.images || []).map((im) => ({ url: im.url }));
      if (imgs.length === 0) throw new Error(data.error || 'No image returned');
      return { images: imgs, provider: 'mock', userFunded: false };
    }
  }

  // ── Mock (explicit or unknown ids) ──
  const data = await callApiRoute({ ...params, provider: 'mock' });
  const imgs = (data.images || []).map((im) => ({ url: im.url }));
  if (imgs.length === 0) throw new Error(data.error || 'No image returned');
  return { images: imgs, provider: 'mock', userFunded: false };
}

/** Metadata used by the settings UI. */
export function providerCapabilities() {
  return { registry: PROVIDER_REGISTRY, order: PROVIDER_ORDER, autoChain: AUTO_FALLBACK_CHAIN };
}
