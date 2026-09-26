import { z } from 'zod';
import { presentationFromResponse, type Artifact } from './core';

const text = z.string().max(80_000);
const base = z.object({
  schemaVersion: z.literal(1), id: z.string().min(1).max(160),
  title: z.string().min(1).max(200), language: z.string().min(1).max(32),
  direction: z.enum(['ltr', 'rtl']),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
});
const documentBlock = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('heading'), level: z.union([z.literal(1), z.literal(2), z.literal(3)]), text }),
  z.object({ kind: z.literal('paragraph'), text }),
  z.object({ kind: z.literal('list'), ordered: z.boolean(), items: z.array(text).max(100) }),
  z.object({ kind: z.literal('table'), rows: z.array(z.array(text).max(40)).max(200) }),
]);
const sheetCell = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const slideBlock = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text }),
  z.object({ kind: z.literal('bullets'), items: z.array(text).max(100) }),
  z.object({ kind: z.literal('table'), rows: z.array(z.array(text).max(40)).max(200) }),
  z.object({ kind: z.literal('chart'), chartId: z.string().min(1) }),
  z.object({ kind: z.literal('image'), src: z.string().regex(/^data:image\/(png|jpeg|webp);base64,/i), alt: text.optional() }),
]);
const artifactSchema = z.discriminatedUnion('type', [
  base.extend({ type: z.literal('document'), blocks: z.array(documentBlock).min(1).max(200) }),
  base.extend({ type: z.literal('spreadsheet'), sheets: z.array(z.object({
    id: z.string().min(1), name: text, columns: z.array(text).max(100),
    rows: z.array(z.array(sheetCell).max(100)).max(5000),
  })).min(1).max(20) }),
  base.extend({ type: z.literal('chart'), chartType: z.enum(['bar', 'line', 'area', 'pie', 'donut', 'scatter']),
    categories: z.array(text).max(5000), series: z.array(z.object({ name: text, values: z.array(z.number().finite().nullable()).max(5000) })).min(1).max(30),
  }),
  base.extend({ type: z.literal('presentation'), slides: z.array(z.object({
    id: z.string().min(1), layout: z.enum(['title', 'content']), title: text,
    subtitle: text.optional(), notes: text.optional(), blocks: z.array(slideBlock).max(30),
  })).min(1).max(12) }),
]);

const safeMediaUrl = z.string().max(2048).refine((url) =>
  url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')
  || /^https:\/\/[^\s]+$/i.test(url), 'Unsafe media URL');

export type ChatMessagePart =
  | { type: 'text'; text: string }
  | { [K in Artifact['type']]: { type: K; artifact: Extract<Artifact, { type: K }> } }[Artifact['type']]
  | { type: 'image'; url: string; name: string; mimeType?: string }
  | { type: 'video'; url: string; name: string; mimeType?: string }
  | { type: 'file'; url: string; name: string; mimeType?: string };

const mediaPart = z.object({ type: z.enum(['image', 'video', 'file']), url: safeMediaUrl,
  name: z.string().min(1).max(160), mimeType: z.string().max(100).optional() });

export function presentationRequested(input: string): boolean {
  return /\b(presentation|slide\s*deck|powerpoint|pptx|diaporama|présentation|diapositives)\b|عرض\s*(?:تقديمي|شرائح)|شرائح/i.test(input);
}

export const PRESENTATION_OUTPUT_INSTRUCTION =
  'When the user requests a presentation, return ONLY one JSON object shaped like {"type":"presentation","title":"...","slides":[{"title":"...","layout":"title","blocks":[{"kind":"text","text":"..."}]}]}. Use 1–8 slides. Blocks may only be text, bullets (items: string[]), or table (rows: string[][]). Do not wrap the JSON in Markdown or add explanatory text. Do not include URLs, executable content, or unsupported blocks.';

function artifactCandidate(content: string): string | null {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(content);
  const source = (fence?.[1] ?? content).trim();
  if (!source.startsWith('{') || source.length > 80_000) return null;
  return source;
}

export function parseChatArtifact(content: string, language: string): Artifact | null {
  const source = artifactCandidate(content);
  if (!source) return null;
  try {
    const value = JSON.parse(source) as unknown;
    if (!value || typeof value !== 'object') return null;
    const type = (value as { type?: unknown }).type;
    if (type === 'presentation') {
      const presentation = presentationFromResponse(source, language);
      return presentation && artifactSchema.safeParse(presentation).success ? presentation : null;
    }
    const parsed = artifactSchema.safeParse(value);
    return parsed.success ? parsed.data as Artifact : null;
  } catch { return null; }
}

function parseChatMedia(content: string): ChatMessagePart | null {
  const source = artifactCandidate(content);
  if (!source) return null;
  try {
    const parsed = mediaPart.safeParse(JSON.parse(source));
    return parsed.success ? parsed.data as ChatMessagePart : null;
  } catch { return null; }
}

export function looksLikeArtifactOutput(content: string): boolean {
  const trimmed = content.trimStart();
  return trimmed.startsWith('{') && /"(?:type|schemaVersion|slides|sheets|blocks|series)"\s*:/.test(trimmed)
    || /```(?:json)?\s*\{[\s\S]*?"(?:type|schemaVersion|slides|sheets|blocks|series)"\s*:/i.test(content);
}

export function chatPartsFromMessage(content: string, language: string, stored?: unknown): ChatMessagePart[] {
  if (Array.isArray(stored) && stored.length > 0 && stored.length <= 20) {
    const parts: ChatMessagePart[] = [];
    for (const part of stored) {
      if (!part || typeof part !== 'object') break;
      if (part.type === 'text' && text.safeParse(part.text).success) parts.push({ type: 'text', text: part.text });
      else if (['document', 'spreadsheet', 'chart', 'presentation'].includes(part.type)) {
        const parsed = artifactSchema.safeParse(part.artifact);
        if (!parsed.success || parsed.data.type !== part.type) break;
        parts.push({ type: part.type, artifact: parsed.data } as ChatMessagePart);
      } else {
        const parsed = mediaPart.safeParse(part);
        if (!parsed.success) break;
        parts.push(parsed.data as ChatMessagePart);
      }
    }
    if (parts.length === stored.length && !(looksLikeArtifactOutput(content) && parts.some((part) => part.type === 'text'))) return parts;
  }
  const artifact = parseChatArtifact(content, language);
  if (artifact) return [{ type: artifact.type, artifact } as ChatMessagePart];
  const media = parseChatMedia(content);
  if (media) return [media];
  if (looksLikeArtifactOutput(content)) return [{ type: 'text', text: language === 'ar'
    ? 'تعذر إنشاء معاينة آمنة لهذا المحتوى. حاول مرة أخرى.'
    : language === 'fr' ? 'Impossible de créer un aperçu sûr de ce contenu. Réessayez.'
      : 'A safe preview could not be created for this content. Please try again.' }];
  return [{ type: 'text', text: content }];
}

export function streamingSafeText(content: string): string {
  // Hold any opening object while streaming: the discriminator may not have arrived yet.
  const start = content.search(/```(?:json)?\s*|\{/i);
  if (start >= 0) return content.slice(0, start).trimEnd();
  if (/^\s*(?:```(?:json)?\s*|\{)/.test(content)) return '';
  return content;
}
