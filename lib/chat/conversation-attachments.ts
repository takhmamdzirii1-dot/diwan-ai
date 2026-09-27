import { documentToText, isArtifact, type DocumentArtifact, type SpreadsheetArtifact } from '@/lib/artifacts/core';
import { chartFromSheet, spreadsheetContext } from '@/lib/artifacts/spreadsheet-actions';

export type ConversationAttachmentDraft =
  | { kind: 'spreadsheet'; name: string; artifact: SpreadsheetArtifact }
  | { kind: 'document'; name: string; artifact: DocumentArtifact }
  | { kind: 'file'; name: string; contentType: string; url: string }
  | { kind: 'image'; name: string; contentType: string; url: string };
export type ConversationAttachment = ConversationAttachmentDraft & { attachmentId: string; conversationId: string };
export type ConversationAttachmentStore = Record<string, ConversationAttachment[]>;
export type PendingAttachmentIdStore = Record<string, string[]>;

/** Pending IDs are UI state only; parsed files stay in ConversationAttachmentStore. */
export function markPendingAttachment(store: PendingAttachmentIdStore, conversationId: string,
  attachmentId: string): PendingAttachmentIdStore {
  const current = store[conversationId] ?? [];
  return current.includes(attachmentId) ? store
    : { ...store, [conversationId]: [...current, attachmentId] };
}

export function clearPendingAttachments(store: PendingAttachmentIdStore,
  conversationId: string): PendingAttachmentIdStore {
  return { ...store, [conversationId]: [] };
}

export function removePendingAttachment(store: PendingAttachmentIdStore, conversationId: string,
  attachmentId: string): PendingAttachmentIdStore {
  return { ...store, [conversationId]: (store[conversationId] ?? []).filter((id) => id !== attachmentId) };
}

export function attachmentDisplayGroups(store: ConversationAttachmentStore, conversationId: string,
  pendingIds: string[]): { pending: ConversationAttachment[]; context: ConversationAttachment[] } {
  const ids = new Set(pendingIds);
  const attachments = getConversationAttachments(store, conversationId);
  return { pending: attachments.filter((item) => ids.has(item.attachmentId)),
    context: attachments.filter((item) => !ids.has(item.attachmentId)) };
}

export function uploadFileKind(file: Pick<File, 'name' | 'type'>): ConversationAttachment['kind'] | null {
  if (/\.(xlsx|csv)$/i.test(file.name)) return 'spreadsheet';
  if (/\.(txt|md|json|py|ts|tsx|js|jsx|yaml|yml)$/i.test(file.name)) return 'document';
  if (/\.(pdf|doc|docx)$/i.test(file.name)) return 'file';
  if (/\.(png|jpe?g|gif|webp)$/i.test(file.name) || /^image\/(png|jpeg|gif|webp)$/.test(file.type)) return 'image';
  return null;
}

export function attachConversationFile(attachments: ConversationAttachment[], attachment: ConversationAttachmentDraft,
  conversationId = 'default-session'): ConversationAttachment[] {
  const existing = attachments.find((item) => item.conversationId === conversationId && item.kind === attachment.kind
    && ('artifact' in item && 'artifact' in attachment ? item.artifact.id === attachment.artifact.id
      : 'url' in item && 'url' in attachment && item.url === attachment.url));
  if (existing) return attachments;
  const bound = { ...attachment, attachmentId: crypto.randomUUID(), conversationId } as ConversationAttachment;
  return [...attachments, bound];
}

export function getConversationAttachments(store: ConversationAttachmentStore, conversationId: string): ConversationAttachment[] {
  return (store[conversationId] ?? []).filter((attachment) => attachment.conversationId === conversationId);
}

export function getSpreadsheetAttachments(store: ConversationAttachmentStore,
  conversationId: string): Array<Extract<ConversationAttachment, { kind: 'spreadsheet' }>> {
  return getConversationAttachments(store, conversationId).filter((item): item is
    Extract<ConversationAttachment, { kind: 'spreadsheet' }> => item.kind === 'spreadsheet'
      && isArtifact(item.artifact) && item.artifact.type === 'spreadsheet'
      && item.artifact.sheets.some((sheet) => sheet.columns.length > 0));
}

