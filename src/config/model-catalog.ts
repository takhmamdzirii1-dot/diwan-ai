import type { StudioModality } from './studio-registry';

/** Presentation metadata only. Catalog keys are never provider/backend model IDs. */
export const MODEL_BRANDS = {
  openai: { name: 'OpenAI', icon: 'openai.svg' },
  claude: { name: 'Claude', icon: 'claude.svg' },
  google: { name: 'Google', icon: 'gemini.svg' },
  googleImage: { name: 'Google', icon: 'nanobanana.svg' },
  xai: { name: 'xAI', icon: 'grok.svg' },
  meta: { name: 'Meta', icon: 'metaai.svg' },
  qwen: { name: 'Qwen', icon: 'qwen.svg' },
  zai: { name: 'Z.ai / GLM', icon: 'chatglm.svg' },
  deepseek: { name: 'DeepSeek', icon: 'deepseek.svg' },
  kimi: { name: 'Kimi', icon: 'kimi.svg' },
  minimax: { name: 'MiniMax', icon: 'minimax.svg' },
  stepfun: { name: 'StepFun', icon: 'stepfun.svg' },
  mistral: { name: 'Mistral', icon: 'mistral.svg' },
  cohere: { name: 'Cohere', icon: null },
  microsoft: { name: 'Microsoft', icon: null },
  bytedance: { name: 'ByteDance', icon: 'bytedance.svg' },
  kling: { name: 'Kling / Kuaishou', icon: 'kling.svg' },
  runway: { name: 'Runway', icon: 'runway.svg' },
  bfl: { name: 'Black Forest Labs', icon: 'flux.svg' },
  alibaba: { name: 'Alibaba', icon: 'alibaba.svg' },
  luma: { name: 'Luma AI', icon: 'luma.svg' },
  adobe: { name: 'Adobe', icon: 'adobefirefly.svg' },
  recraft: { name: 'Recraft', icon: 'recraft.svg' },
  ideogram: { name: 'Ideogram', icon: 'ideogram.svg' },
  stability: { name: 'Stability AI', icon: 'stability.svg' },
  nvidia: { name: 'NVIDIA', icon: null },
  poolside: { name: 'Poolside', icon: null },
  pollinations: { name: 'Pollinations', icon: null },
} as const;

export type ModelBrandId = keyof typeof MODEL_BRANDS;
export type CatalogModel = { key: string; displayName: string; brandId: ModelBrandId; modality: StudioModality };

