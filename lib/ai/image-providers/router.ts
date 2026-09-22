/**
 * Provider router — the single entry point the UI talks to.
 *
 * Legacy preview router. Retired provider IDs fail closed; historical records
 * remain readable through their stored provider identifiers.
 */

import type { ImageGenerateParams, ImageGenerationResult, ProviderMeta } from './types';
import { mockMeta } from './mock';
import { runwareMeta } from './runware-meta';

export const PROVIDER_REGISTRY = {
  [mockMeta.id]: mockMeta,
  [runwareMeta.id]: runwareMeta,
} satisfies Record<string, ProviderMeta>;

/** Providers exposed by the legacy preview picker. Runware remains owner-test only. */
export const PROVIDER_ORDER = ['mock'] as const;
export type ProviderId = keyof typeof PROVIDER_REGISTRY | 'auto';

export const AUTO_FALLBACK_CHAIN: string[] = ['mock'];

function providerModels(provider: string): { id: string; name: string }[] {
  return PROVIDER_REGISTRY[provider]?.models ?? [];
}

/** All providers flattened for the picker, with the models each exposes. */
export function listProviderOptions() {
  return PROVIDER_ORDER.map((id) => PROVIDER_REGISTRY[id]);
}

export function modelsForProvider(provider: string): { id: string; name: string }[] {
  if (provider === 'auto') {
    return providerModels('mock');
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
  if (provider !== 'auto' && provider !== 'mock') throw new Error('Provider unavailable');

  // The remaining legacy preview route is intentionally isolated from billing.
  const data = await callApiRoute({ ...params, provider: 'mock' });
  const imgs = (data.images || []).map((im) => ({ url: im.url }));
  if (imgs.length === 0) throw new Error(data.error || 'No image returned');
  return { images: imgs, provider: 'mock', userFunded: false };
}

/** Metadata used by the settings UI. */
export function providerCapabilities() {
  return { registry: PROVIDER_REGISTRY, order: PROVIDER_ORDER, autoChain: AUTO_FALLBACK_CHAIN };
}