export function getCurrentSpreadsheetAttachment(store: ConversationAttachmentStore,
  conversationId: string): Extract<ConversationAttachment, { kind: 'spreadsheet' }> | null {
  return getSpreadsheetAttachments(store, conversationId).at(-1) ?? null;
}

export function resolveSpreadsheetAttachment(store: ConversationAttachmentStore, conversationId: string,
  attachmentId?: string): { attachment: Extract<ConversationAttachment, { kind: 'spreadsheet' }> | null; ambiguous: boolean } {
  const spreadsheets = getSpreadsheetAttachments(store, conversationId);
  if (attachmentId) return { attachment: spreadsheets.find((item) => item.attachmentId === attachmentId) ?? null,
    ambiguous: false };
  return { attachment: spreadsheets.length === 1 ? spreadsheets[0] : null, ambiguous: spreadsheets.length > 1 };
}

export function getConversationAttachment(store: ConversationAttachmentStore, conversationId: string,
  attachmentId: string): ConversationAttachment | null {
  return getConversationAttachments(store, conversationId).find((item) => item.attachmentId === attachmentId) ?? null;
}

/** A sent message stores IDs only; the conversation store remains the resource authority. */
export function sentMessageAttachments(store: ConversationAttachmentStore, conversationId: string,
  attachmentIds: unknown): ConversationAttachment[] {
  if (!Array.isArray(attachmentIds)) return [];
  const ids = new Set(attachmentIds.filter((id): id is string => typeof id === 'string'));
  return getConversationAttachments(store, conversationId).filter((item) => ids.has(item.attachmentId));
}

export function chartFromSpreadsheetAttachment(attachment: ConversationAttachment | null) {
  if (attachment?.kind !== 'spreadsheet') return null;
  const sheet = attachment.artifact.sheets[0];
  if (!sheet) return null;
  try { return chartFromSheet(attachment.artifact, sheet, 'bar', 0, Math.min(sheet.rows.length, 40)); }
  catch { return null; }
}

export class AttachmentActionGate {
  private active = new Set<string>();
  begin(conversationId: string, attachmentId: string, action: string): boolean {
    const key = `${conversationId}:${attachmentId}:${action}`;
    if (this.active.has(key)) return false;
    this.active.add(key);
    return true;
  }
  end(conversationId: string, attachmentId: string, action: string): void {
    this.active.delete(`${conversationId}:${attachmentId}:${action}`);
  }
  snapshot(): Set<string> { return new Set(this.active); }
}

export function attachedSpreadsheet(attachments: ConversationAttachment[]): SpreadsheetArtifact | null {
  const found = [...attachments].reverse().find((item) => item.kind === 'spreadsheet');
  return found?.kind === 'spreadsheet' ? found.artifact : null;
}

export function parseConversationAttachments(raw: string, conversationId = 'default-session'): ConversationAttachment[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is ConversationAttachmentDraft => {
    if (!entry || typeof entry !== 'object' || typeof entry.name !== 'string') return false;
    if (entry.kind === 'spreadsheet' || entry.kind === 'document') return isArtifact(entry.artifact) && entry.artifact.type === entry.kind;
    return (entry.kind === 'file' || entry.kind === 'image') && typeof entry.contentType === 'string'
      && typeof entry.url === 'string' && entry.url.startsWith('data:');
  }).map((entry) => ({ ...entry, conversationId, attachmentId: typeof (entry as ConversationAttachment).attachmentId === 'string'
    ? (entry as ConversationAttachment).attachmentId : crypto.randomUUID() } as ConversationAttachment));
}

export function attachmentRequestContext(attachments: ConversationAttachment[], spreadsheetOverride?: SpreadsheetArtifact) {
  const spreadsheet = spreadsheetOverride ?? attachedSpreadsheet(attachments);
  const document = [...attachments].reverse().find((item): item is Extract<ConversationAttachment, { kind: 'document' }> => item.kind === 'document');
  return {
    spreadsheetContext: spreadsheet?.sheets[0] ? spreadsheetContext(spreadsheet, spreadsheet.sheets[0]).slice(0, 12_000) : undefined,
    documentContext: document ? documentToText(document.artifact).slice(0, 12_000) : undefined,
  };
}
