import { documentToText, isArtifact, type DocumentArtifact, type SpreadsheetArtifact } from '@/lib/artifacts/core';
import { spreadsheetContext } from '@/lib/artifacts/spreadsheet-actions';

export type ConversationAttachment =
  | { kind: 'spreadsheet'; name: string; artifact: SpreadsheetArtifact }
  | { kind: 'document'; name: string; artifact: DocumentArtifact }
  | { kind: 'file'; name: string; contentType: string; url: string }
  | { kind: 'image'; name: string; contentType: string; url: string };

export function uploadFileKind(file: Pick<File, 'name' | 'type'>): ConversationAttachment['kind'] | null {
  if (/\.(xlsx|csv)$/i.test(file.name)) return 'spreadsheet';
  if (/\.(txt|md|json|py|ts|tsx|js|jsx|yaml|yml)$/i.test(file.name)) return 'document';
  if (/\.(pdf|doc|docx)$/i.test(file.name)) return 'file';
  if (/\.(png|jpe?g|gif|webp)$/i.test(file.name) || /^image\/(png|jpeg|gif|webp)$/.test(file.type)) return 'image';
  return null;
}

export function attachConversationFile(attachments: ConversationAttachment[], attachment: ConversationAttachment): ConversationAttachment[] {
  return [...attachments.filter((item) => item.name !== attachment.name && !(item.kind === 'spreadsheet'
    && attachment.kind === 'spreadsheet' && item.artifact.id === attachment.artifact.id)), attachment];
}

export function attachedSpreadsheet(attachments: ConversationAttachment[]): SpreadsheetArtifact | null {
  const found = [...attachments].reverse().find((item) => item.kind === 'spreadsheet');
  return found?.kind === 'spreadsheet' ? found.artifact : null;
}

export function parseConversationAttachments(raw: string): ConversationAttachment[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is ConversationAttachment => {
    if (!entry || typeof entry !== 'object' || typeof entry.name !== 'string') return false;
    if (entry.kind === 'spreadsheet' || entry.kind === 'document') return isArtifact(entry.artifact) && entry.artifact.type === entry.kind;
    return (entry.kind === 'file' || entry.kind === 'image') && typeof entry.contentType === 'string'
      && typeof entry.url === 'string' && entry.url.startsWith('data:');
  });
}

export function attachmentRequestContext(attachments: ConversationAttachment[], spreadsheetOverride?: SpreadsheetArtifact) {
  const spreadsheet = spreadsheetOverride ?? attachedSpreadsheet(attachments);
  const document = [...attachments].reverse().find((item): item is Extract<ConversationAttachment, { kind: 'document' }> => item.kind === 'document');
  return {
    spreadsheetContext: spreadsheet?.sheets[0] ? spreadsheetContext(spreadsheet, spreadsheet.sheets[0]).slice(0, 12_000) : undefined,
    documentContext: document ? documentToText(document.artifact).slice(0, 12_000) : undefined,
  };
}
