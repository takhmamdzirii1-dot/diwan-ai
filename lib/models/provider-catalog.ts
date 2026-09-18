import type { StudioModality } from '@/src/config/studio-registry';

export type ProviderCatalogModel = {
  key: string;
  modelId: string;
  displayName: string;
  modality: StudioModality;
  routeVerified: boolean;
};

/**
 * Server-operational model identities verified from provider documentation.
 * These do not appear in Studio pickers until product availability is explicitly added there.
 */
export const PROVIDER_CATALOG_MODELS: readonly ProviderCatalogModel[] = [
  { key: 'vantra:chat:glm-5.3-flash', modelId: 'vantra-glm-5.3-flash', displayName: 'GLM 5.3 Flash', modality: 'chat', routeVerified: true },
  { key: 'vantra:chat:hy3', modelId: 'vantra-hy3', displayName: 'HY3', modality: 'chat', routeVerified: true },
  { key: 'vantra:chat:union-alpha', modelId: 'vantra-union-alpha', displayName: 'Union Alpha', modality: 'chat', routeVerified: true },
  { key: 'vantra:chat:deepseek-v4-flash', modelId: 'vantra-deepseek-v4-flash', displayName: 'DeepSeek V4 Flash', modality: 'chat', routeVerified: true },
  { key: 'vantra:chat:qwen-3.8-flash', modelId: 'vantra-qwen-3.8-flash', displayName: 'Qwen 3.8 Flash', modality: 'chat', routeVerified: true },
  { key: 'vantra:chat:qwen-3.8-flash-next', modelId: 'vantra-qwen-3.8-flash-next', displayName: 'Qwen 3.8 Flash Next', modality: 'chat', routeVerified: true },
  { key: 'vantra:image:muse-image', modelId: 'vantra-muse-image', displayName: 'Muse Image', modality: 'image', routeVerified: true },
  { key: 'vantra:video:h3-max', modelId: 'vantra-h3-max', displayName: 'H3 Max', modality: 'video', routeVerified: true },
  { key: 'vantra:video:h3-max-turbo', modelId: 'vantra-h3-max-turbo', displayName: 'H3 Max Turbo', modality: 'video', routeVerified: true },
  { key: 'vantra:video:p-video', modelId: 'vantra-p-video', displayName: 'P-Video', modality: 'video', routeVerified: true },
  { key: 'vantra:video:p-video-2', modelId: 'vantra-p-video-2', displayName: 'P-Video-2', modality: 'video', routeVerified: true },
  { key: 'vantra:video:p-video-2-pro', modelId: 'vantra-p-video-2-pro', displayName: 'P-Video-2 Pro', modality: 'video', routeVerified: true },
  { key: 'vantra:image:z-image', modelId: 'vantra-z-image', displayName: 'Z-Image', modality: 'image', routeVerified: true },
  { key: 'vantra:image:flux-klein', modelId: 'vantra-flux-klein', displayName: 'FLUX Klein', modality: 'image', routeVerified: false },
  { key: 'vantra:chat:agnes-3.0-flash', modelId: 'vantra-agnes-3.0-flash', displayName: 'Agnes 3.0 Flash', modality: 'chat', routeVerified: true },
  { key: 'vantra:image:mai-image-2.6-flash', modelId: 'vantra-mai-image-2.6-flash', displayName: 'MAI Image 2.6 Flash', modality: 'image', routeVerified: true },
] as const;
