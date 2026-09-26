import { z } from 'zod';
import { parsePresentationResponse, PRESENTATION_MODEL_SHAPE, type Artifact, type PresentationFailureCategory } from './core';
import { getArtifactTool, runArtifactTool, verifyArtifactToolResult } from './tool-registry';

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
    id: z.string().min(1), layout: z.enum(['title', 'content']), variant: z.enum(['cover', 'kpi', 'chart', 'table', 'insights']).optional(), title: text,
    subtitle: text.optional(), notes: text.optional(), blocks: z.array(slideBlock).max(30),
  })).min(1).max(12) }),
]);

const safeMediaUrl = z.string().max(2048).refine((url) =>
  url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')
  || /^https:\/\/[^\s]+$/i.test(url), 'Unsafe media URL');

export type ChatMessagePart =
  | { type: 'text'; text: string; failureCategory?: PresentationFailureCategory }
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
  `When the user requests a presentation, return ONLY one JSON object matching this PresentationArtifact shape: ${JSON.stringify(PRESENTATION_MODEL_SHAPE)}. Replace the example values with the user's content. Use 1–8 concise slides and set each slide variant to cover, kpi, table, or insights as appropriate. Summarize source data into key metrics, trends, and evidence-based takeaways; never paste raw spreadsheet rows. For a KPI slide use a two-column table of metric labels and values. For a table slide use only a small summary table. Use only supported text, bullets, and table blocks; a chart block requires an existing chartId and must not be invented. Do not wrap the JSON in Markdown or add explanatory text. Do not include URLs, executable content, or unsupported blocks.`;

