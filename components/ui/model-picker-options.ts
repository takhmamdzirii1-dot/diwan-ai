/** De-duplicate identity, never display name or plan access. */
export function uniqueVisibleModels<T extends { id: string; enabled: boolean; availability: string }>(models: readonly T[]): T[] {
  const seen = new Set<string>();
  return models.filter((model) => {
    if (!model.enabled || !['available', 'beta'].includes(model.availability) || seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });
}
