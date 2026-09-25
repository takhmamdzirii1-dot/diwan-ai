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

export function presentationFromResponse(content: string, language: string): PresentationArtifact | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(content);
  const source = fenced?.[1] ?? content.trim();
  if (source.length > 80_000 || !source.startsWith('{')) return null;
  try {
    const value = JSON.parse(source) as Record<string, unknown>;
    if (value.type !== 'presentation' || !Array.isArray(value.slides) || value.slides.length < 1 || value.slides.length > 12) return null;
    const slides: ArtifactSlide[] = value.slides.map((raw, index) => {
      if (!raw || typeof raw !== 'object') throw new Error('Invalid slide');
      const slide = raw as Record<string, unknown>;
      if (typeof slide.title !== 'string' || !Array.isArray(slide.blocks)) throw new Error('Invalid slide');
      const blocks: SlideBlock[] = slide.blocks.slice(0, 12).map((item: unknown) => {
        if (!item || typeof item !== 'object') throw new Error('Invalid block');
        const block = item as Record<string, unknown>;
        if (block.kind === 'text' && typeof block.text === 'string') return { kind: 'text', text: block.text.slice(0, 2000) };
        if (block.kind === 'bullets' && Array.isArray(block.items) && block.items.every((entry) => typeof entry === 'string')) return { kind: 'bullets', items: block.items.slice(0, 8).map((entry: string) => entry.slice(0, 500)) };
        if (block.kind === 'table' && Array.isArray(block.rows) && block.rows.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string'))) return { kind: 'table', rows: block.rows.slice(0, 10).map((row: string[]) => row.slice(0, 8).map((cell) => cell.slice(0, 300))) };
        throw new Error('Unsupported block');
      });
      return { id: `slide-${index + 1}`, layout: slide.layout === 'title' ? 'title' : 'content', title: slide.title.slice(0, 160), subtitle: typeof slide.subtitle === 'string' ? slide.subtitle.slice(0, 300) : undefined, blocks };
    });
    const title = typeof value.title === 'string' ? value.title.slice(0, 160) : slides[0].title;
    return { schemaVersion: 1, id: crypto.randomUUID(), type: 'presentation', title, language, direction: artifactDirection(language, slides.map((slide) => slide.title).join(' ')), slides, metadata: {} };
  } catch { return null; }
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
