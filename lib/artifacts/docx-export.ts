import type { DocumentArtifact } from './core';
import type { ParagraphChild } from 'docx';
import { documentDirection } from './document-direction';
import { bidiRuns } from '@/lib/chat/bidi';
import { separateCitations, type ChatWebSource } from '@/lib/chat/web-sources';

// Loaded only after the user chooses Word export.
export async function documentToDocx(document: DocumentArtifact, sources: readonly ChatWebSource[] = []): Promise<Blob> {
  const { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, AlignmentType, LevelFormat, ExternalHyperlink } = await import('docx');
  const direction = documentDirection(document);
  const rtl = direction === 'rtl';
  const alignment = rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const runs = (value: string): ParagraphChild[] => separateCitations(value, sources).text.split(/(\[[^\]]+\]\(https?:\/\/[^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).flatMap<ParagraphChild>((part) => {
    const link = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/u.exec(part);
    if (link) return [new ExternalHyperlink({ link: link[2], children: bidiRuns(link[1], direction).map((run) => new TextRun({ text: run.text,
      rightToLeft: run.direction ? run.direction === 'rtl' : rtl, superScript: sources.some((source) => source.url === link[2]) })) })];
    const bold = part.startsWith('**') && part.endsWith('**');
    const italics = !bold && part.startsWith('*') && part.endsWith('*');
    return bidiRuns(bold ? part.slice(2, -2) : italics ? part.slice(1, -1) : part, direction)
      .map((run) => new TextRun({ text: run.text, bold, italics, rightToLeft: run.direction ? run.direction === 'rtl' : rtl }));
  });
  const children = document.blocks.map((block, blockIndex) => {
    if (block.kind === 'table') return new Table({ visuallyRightToLeft: rtl, rows: block.rows.map((row) => new TableRow({ children: row.map((cell) => new TableCell({ children: [new Paragraph({ alignment, bidirectional: rtl, children: runs(cell) })] })) })) });
    if (block.kind === 'list') return block.items.map((item, index) => new Paragraph({
      alignment, bidirectional: rtl,
      numbering: { reference: block.ordered ? 'ordered' : 'bullets', level: 0, instance: blockIndex },
      children: runs(item),
    }));
    return new Paragraph({
      alignment, bidirectional: rtl,
      ...(block.kind === 'heading' ? { heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][block.level - 1] } : {}),
      children: runs(block.text),
    });
  }).flat();
  return Packer.toBlob(new Document({ numbering: { config: [
    { reference: 'ordered', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment }] },
    { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment }] },
  ] }, sections: [{ children }] }));
}
