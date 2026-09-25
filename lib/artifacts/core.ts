import { detectDir } from '@/src/lib/direction';

export type ArtifactType = 'document' | 'presentation' | 'spreadsheet' | 'chart';
export type ArtifactDirection = 'ltr' | 'rtl';
export type DocumentBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; rows: string[][] };
export type Artifact = {
  schemaVersion: 1;
  id: string;
  type: ArtifactType;
  title: string;
  language: string;
  direction: ArtifactDirection;
  blocks: DocumentBlock[];
  metadata: Record<string, string | number | boolean>;
};
export type DocumentArtifact = Artifact & { type: 'document' };

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
