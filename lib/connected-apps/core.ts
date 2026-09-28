import { documentFromMarkdown } from '@/lib/artifacts/core';
import type { ConversationAttachmentDraft } from '@/lib/chat/conversation-attachments';

export type ConnectedAppError = 'app_not_connected' | 'permission_missing' | 'authorization_expired'
  | 'resource_not_found' | 'action_requires_confirmation' | 'provider_unavailable'
  | 'provider_rate_limited' | 'action_failed';
export type ConnectedAppConnection = {
  id: string; appId: string; scopes: string[]; status: 'connected' | 'disconnected'; expiresAt: string | null;
};
export type ConnectedResource = {
  sourceId: string; name: string; mimeType: string; text: string;
};
export type ConnectedAction = {
  id: string; description: string; classification: 'read' | 'write'; risk: 'low' | 'high';
  requiredScopes: readonly string[]; requiresConnection: boolean; requiresConfirmation: boolean;
  matches: (request: string) => boolean;
};
export type ConnectedAppAdapter = {
  id: string; name: string; authorization: 'reference' | 'oauth'; actions: readonly ConnectedAction[];
  // A real OAuth adapter must initiate its own server-side authorization flow.
  connect?: () => Promise<{ scopes: string[] }>;
  execute: (input: { actionId: string; request: string; userId: string;
    credential: string | null }) => Promise<ConnectedResource>;
};
export type ConnectedActionMatch = { adapter: ConnectedAppAdapter; action: ConnectedAction };

/** Conservative gate: mentioning an app/file is not permission to read it. */
export function explicitConnectedReadRequest(request: string): boolean {
  const text = request.slice(0, 800).trim();
  if (/\b(?:do not|don't|without|never)\s+(?:read|open|search|use)\b/i.test(text)) return false;
  return /^(?:(?:please|can you|could you)\s+)*(?:read|open|search|find|summari[sz]e|analy[sz]e)\b/i.test(text)
    || /^(?:create|build|make|write)\b[^\n]{0,240}\b(?:from|using|based on)\b/i.test(text)
    || /^(?:اقرأ|افتح|ابحث|لخص|حلل|أنشئ|اصنع)(?:\s|$)/u.test(text)
    || /^(?:lis|lisez|ouvre|ouvrez|cherche|cherchez|résume|résumez|analyse|analysez|crée|créez)\b/iu.test(text);
}

/** Deterministic, bounded discovery; no model call and no provider access. */
export function relevantConnectedActions(request: string, adapters: readonly ConnectedAppAdapter[], limit = 3): ConnectedActionMatch[] {
  if (!explicitConnectedReadRequest(request)) return [];
  const bounded = request.slice(0, 800);
  return adapters.flatMap((adapter) => adapter.actions.map((action) => ({ adapter, action })))
    .filter(({ action }) => action.matches(bounded)).slice(0, limit);
}

export function connectionError(connection: ConnectedAppConnection | null, action: ConnectedAction,
  now = Date.now()): ConnectedAppError | null {
  if (!action.requiresConnection) return null;
  if (!connection || connection.status !== 'connected') return 'app_not_connected';
  if (connection.expiresAt && new Date(connection.expiresAt).getTime() <= now) return 'authorization_expired';
  if (action.requiredScopes.some((scope) => !connection.scopes.includes(scope))) return 'permission_missing';
  return null;
}

export async function executeConnectedAction(input: { match: ConnectedActionMatch; request: string;
  userId: string; connection: ConnectedAppConnection | null; credential: string | null }): Promise<{ resource: ConnectedResource; error: null } | { resource: null; error: ConnectedAppError }> {
  const { adapter, action } = input.match;
  if (action.requiresConnection && input.connection?.appId !== adapter.id)
    return { resource: null, error: 'app_not_connected' };
  const blocked = connectionError(input.connection, action);
  if (blocked) return { resource: null, error: blocked };
  if (adapter.authorization === 'oauth' && !input.credential)
    return { resource: null, error: 'authorization_expired' };
  // Phase 1 has no server-verified confirmation flow. Writes stay fail-closed.
  if (action.classification === 'write' || action.requiresConfirmation || action.risk === 'high')
    return { resource: null, error: 'action_requires_confirmation' };
  try {
    const resource = await adapter.execute({ actionId: action.id, request: input.request.slice(0, 800),
      userId: input.userId, credential: input.credential });
    if (!resource.sourceId || resource.sourceId.length > 256 || !resource.name || resource.name.length > 160
      || !/^text\/(plain|markdown|csv)$/.test(resource.mimeType) || !resource.text.trim()
      || resource.text.length > 30_000) return { resource: null, error: 'resource_not_found' };
    return { resource, error: null };
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : '';
    const error: ConnectedAppError = code === 'resource_not_found' ? 'resource_not_found'
      : code === 'provider_rate_limited' ? 'provider_rate_limited'
        : code === 'provider_unavailable' ? 'provider_unavailable' : 'action_failed';
    return { resource: null, error };
  }
}

/** Return one bounded, relevant excerpt; unclear large-file relevance fails closed. */
export function boundedConnectedContent(resource: ConnectedResource, request: string, maxChars = 8_000): string | null {
  const secretPattern = /(?:sb_secret_[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{16,}|\bBearer\s+[A-Za-z0-9._-]{16,}|\b(?:API_KEY|CLIENT_SECRET|REFRESH_TOKEN)\s*[:=]\s*\S+)/i;
  if (secretPattern.test(resource.text)) return null;
  if (resource.text.length <= maxChars) return resource.text;
  const terms = new Set((request.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [])
    .filter((term) => !['read', 'open', 'search', 'find', 'file', 'files', 'from', 'using', 'make', 'create', 'build', 'example'].includes(term)));
  if (!terms.size) return null;
  const sections = resource.text.split(/\n\s*\n/).filter(Boolean);
  const ranked = sections.map((text, index) => ({ text, index,
    score: [...terms].reduce((count, term) => count + Number(text.toLowerCase().includes(term)), 0) }))
    .filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
  if (!ranked.length) return null;
  let remaining = maxChars;
  const selected = ranked.filter((entry) => {
    if (entry.text.length + 2 > remaining) return false;
    remaining -= entry.text.length + 2;
    return true;
  }).sort((a, b) => a.index - b.index);
  return selected.length ? selected.map((entry) => entry.text).join('\n\n') : null;
}

/** Reuse the local-upload Conversation Resources document path, not a parallel artifact type. */
export function connectedResourceAttachment(resource: ConnectedResource, appId: string,
  connectionId: string, language = 'en'): ConversationAttachmentDraft {
  const artifact = documentFromMarkdown(crypto.randomUUID(), resource.text, language);
  artifact.title = resource.name.slice(0, 160);
  artifact.metadata = { ...artifact.metadata, sourceApp: appId, sourceResourceId: resource.sourceId,
    connectionRef: connectionId, mimeType: resource.mimeType };
  return { kind: 'document', name: artifact.title, artifact };
}
