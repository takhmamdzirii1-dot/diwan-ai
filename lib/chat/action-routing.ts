import { resolveRouteCapabilities, routeAllowsAttachment, type RouteCapabilityStore, type RouteIdentity } from '@/lib/models/capability-v2';
import type { ArtifactToolSelection } from '@/lib/artifacts/tool-registry';
import { chatPartsFromMessage, looksLikeArtifactOutput, type ChatMessagePart } from '@/lib/artifacts/chat-parts';
import { runArtifactTool } from '@/lib/artifacts/tool-registry';
import type { SpreadsheetArtifact } from '@/lib/artifacts/core';
import { isFileFollowUp, type ChatIntent } from './intent-router';
import { readableArtifactCopy } from './contextual-guidance';

/** Preserve existing route order; only filter an explicit action before a provider request. */
export function routesForChatAction<T extends RouteIdentity>(routes: readonly T[],
  stored: RouteCapabilityStore, selection: ArtifactToolSelection,
  attachmentTypes: readonly string[] = [], verifyAttachments = false): T[] {
  const eligible = routes.filter((route) => {
    const { resolved } = resolveRouteCapabilities({ route, stored });
    return resolved.streaming.state !== 'unsupported'
      && (!verifyAttachments || attachmentTypes.every((type) => routeAllowsAttachment(resolved, type)));
  });
  if (!selection.names.length) return eligible;
  const capable = (route: T) => {
    const { resolved } = resolveRouteCapabilities({ route, stored });
    return resolved.tools.state === 'supported' || resolved.structuredOutput.state === 'supported';
  };
  if (selection.mode !== 'semantic') return eligible.filter(capable);
  return [...eligible.filter(capable), ...eligible.filter((route) => !capable(route))];
}

export function expectedOutputType(selection: ArtifactToolSelection): 'document' | 'spreadsheet' | 'chart' | 'presentation' | 'file' | null {
  if (selection.mode === 'semantic' || selection.names.length !== 1) return null;
  const name = selection.names[0];
  if (name === 'create_document' || name === 'create_table') return 'document';
  if (name === 'create_spreadsheet') return 'spreadsheet';
  if (name === 'create_chart') return 'chart';
  if (name === 'create_presentation') return 'presentation';
  return 'file';
}

/** Prose, including a capability refusal, never counts as a completed explicit action. */
export function validateRequestedChatOutput(expected: ReturnType<typeof expectedOutputType>,
  text: string, parts: ChatMessagePart[], locale: string): { valid: boolean; text: string; parts: ChatMessagePart[] } {
  if (!expected) return { valid: true, text, parts };
  const alreadyValid = parts.some((part) => part.type === expected);
  const parsed = alreadyValid ? [] : chatPartsFromMessage(text, locale);
  const structured = parsed.length === 1 && parsed[0].type === expected ? parsed[0] : null;
  const result = structured ? [...parts, structured] : parts;
  return { valid: result.some((part) => part.type === expected),
    text: structured || alreadyValid && looksLikeArtifactOutput(text) ? '' : text, parts: result };
}

const priorContentReference = /\b(?:it|this|that|these|those|ça|cela|ceci)\b|(?:اياه|هذا|هذه|ها|منها)/iu;
function csvCell(value: string | number | boolean | null): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Existing resources and prior answer text may be exported without a semantic generation call. */
export function deterministicContextOutput(intent: ChatIntent, request: string,
  spreadsheet: SpreadsheetArtifact | null, priorParts: ChatMessagePart[]): ChatMessagePart | null {
  const priorSheet = priorParts.find((part): part is Extract<ChatMessagePart, { type: 'spreadsheet' }> =>
    part.type === 'spreadsheet');
  const sourceSheet = spreadsheet ?? priorSheet?.artifact ?? null;
  if (intent === 'export_xlsx' && sourceSheet) return { type: 'spreadsheet', artifact: sourceSheet };
  const priorPresentation = priorParts.find((part): part is Extract<ChatMessagePart, { type: 'presentation' }> =>
    part.type === 'presentation');
  if (intent === 'create_presentation' && priorPresentation && !sourceSheet
    && (isFileFollowUp(request) || /\b(?:pptx|powerpoint)\b/i.test(request)
      && /\b(?:give|send|download|export)\b/i.test(request) && priorContentReference.test(request))) return priorPresentation;
  const previousDocument = priorParts.find((part): part is Extract<ChatMessagePart, { type: 'document' }> => part.type === 'document');
  if ((intent === 'export_pdf' || intent === 'export_docx') && previousDocument) return previousDocument;
  if (intent === 'export_csv' && sourceSheet) {
    const sheet = sourceSheet.sheets[0];
    if (!sheet) return null;
    const content = [sheet.columns, ...sheet.rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const result = runArtifactTool('create_csv_file', { title: sourceSheet.title, content });
    return result.status === 'ok' ? result.file : null;
  }
  if (intent === 'export_json' && sourceSheet) {
    const sheet = sourceSheet.sheets[0];
    if (!sheet) return null;
    const content = JSON.stringify({ sheet: sheet.name, columns: sheet.columns, rows: sheet.rows }, null, 2);
    const result = runArtifactTool('create_json_file', { title: sourceSheet.title, content });
    return result.status === 'ok' ? result.file : null;
  }
  if (!priorContentReference.test(request) && !isFileFollowUp(request)) return null;
  const priorFile = priorParts.find((part) => part.type === 'file' && 'content' in part
    && (intent === 'export_txt' && part.format === 'txt' || intent === 'export_md' && part.format === 'md'));
  if (priorFile) return priorFile;
  const text = priorParts.map(readableArtifactCopy).join('\n\n').trim();
  if (!text) return null;
  const tool = intent === 'export_txt' ? 'create_text_file' : intent === 'export_md' ? 'create_markdown_file' : null;
  if (!tool) return null;
  const result = runArtifactTool(tool, { title: 'Answer', content: text });
  return result.status === 'ok' && 'file' in result ? result.file : null;
}
