export type StudioModality = 'chat' | 'image' | 'video';
export type StudioAvailability =
  | 'available'
  | 'beta'
  | 'preview'
  | 'unavailable'
  | 'temporarily_unavailable';

export type StudioControl = 'temperature' | 'maxTokens' | 'topP';

export interface StudioModelDefinition {
  id: string;
  displayName: string;
  provider: string;
  modality: StudioModality;
  enabled: boolean;
  availability: StudioAvailability;
  verifiedCapabilities: readonly string[];
  verifiedContextSize?: number;
  verifiedCreditCost?: number;
  supportedControls: readonly StudioControl[];
  fallbackAvailable: boolean;
  displayOrder: number;
}

/**
 * Frontend availability registry. This intentionally lists only model facts that
 * are evidenced by the current application configuration. Models can remain
 * visible as Preview, but only enabled available/Beta entries are selectable.
 */
export const STUDIO_MODELS: readonly StudioModelDefinition[] = [
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    displayName: 'Nemotron 3 Ultra',
    provider: 'NVIDIA',
    modality: 'chat',
    enabled: true,
    availability: 'available',
    verifiedCapabilities: ['Chat'],
    verifiedCreditCost: 0,
    supportedControls: ['temperature', 'maxTokens', 'topP'],
    fallbackAvailable: false,
    displayOrder: 1,
  },
  {
    id: 'z-ai/glm-5.2:free',
    displayName: 'GLM 5.2',
    provider: 'Z.ai',
    modality: 'chat',
    enabled: false,
    availability: 'preview',
    verifiedCapabilities: [],
    supportedControls: [],
    fallbackAvailable: false,
    displayOrder: 2,
  },
  {
    id: 'poolside/laguna-s-2.1:free',
    displayName: 'Laguna S 2.1',
    provider: 'Poolside',
    modality: 'chat',
    enabled: false,
    availability: 'preview',
    verifiedCapabilities: [],
    supportedControls: [],
    fallbackAvailable: false,
    displayOrder: 3,
  },
  {
    id: 'minimax/minimax-m3:free',
    displayName: 'MiniMax M3',
    provider: 'MiniMax',
    modality: 'chat',
    enabled: false,
    availability: 'preview',
    verifiedCapabilities: [],
    supportedControls: [],
    fallbackAvailable: false,
    displayOrder: 4,
  },
  {
    id: 'flux',
    displayName: 'Flux',
    provider: 'Pollinations',
    modality: 'image',
    enabled: true,
    availability: 'beta',
    verifiedCapabilities: ['Text to image'],
    supportedControls: [],
    fallbackAvailable: true,
    displayOrder: 1,
  },
] as const;

export const CHAT_MODELS = STUDIO_MODELS
  .filter((model) => model.modality === 'chat')
  .sort((a, b) => a.displayOrder - b.displayOrder);

export const DEFAULT_CHAT_MODEL = CHAT_MODELS.find(
  (model) => model.enabled && (model.availability === 'available' || model.availability === 'beta')
) ?? CHAT_MODELS[0];

export const IMAGE_MODELS = STUDIO_MODELS
  .filter((model) => model.modality === 'image')
  .sort((a, b) => a.displayOrder - b.displayOrder);

export const DEFAULT_IMAGE_MODEL = IMAGE_MODELS.find(
  (model) => model.enabled && (model.availability === 'available' || model.availability === 'beta')
) ?? IMAGE_MODELS[0];

export const VIDEO_MODELS = STUDIO_MODELS
  .filter((model) => model.modality === 'video')
  .sort((a, b) => a.displayOrder - b.displayOrder);

export const DEFAULT_VIDEO_MODEL = VIDEO_MODELS.find(
  (model) => model.enabled && (model.availability === 'available' || model.availability === 'beta')
);

export function isModelSelectable(model: StudioModelDefinition) {
  return model.enabled && (model.availability === 'available' || model.availability === 'beta');
}
