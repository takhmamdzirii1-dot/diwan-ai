export type MediaKind = 'image' | 'video';
const key = (userId: string, kind: MediaKind) => `vantra:media-operation:${userId}:${kind}`;
// Only an opaque operation ID is stored. Context/results are resolved by the
// authenticated server, never trusted from browser storage.
export function rememberMediaOperation(userId: string, kind: MediaKind, operationId: string) {
  try { localStorage.setItem(key(userId, kind), operationId); } catch { /* Server active discovery remains available. */ }
}
export function rememberedMediaOperations(userId: string): string[] {
  try { return ['image', 'video'].flatMap(kind => {
    const id = localStorage.getItem(key(userId, kind as MediaKind));
    return id && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id) ? [id] : [];
  }); } catch { return []; }
}
