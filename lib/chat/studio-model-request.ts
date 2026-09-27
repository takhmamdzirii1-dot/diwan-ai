export function resolveSelectedChatModel<T extends { id: string }>(
  models: readonly T[],
  selectedModelId: string,
  isSelectable: (model: T) => boolean,
): T | null {
  const selected = models.find((model) => model.id === selectedModelId);
  return selected && isSelectable(selected) ? selected : models.find(isSelectable) ?? null;
}

export function chatModelRequestBody(modelId: string): { model: string; operationId: string } {
  if (!modelId.trim()) throw new Error('A selected chat model is required');
  return { model: modelId, operationId: crypto.randomUUID() };
}

export function requiredChatModel(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
