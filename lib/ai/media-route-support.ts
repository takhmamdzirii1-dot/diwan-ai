/** The protocols actually executed by the existing Studio media endpoints. */
export function isStudioMediaRouteSupported(modality: string | undefined, provider: string) {
  return modality === 'image' ? provider === 'microsoft_foundry'
    : modality === 'video' ? provider === 'pruna_ai' : true;
}