const groups: readonly { modality: StudioModality; brandId: ModelBrandId; names: readonly string[] }[] = [
  { modality: 'chat', brandId: 'openai', names: ['GPT-6 Astra', 'GPT-5.6 Sol', 'GPT-5.6 Terra', 'GPT-5.6 Luna'] },
  { modality: 'chat', brandId: 'claude', names: ['Claude Fable 5.1', 'Claude Mythos 5.1', 'Claude Opus 5', 'Claude Sonnet 5', 'Claude Haiku 4.5'] },
  { modality: 'chat', brandId: 'google', names: ['Gemini 3.8 Flash', 'Gemini 3.8 Live', 'Gemini 3.7 Flash', 'Gemini 3.5 Flash', 'Gemini 3.1 Pro'] },
  { modality: 'chat', brandId: 'xai', names: ['Grok 4.7', 'Grok 4.7 Fast', 'Grok 4.6', 'Grok 4.5'] },
  { modality: 'chat', brandId: 'meta', names: ['Muse Spark 1.3', 'Muse Spark 1.1'] },
  { modality: 'chat', brandId: 'qwen', names: ['Qwen 3.8 Max', 'Qwen 3.8 Flash', 'Qwen 3.8 Omni Flash', 'Qwen3 Coder Next', 'Qwen3 Coder Plus', 'Qwen3 Coder Flash'] },
  { modality: 'chat', brandId: 'zai', names: ['GLM-5.3', 'GLM-5.2', 'GLM-5.1'] },
  { modality: 'chat', brandId: 'deepseek', names: ['DeepSeek V4-Pro', 'DeepSeek V4.1 Flash', 'DeepSeek V4-Flash', 'DeepSeek V3.2'] },
  { modality: 'chat', brandId: 'kimi', names: ['Kimi K3', 'Kimi K2.7 Code', 'Kimi K2.6', 'Kimi K2.5'] },
  { modality: 'chat', brandId: 'minimax', names: ['MiniMax M3', 'MiniMax M2.5', 'MiniMax M2.1'] },
  { modality: 'chat', brandId: 'stepfun', names: ['Step 5 Preview', 'Step 3.7 Flash', 'Step 3.5 Flash'] },
  { modality: 'chat', brandId: 'mistral', names: ['Mistral Medium 3.5', 'Mistral Small 4', 'Mistral Large 3'] },
  { modality: 'chat', brandId: 'cohere', names: ['Command A+', 'Command A'] },
  { modality: 'chat', brandId: 'microsoft', names: ['MAI-Thinking-1'] },
  { modality: 'video', brandId: 'google', names: ['Veo 3.1', 'Veo 3.1 Lite', 'Gemini Omni Flash 1.1', 'Gemini Omni Flash'] },
  { modality: 'video', brandId: 'bytedance', names: ['Seedance 2.5', 'Seedance 2.0', 'Seedance 2.0 Fast', 'Seedance 2.0 Mini'] },
  { modality: 'video', brandId: 'minimax', names: ['MiniMax H3', 'MiniMax H3 Max', 'MiniMax H3 Turbo'] },
  { modality: 'video', brandId: 'kling', names: ['Kling 3.0', 'Kling 3.0 Omni', 'Kling 2.5 Turbo'] },
  { modality: 'video', brandId: 'runway', names: ['Runway Gen-4.5', 'Runway Gen-4 Turbo', 'Runway Aleph 2.0', 'Runway Act-Two'] },
  { modality: 'video', brandId: 'bfl', names: ['FLUX 3 Video'] },
  { modality: 'video', brandId: 'alibaba', names: ['WAN 3.0 Prime', 'WAN 3.0'] },
  { modality: 'video', brandId: 'xai', names: ['Grok Imagine Video 1.5'] },
  { modality: 'video', brandId: 'luma', names: ['Ray 3.2'] },
  { modality: 'video', brandId: 'adobe', names: ['Firefly Video'] },
  { modality: 'image', brandId: 'openai', names: ['GPT-Image-2.5 Sunburst', 'GPT-Image-2.5 Flare', 'GPT-Image-2'] },
  { modality: 'image', brandId: 'googleImage', names: ['Nano Banana 2', 'Nano Banana 2 Lite', 'Nano Banana Pro', 'Nano Banana'] },
  { modality: 'image', brandId: 'xai', names: ['Grok Imagine Image 2.0'] },
  { modality: 'image', brandId: 'bytedance', names: ['Seedream 5.0 Pro', 'Seedream 5.0 Lite'] },
  { modality: 'image', brandId: 'bfl', names: ['FLUX.2 [max]', 'FLUX.2 [pro]', 'FLUX.2 [flex]', 'FLUX.2 [klein] 9B', 'FLUX.2 [klein] 4B', 'FLUX.2 [dev]'] },
  { modality: 'image', brandId: 'meta', names: ['Muse Image'] },
  { modality: 'image', brandId: 'runway', names: ['Gen-4 Image', 'Gen-4 Image Turbo'] },
  { modality: 'image', brandId: 'adobe', names: ['Firefly Image 5', 'Firefly Image 4 Ultra', 'Firefly Image 4'] },
  { modality: 'image', brandId: 'recraft', names: ['Recraft V4.1', 'Recraft V4.1 Utility Pro', 'Recraft V4'] },
  { modality: 'image', brandId: 'ideogram', names: ['Ideogram 4.0'] },
  { modality: 'image', brandId: 'stability', names: ['Stable Diffusion 3.5 Large', 'Stable Diffusion 3.5 Large Turbo', 'Stable Diffusion 3.5 Medium'] },
];

const normalizeName = (name: string) => name.toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9]+/g, '');
export const CATALOG_MODELS: readonly CatalogModel[] = groups.flatMap(({ modality, brandId, names }) =>
  names.map((displayName) => ({
    key: `catalog:${modality}:${brandId}:${normalizeName(displayName)}`,
    displayName,
    brandId,
    modality,
  })));

export function findCatalogModel(displayName: string, modality: StudioModality) {
  return CATALOG_MODELS.find((model) => model.modality === modality
    && normalizeName(model.displayName) === normalizeName(displayName)) ?? null;
}

export function modelBrand(displayName: string, modality: StudioModality, provider?: string | null) {
  const listed = findCatalogModel(displayName, modality);
  if (listed) return MODEL_BRANDS[listed.brandId];
  const providerName = provider?.toLowerCase() ?? '';
  return Object.values(MODEL_BRANDS).find((brand) => brand.name.toLowerCase() === providerName)
    ?? { name: provider || 'Other', icon: null };
}

export function modelIconUrl(brand: { icon: string | null }) {
  return brand.icon ? `/brand/models/${brand.icon}` : undefined;
}
