import { detectDir } from '@/src/lib/direction';

export type ArtifactType = 'document' | 'presentation' | 'spreadsheet' | 'chart';
export type ArtifactDirection = 'ltr' | 'rtl';
export type DocumentBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; rows: string[][] };
export type ArtifactBase = {
  schemaVersion: 1;
  id: string;
  type: ArtifactType;
  title: string;
  language: string;
  direction: ArtifactDirection;
  metadata: Record<string, string | number | boolean>;
};
export type DocumentArtifact = ArtifactBase & { type: 'document'; blocks: DocumentBlock[] };
export type SheetCell = string | number | boolean | null;
export type ArtifactSheet = { id: string; name: string; columns: string[]; rows: SheetCell[][] };
export type SpreadsheetArtifact = ArtifactBase & { type: 'spreadsheet'; sheets: ArtifactSheet[] };
export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter';
export type ChartSeries = { name: string; values: (number | null)[] };
export type ChartArtifact = ArtifactBase & {
  type: 'chart'; chartType: ChartType; categories: string[]; series: ChartSeries[];
  source?: { artifactId: string; sheetId: string; rowStart: number; rowEnd: number };
};
export type SlideBlock =
  | { kind: 'text'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'image'; src: string; alt?: string }
  | { kind: 'chart'; chartId: string };
export type ArtifactSlide = { id: string; layout: 'title' | 'content'; title: string; subtitle?: string; blocks: SlideBlock[]; notes?: string };
export type PresentationArtifact = ArtifactBase & { type: 'presentation'; slides: ArtifactSlide[] };
export type Artifact = DocumentArtifact | SpreadsheetArtifact | ChartArtifact | PresentationArtifact;

// This typed example is the single model-facing shape; the parser below owns
// normalization and validation before anything reaches the slide renderer.
export const PRESENTATION_MODEL_SHAPE = {
  schemaVersion: 1, id: 'presentation-id', type: 'presentation', title: 'Presentation title',
  language: 'en', direction: 'ltr', metadata: {}, slides: [{
    id: 'slide-1', layout: 'title', title: 'Slide title', subtitle: 'Optional subtitle',
    blocks: [
      { kind: 'text', text: 'Slide text' },
      { kind: 'bullets', items: ['First point', 'Second point'] },
      { kind: 'table', rows: [['Column', 'Value'], ['Row', 'Value']] },
    ],
  }],
} satisfies PresentationArtifact;

export type PresentationFailureCategory =
  | 'presentation_json_not_found' | 'presentation_json_parse_failed'
  | 'presentation_schema_invalid' | 'presentation_block_invalid';
export type PresentationResponseShape = { fenced: boolean; proseBefore: boolean; proseAfter: boolean };
export type PresentationParseResult =
  | { artifact: PresentationArtifact; reason: null; shape: PresentationResponseShape }
  | { artifact: null; reason: PresentationFailureCategory; shape: PresentationResponseShape; field?: string };

class PresentationValidationError extends Error {
  constructor(readonly category: PresentationFailureCategory, readonly field?: string) { super(category); }
}

