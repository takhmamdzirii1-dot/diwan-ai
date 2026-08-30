/**
 * Mock provider — offline placeholder used when no real provider is reachable.
 * Keeps the studio UI fully testable with zero cost and zero network.
 */

import type { ImageGenerateParams, ImageGenerationResult, ImageProvider, ProviderMeta } from './types';

export const mockMeta: ProviderMeta = {
  id: 'mock',
  name: 'Preview (offline)',
  type: 'image',
  pricing: 'platform',
  requiresApiKey: false,
  requiresAuthorization: false,
  clientSide: false,
  models: [{ id: 'placeholder', name: 'Placeholder' }],
  note: 'Deterministic placeholder images for testing the UI',
};

export async function generateWithMock(
  params: ImageGenerateParams & { count?: number }
): Promise<ImageGenerationResult & { images?: { url: string }[] }> {
  const { prompt = 'placeholder', width = 1024, height = 1024, count = 1 } = params;
  await new Promise((r) => setTimeout(r, 1200));
  const seed = Date.now();
  const images = Array.from({ length: count }, (_, i) => ({
    url: `https://picsum.photos/seed/${seed}-${i}/${width}/${height}`,
  }));
  return {
    success: true,
    provider: 'mock',
    model: 'placeholder',
    images,
    imageUrl: images[0]?.url,
  };
}

export const mockProvider: ImageProvider = {
  meta: mockMeta,
  generateImage: (p) => generateWithMock(p as ImageGenerateParams & { count?: number }),
};
