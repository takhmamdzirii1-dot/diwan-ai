export const CHAT_INTERRUPTED_AFTER_MS = 3 * 60_000;
export const CHAT_CHECKPOINT_MS = 2_000;
export type DurableMessage = { id: string; role: 'user' | 'assistant'; content: string;
  vantraOperationId?: string;
  createdAt: string; updatedAt: string; vantraStatus: 'complete' | 'streaming' | 'interrupted';
  vantraParts?: unknown; annotations?: unknown };

export function chatIdentifier(value: unknown): string | null {
  return typeof value === 'string' && /^[\w-]{1,120}$/.test(value) ? value : null;
}

export function recoveredChatStatus(status: DurableMessage['vantraStatus'], updatedAt: string, now = Date.now()) {
  return status === 'streaming' && now - Date.parse(updatedAt) > CHAT_INTERRUPTED_AFTER_MS ? 'interrupted' : status;
}

/** A delayed hydration response must not replace a new send or another conversation. */
export function mayHydrateChat(requestedId: string, currentId: string | null, busy: boolean) {
  return requestedId === currentId && !busy;
}

/** Replace each persisted turn as a unit. Keep browser-only Agent/deterministic
 * artifact turns; they are not regenerated or silently erased by hydration. */
export function mergeRecoveredHistory<T extends { id: string; role: string; createdAt?: unknown }>(local: T[], remote: T[]): T[] {
  const userIds = new Set(remote.filter(message => message.role === 'user').map(message => message.id));
  let persistedTurn = false;
  const browserOnly = local.filter(message => {
    if (message.role === 'user') persistedTurn = userIds.has(message.id);
    return !persistedTurn;
  }).filter(message => !remote.some(row => row.id === message.id));
  const timestamp = (message: T) => {
    const date = message.createdAt instanceof Date ? message.createdAt.getTime() : Date.parse(String(message.createdAt));
    return Number.isFinite(date) ? date : 0;
  };
  const restored = remote.map(message => message.role === 'user'
    ? { ...local.find(previous => previous.id === message.id), ...message } : message);
  return [...restored, ...browserOnly].sort((left, right) => timestamp(left) - timestamp(right));
}