const presentationLike = (content: string) =>
  /\{\s*"type"\s*:\s*"presentation"|\{\s*"slides"\s*:/i.test(content);

function artifactCandidate(content: string): string | null {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(content);
  const source = (fence?.[1] ?? content).trim();
  if (!source.startsWith('{') || source.length > 80_000) return null;
  return source;
}

function embeddedArtifact(content: string, language: string): { artifact: Artifact; start: number; end: number } | null {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(content);
  if (fence) {
    const artifact = parseChatArtifact(fence[1], language);
    if (artifact) return { artifact, start: fence.index, end: fence.index + fence[0].length };
  }
  const start = content.search(/\{\s*"(?:type|tool)"\s*:\s*"(?:presentation|chart|document|spreadsheet|create_(?:table|chart|document|spreadsheet|presentation))"/i);
  if (start < 0) return null;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let end = start; end < content.length; end++) {
    const character = content[end];
    if (escaped) { escaped = false; continue; }
    if (quoted && character === '\\') { escaped = true; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (quoted) continue;
    if (character === '{') depth++;
    if (character === '}' && --depth === 0) {
      const artifact = parseChatArtifact(content.slice(start, end + 1), language);
      return artifact ? { artifact, start, end: end + 1 } : null;
    }
  }
  return null;
}

export function parseChatArtifact(content: string, language: string): Artifact | null {
  const toolSource = artifactCandidate(content);
  if (toolSource) {
    try {
      const invocation = JSON.parse(toolSource) as { tool?: unknown; input?: unknown };
      if (typeof invocation.tool === 'string' && getArtifactTool(invocation.tool)) {
        const result = runArtifactTool(invocation.tool, invocation.input);
        return result.status === 'ok' && artifactSchema.safeParse(result.artifact).success ? result.artifact : null;
      }
    } catch { /* Other existing artifact shapes still use the parser below. */ }
  }
  if (presentationLike(content)) {
    const result = parsePresentationResponse(content, language);
    return result.artifact && artifactSchema.safeParse(result.artifact).success ? result.artifact : null;
  }
  const source = artifactCandidate(content);
  if (!source) return null;
  try {
    const value = JSON.parse(source) as unknown;
    if (!value || typeof value !== 'object') return null;
    const type = (value as { type?: unknown }).type;
    if (type === 'presentation') return null;
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
  const source = artifactCandidate(content);
  return source !== null && /"tool"\s*:\s*"create_(?:table|chart|document|spreadsheet|presentation)"|"type"\s*:\s*"(?:table|chart|document|spreadsheet|presentation|image|video|file)"/i.test(source);
}

export function chatPartsFromToolInvocations(invocations: unknown, language: string): ChatMessagePart[] {
  if (!Array.isArray(invocations)) return [];
  const parts: ChatMessagePart[] = [];
  for (const invocation of invocations.slice(0, 5)) {
    if (!invocation || typeof invocation !== 'object' || invocation.state !== 'result' || typeof invocation.toolName !== 'string') continue;
    const valid = validatedArtifactPartFromToolResult(invocation.toolName, invocation.result);
    if (valid) parts.push(valid);
    else if (getArtifactTool(invocation.toolName)) parts.push({ type: 'text', text: language === 'ar'
      ? 'تعذر إنشاء معاينة آمنة لهذا المحتوى. حاول مرة أخرى.' : language === 'fr'
        ? 'Impossible de créer un aperçu sûr de ce contenu. Réessayez.' : 'A safe preview could not be created for this content. Please try again.' });
  }
  return parts;
}

export function validatedArtifactPartFromToolResult(name: string, result: unknown): ChatMessagePart | null {
  const artifact = verifyArtifactToolResult(name, result);
  if (!artifact) return null;
  const valid = artifactSchema.safeParse(artifact);
  return valid.success ? { type: artifact.type, artifact: valid.data } as ChatMessagePart : null;
}

export function chatPartsFromMessage(content: string, language: string, stored?: unknown): ChatMessagePart[] {
  if (Array.isArray(stored) && stored.length > 0 && stored.length <= 20) {
    const parts: ChatMessagePart[] = [];
    for (const part of stored) {
      if (!part || typeof part !== 'object') break;
      if (part.type === 'text' && text.safeParse(part.text).success) parts.push({ type: 'text', text: part.text,
        ...(['presentation_json_not_found', 'presentation_json_parse_failed', 'presentation_schema_invalid', 'presentation_block_invalid'].includes(part.failureCategory)
          ? { failureCategory: part.failureCategory as PresentationFailureCategory } : {}) });
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
    if (parts.length === stored.length && !(parts.length === 1 && parts[0].type === 'text'
      && parts[0].text === content && looksLikeArtifactOutput(content))) return parts;
  }
  const embedded = embeddedArtifact(content, language);
  if (embedded && (embedded.start > 0 || embedded.end < content.length)) {
    const before = content.slice(0, embedded.start);
    const after = content.slice(embedded.end);
    return [
      ...(before ? [{ type: 'text' as const, text: before }] : []),
      { type: embedded.artifact.type, artifact: embedded.artifact } as ChatMessagePart,
      ...(after ? [{ type: 'text' as const, text: after }] : []),
    ];
  }
  const artifact = parseChatArtifact(content, language);
  if (artifact) return [{ type: artifact.type, artifact } as ChatMessagePart];
  const media = parseChatMedia(content);
  if (media) return [media];
  if (presentationLike(content)) {
    const result = parsePresentationResponse(content, language);
    const reason = result.reason ?? 'presentation_schema_invalid';
    return [{ type: 'text', failureCategory: reason, text: language === 'ar'
      ? 'تعذر إنشاء معاينة صالحة للعرض التقديمي. حاول مرة أخرى.'
      : language === 'fr' ? 'Impossible de créer un aperçu valide de la présentation. Réessayez.'
        : "I couldn't create a valid presentation preview. Try again." }];
  }
  if (looksLikeArtifactOutput(content)) return [{ type: 'text', text: language === 'ar'
    ? 'تعذر إنشاء معاينة آمنة لهذا المحتوى. حاول مرة أخرى.'
    : language === 'fr' ? 'Impossible de créer un aperçu sûr de ce contenu. Réessayez.'
      : 'A safe preview could not be created for this content. Please try again.' }];
  return [{ type: 'text', text: content }];
}

export function streamingSafeText(content: string): string {
  // Only hold a structured artifact candidate. Ordinary braces and Markdown
  // fences inside prose must never truncate the answer.
  const leading = content.match(/^\s*/)?.[0].length ?? 0;
  const source = content.slice(leading);
  const fence = /```(?:json)?\s*\{\s*"(?:type|tool)"\s*:\s*"(?:presentation|chart|document|spreadsheet|create_(?:table|chart|document|spreadsheet|presentation))"/i.exec(content);
  if (fence) return content.slice(0, fence.index).trimEnd();
  const object = /\{\s*"(?:type|tool)"\s*:\s*"(?:presentation|chart|document|spreadsheet|create_(?:table|chart|document|spreadsheet|presentation))"/i.exec(source);
  if (object) return content.slice(0, leading + object.index).trimEnd();
  return content;
}
