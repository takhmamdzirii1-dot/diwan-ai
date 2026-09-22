/** Retired integrations remain in stored jobs and audits, but are never active choices. */
export const isRetiredProviderId = (id: string) => id === 'puter' || id === 'pollinations';

export const isRetiredModelReference = (model: { key: string; modelId: string; provider: string }) =>
  model.key === 'studio:image:flux'
  || model.key.startsWith('provider:puter:')
  || model.key.startsWith('provider:pollinations:')
  || isRetiredProviderId(model.provider.toLowerCase());
