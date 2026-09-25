import type { DocumentArtifact } from './core';

// Loaded only after the user chooses Word export.
export async function documentToDocx(document: DocumentArtifact): Promise<Blob> {
  const { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun } = await import('docx');
  const rtl = document.direction === 'rtl';
  const runs = (value: string) => value.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((part) => {
    const bold = part.startsWith('**') && part.endsWith('**');
    const italics = !bold && part.startsWith('*') && part.endsWith('*');
    return new TextRun({ text: bold ? part.slice(2, -2) : italics ? part.slice(1, -1) : part, bold, italics, rightToLeft: rtl });
  });
  const children = document.blocks.map((block) => {
    if (block.kind === 'table') return new Table({ rows: block.rows.map((row) => new TableRow({ children: row.map((cell) => new TableCell({ children: [new Paragraph({ bidirectional: rtl, children: [new TextRun({ text: cell, rightToLeft: rtl })] })] })) })) });
    if (block.kind === 'list') return block.items.map((item, index) => new Paragraph({
      bidirectional: rtl,
      children: [new TextRun({ text: `${block.ordered ? `${index + 1}.` : '•'} `, rightToLeft: rtl }), ...runs(item)],
    }));
    return new Paragraph({
      bidirectional: rtl,
      ...(block.kind === 'heading' ? { heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][block.level - 1] } : {}),
      children: runs(block.text),
    });
  }).flat();
  return Packer.toBlob(new Document({ sections: [{ children }] }));
}
