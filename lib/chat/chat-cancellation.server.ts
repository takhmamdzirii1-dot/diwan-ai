import 'server-only';

// Fast cancellation in the serving process. Persisted cancellation in the
// message row also covers another instance via the next progress checkpoint.
const controllers = new Map<string, AbortController>();
const key = (userId: string, conversationId: string, operationId: string) => `${userId}:${conversationId}:${operationId}`;
export function registerChatCancellation(userId: string, conversationId: string, operationId: string, controller: AbortController) {
  const id = key(userId, conversationId, operationId);
  controllers.set(id, controller);
  return () => { if (controllers.get(id) === controller) controllers.delete(id); };
}
export function abortOwnedChat(userId: string, conversationId: string, operationId: string) {
  controllers.get(key(userId, conversationId, operationId))?.abort();
}
