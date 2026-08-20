export const TOPUP_PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter Pack • Beginner',
    priceDZD: 1800,
    priceFormatted: '1,800 DZD',
    points: 2500,
    pointsFormatted: '2,500 Points',
  },
  creatorPro: {
    id: 'creator_pro',
    name: 'Creator Pack • Pro',
    priceDZD: 4500,
    priceFormatted: '4,500 DZD',
    points: 7500,
    pointsFormatted: '7,500 Points',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Studio Pack • Enterprise',
    priceDZD: 12000,
    priceFormatted: '12,000 DZD',
    points: 22000,
    pointsFormatted: '22,000 Points',
  }
};

export const MODEL_PRICES: Record<string, { name: string; cost: number; category: string; provider?: string }> = {
  'anthropic/claude-3.5-sonnet': {
    name: 'Claude 3.5 Sonnet',
    cost: 25,
    category: 'Chat & Code',
    provider: 'Anthropic',
  },
  'openai/gpt-4o': {
    name: 'GPT-4o (Omni)',
    cost: 30,
    category: 'Vision & Reasoning',
    provider: 'OpenAI',
  },
  'deepseek/deepseek-chat': {
    name: 'DeepSeek R1 / V3',
    cost: 5,
    category: 'Deep Reasoning',
    provider: 'DeepSeek AI',
  },
  'flux-1-pro': {
    name: 'Flux.1 Pro',
    cost: 65,
    category: '4K Image Generation',
    provider: 'Black Forest Labs',
  },
  'kling-ai-1-5': {
    name: 'Kling AI 1.5 HD',
    cost: 240,
    category: 'Cinematic 1080p Video',
    provider: 'Kuaishou',
  },
  'meta-llama/llama-3.2-3b-instruct:free': {
    name: 'Llama 3.2 3B Instruct',
    cost: 0,
    category: 'High-Speed Chat',
    provider: 'Meta',
  },
  'openrouter/free': {
    name: 'Auto-Routing Free Engine',
    cost: 0,
    category: 'Chat',
    provider: 'OpenRouter',
  }
};

export function getModelCost(modelId: string): number {
  if (modelId.endsWith(':free')) return 0;
  return MODEL_PRICES[modelId]?.cost ?? 0;
}