function extractPresentationCandidate(content: string): { source: string; shape: PresentationResponseShape } {
  if (content.length > 80_000) throw new PresentationValidationError('presentation_schema_invalid', 'length');
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(content);
  if (fence) return {
    source: fence[1].trim(),
    shape: { fenced: true, proseBefore: !!content.slice(0, fence.index).trim(), proseAfter: !!content.slice(fence.index + fence[0].length).trim() },
  };
  if (/```(?:json)?\s*\{/i.test(content)) throw new PresentationValidationError('presentation_json_parse_failed', 'fence');

  // Find exactly one balanced object, ignoring braces inside quoted strings.
  const spans: Array<[number, number]> = [];
  let start = -1, depth = 0, quoted = false, escaped = false;
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"' && depth > 0) { quoted = true; continue; }
    if (char === '{') { if (depth === 0) start = index; depth++; }
    else if (char === '}' && depth > 0 && --depth === 0) spans.push([start, index + 1]);
  }
  if (depth > 0) throw new PresentationValidationError('presentation_json_parse_failed', 'object');
  if (spans.length !== 1) throw new PresentationValidationError('presentation_json_not_found', 'object');
  const [from, to] = spans[0];
  return { source: content.slice(from, to), shape: { fenced: false, proseBefore: !!content.slice(0, from).trim(), proseAfter: !!content.slice(to).trim() } };
}

export function parsePresentationResponse(content: string, language: string): PresentationParseResult {
  const emptyShape: PresentationResponseShape = { fenced: false, proseBefore: false, proseAfter: false };
  let shape = emptyShape;
  try {
    const candidate = extractPresentationCandidate(content);
    shape = candidate.shape;
    let raw: unknown;
    try { raw = JSON.parse(candidate.source); }
    catch { throw new PresentationValidationError('presentation_json_parse_failed', 'json'); }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PresentationValidationError('presentation_schema_invalid', 'root');
    const value = raw as Record<string, unknown>;
    if (value.type !== 'presentation' || (value.schemaVersion != null && value.schemaVersion !== 1)
      || (value.id != null && typeof value.id !== 'string') || (value.language != null && typeof value.language !== 'string')
      || (value.direction != null && value.direction !== 'ltr' && value.direction !== 'rtl')) {
      throw new PresentationValidationError('presentation_schema_invalid', 'root');
    }
    if (!Array.isArray(value.slides) || value.slides.length < 1 || value.slides.length > 12) throw new PresentationValidationError('presentation_schema_invalid', 'slides');
    const slides: ArtifactSlide[] = value.slides.map((rawSlide, index) => {
      if (!rawSlide || typeof rawSlide !== 'object' || Array.isArray(rawSlide)) throw new PresentationValidationError('presentation_schema_invalid', `slides[${index}]`);
      const slide = rawSlide as Record<string, unknown>;
      if (typeof slide.title !== 'string' || !slide.title.trim() || !Array.isArray(slide.blocks) || slide.blocks.length > 12
        || (slide.id != null && typeof slide.id !== 'string')
        || (slide.layout != null && slide.layout !== 'title' && slide.layout !== 'content')
        || (slide.subtitle != null && typeof slide.subtitle !== 'string')) {
        throw new PresentationValidationError('presentation_schema_invalid', `slides[${index}]`);
      }
      const blocks: SlideBlock[] = slide.blocks.map((rawBlock: unknown, blockIndex: number) => {
        if (!rawBlock || typeof rawBlock !== 'object' || Array.isArray(rawBlock)) throw new PresentationValidationError('presentation_block_invalid', `slides[${index}].blocks[${blockIndex}]`);
        const block = rawBlock as Record<string, unknown>;
        if (block.kind === 'text' && typeof block.text === 'string') return { kind: 'text', text: block.text.slice(0, 2000) };
        if (block.kind === 'bullets' && Array.isArray(block.items) && block.items.length <= 8 && block.items.every((entry) => typeof entry === 'string')) return { kind: 'bullets', items: block.items.map((entry: string) => entry.slice(0, 500)) };
        if (block.kind === 'table' && Array.isArray(block.rows) && block.rows.length <= 10 && block.rows.every((row) => Array.isArray(row) && row.length <= 8 && row.every((cell) => typeof cell === 'string'))) return { kind: 'table', rows: block.rows.map((row: string[]) => row.map((cell) => cell.slice(0, 300))) };
        throw new PresentationValidationError('presentation_block_invalid', `slides[${index}].blocks[${blockIndex}]`);
      });
      return { id: `slide-${index + 1}`, layout: slide.layout === 'title' ? 'title' : 'content', title: slide.title.slice(0, 160), subtitle: typeof slide.subtitle === 'string' ? slide.subtitle.slice(0, 300) : undefined, blocks };
    });
    const title = typeof value.title === 'string' && value.title.trim() ? value.title.slice(0, 160) : slides[0].title;
    const artifact: PresentationArtifact = { schemaVersion: 1, id: crypto.randomUUID(), type: 'presentation', title, language, direction: artifactDirection(language, slides.map((slide) => slide.title).join(' ')), slides, metadata: {} };
    return { artifact, reason: null, shape };
  } catch (cause) {
    return cause instanceof PresentationValidationError
      ? { artifact: null, reason: cause.category, shape, field: cause.field }
      : { artifact: null, reason: 'presentation_schema_invalid', shape };
  }
}

export function presentationFromResponse(content: string, language: string): PresentationArtifact | null {
  return parsePresentationResponse(content, language).artifact;
}

export function isArtifact(value: unknown): value is Artifact {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const base = item.schemaVersion === 1 && typeof item.id === 'string' && typeof item.title === 'string'
    && typeof item.language === 'string' && (item.direction === 'ltr' || item.direction === 'rtl');
  if (!base) return false;
  const cell = (entry: unknown) => entry == null || ['string', 'number', 'boolean'].includes(typeof entry);
  const row = (entry: unknown) => Array.isArray(entry) && entry.every(cell);
  if (item.type === 'document') return Array.isArray(item.blocks) && item.blocks.every((block: unknown) => !!block && typeof block === 'object' && typeof (block as DocumentBlock).kind === 'string');
  if (item.type === 'spreadsheet') return Array.isArray(item.sheets) && item.sheets.every((sheet: unknown) => {
    const entry = sheet as ArtifactSheet;
    return !!entry && typeof entry.id === 'string' && typeof entry.name === 'string' && Array.isArray(entry.columns)
      && entry.columns.every((column) => typeof column === 'string') && Array.isArray(entry.rows) && entry.rows.every(row);
  });
  if (item.type === 'chart') return ['bar', 'line', 'area', 'pie', 'donut', 'scatter'].includes(String(item.chartType))
    && Array.isArray(item.categories) && item.categories.every((category) => typeof category === 'string')
    && Array.isArray(item.series) && item.series.every((series: unknown) => {
      const entry = series as ChartSeries;
      return !!entry && typeof entry.name === 'string' && Array.isArray(entry.values)
        && entry.values.every((number) => number == null || (typeof number === 'number' && Number.isFinite(number)));
    });
  if (item.type === 'presentation') return Array.isArray(item.slides) && item.slides.every((slide: unknown) => {
    const entry = slide as ArtifactSlide;
    return !!entry && typeof entry.id === 'string' && typeof entry.title === 'string'
      && (entry.layout === 'title' || entry.layout === 'content') && Array.isArray(entry.blocks)
      && entry.blocks.every((block) => {
        if (block.kind === 'text') return typeof block.text === 'string';
        if (block.kind === 'bullets') return Array.isArray(block.items) && block.items.every((text) => typeof text === 'string');
        if (block.kind === 'table') return Array.isArray(block.rows) && block.rows.every((tableRow) => Array.isArray(tableRow) && tableRow.every((text) => typeof text === 'string'));
        if (block.kind === 'chart') return typeof block.chartId === 'string';
        return block.kind === 'image' && typeof block.src === 'string';
      });
  });
  return false;
}

export function artifactDirection(language: string, text: string, override?: ArtifactDirection): ArtifactDirection {
  if (override) return override;
  return /^(ar|fa|he|ur)(-|$)/i.test(language) ? 'rtl' : detectDir(text);
}

const stripInline = (value: string) => value.replace(/\*\*|__|(?<!\*)\*(?!\*)|(?<!_)_(?!_)/g, '').trim();

export function documentFromMarkdown(id: string, markdown: string, language: string, direction?: ArtifactDirection): DocumentArtifact {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: DocumentBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index++; continue; }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) { blocks.push({ kind: 'heading', level: heading[1].length as 1 | 2 | 3, text: stripInline(heading[2]) }); index++; continue; }
    if (line.startsWith('|') && index + 1 < lines.length && /^\|?[\s:|-]+\|?$/.test(lines[index + 1].trim())) {
      const rows: string[][] = [line.split('|').slice(1, -1).map(stripInline)];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith('|')) rows.push(lines[index++].trim().split('|').slice(1, -1).map(stripInline));
      blocks.push({ kind: 'table', rows }); continue;
    }
    const item = /^(?:([-*])|(\d+)\.)\s+(.+)$/.exec(line);
    if (item) {
      const ordered = Boolean(item[2]);
      const items: string[] = [];
      while (index < lines.length) {
        const next = /^(?:([-*])|(\d+)\.)\s+(.+)$/.exec(lines[index].trim());
        if (!next || Boolean(next[2]) !== ordered) break;
        items.push(next[3]); index++;
      }
      blocks.push({ kind: 'list', ordered, items }); continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,3}\s|[-*]\s|\d+\.\s|\|)/.test(lines[index].trim())) paragraph.push(lines[index++].trim());
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    else { blocks.push({ kind: 'paragraph', text: line }); index++; }
  }
  const title = blocks.find((block) => block.kind === 'heading')?.text ?? stripInline(lines.find((line) => line.trim()) ?? 'Document').slice(0, 100);
  return { schemaVersion: 1, id, type: 'document', title, language, direction: artifactDirection(language, markdown, direction), blocks, metadata: {} };
}

export function documentToText(document: DocumentArtifact): string {
  return document.blocks.map((block) => {
    if (block.kind === 'table') return block.rows.map((row) => row.join('\t')).join('\n');
    if (block.kind === 'list') return block.items.map((item, index) => `${block.ordered ? `${index + 1}.` : '•'} ${stripInline(item)}`).join('\n');
    return stripInline(block.text);
  }).join('\n\n');
}

export function documentToMarkdown(document: DocumentArtifact): string {
  return document.blocks.map((block) => {
    if (block.kind === 'heading') return `${'#'.repeat(block.level)} ${block.text}`;
    if (block.kind === 'paragraph') return block.text;
    if (block.kind === 'list') return block.items.map((item, index) => `${block.ordered ? `${index + 1}.` : '-'} ${item}`).join('\n');
    const [header, ...rows] = block.rows;
    return [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.join(' | ')} |`)].join('\n');
  }).join('\n\n');
}
