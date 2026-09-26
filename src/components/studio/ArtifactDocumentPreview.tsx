'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { DocumentArtifact } from '@/lib/artifacts/core';
import { documentToMarkdown, documentToText } from '@/lib/artifacts/core';
import styles from './ArtifactDocumentPreview.module.css';

const labels = {
  en: { close: 'Close', copy: 'Copy', txt: 'TXT', markdown: 'Markdown', word: 'Word', pdf: 'PDF / Print', exportError: 'Export failed. Try again.' },
  fr: { close: 'Fermer', copy: 'Copier', txt: 'TXT', markdown: 'Markdown', word: 'Word', pdf: 'PDF / Imprimer', exportError: "Échec de l’export. Réessayez." },
  ar: { close: 'إغلاق', copy: 'نسخ', txt: 'TXT', markdown: 'Markdown', word: 'Word', pdf: 'PDF / طباعة', exportError: 'فشل التصدير. حاول مجددًا.' },
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function ArtifactDocumentPreview({ artifact, locale, onClose, inline = false }: { artifact: DocumentArtifact; locale: string; onClose: () => void; inline?: boolean }) {
  const t = labels[locale as keyof typeof labels] ?? labels.en;
  const [error, setError] = useState(false);
  const filename = artifact.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'document';
  const exportText = (format: 'txt' | 'md') => download(new Blob([format === 'txt' ? documentToText(artifact) : documentToMarkdown(artifact)], { type: 'text/plain;charset=utf-8' }), `${filename}.${format}`);
  const exportWord = async () => {
    setError(false);
    try { const { documentToDocx } = await import('@/lib/artifacts/docx-export'); download(await documentToDocx(artifact), `${filename}.docx`); }
    catch { setError(true); }
  };
  return <div role={inline ? 'region' : 'dialog'} aria-modal={inline ? undefined : true} aria-label={artifact.title} className={inline ? 'w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-3 print:bg-white' : 'fixed inset-0 z-[100] overflow-y-auto bg-black/90 p-3 sm:p-8 print:static print:bg-white print:p-0'} dir={artifact.direction}>
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-neutral-950 p-3 print:hidden">
        <h2 className="me-auto truncate text-sm font-semibold text-white">{artifact.title}</h2>
        {!inline && <><button type="button" onClick={() => void navigator.clipboard.writeText(documentToText(artifact))} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white">{t.copy}</button>
        <button type="button" onClick={() => exportText('txt')} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white">{t.txt}</button>
        <button type="button" onClick={() => exportText('md')} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white">{t.markdown}</button>
        <button type="button" onClick={() => void exportWord()} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white">{t.word}</button>
        <button type="button" onClick={() => window.print()} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white">{t.pdf}</button></>}
        {!inline && <button type="button" onClick={onClose} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black">{t.close}</button>}
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red-200 print:hidden">{t.exportError}</p>}
      <article lang={artifact.language} dir={artifact.direction} className={`${styles.paper} ${inline ? 'max-h-[28rem] overflow-y-auto rounded-xl px-5 py-6 sm:px-8 print:max-h-none print:p-0' : 'min-h-[70vh] rounded-xl px-7 py-10 shadow-2xl sm:px-14 print:min-h-0 print:rounded-none print:p-0 print:shadow-none'}`}>
        {artifact.blocks.map((block, index) => {
          if (block.kind === 'heading') { const Heading = (`h${block.level}` as 'h1' | 'h2' | 'h3'); return <Heading key={index} dir="auto" className={`${block.level === 1 ? 'text-2xl' : block.level === 2 ? 'text-xl' : 'text-lg'} mb-3 mt-6 font-bold`}>{block.text}</Heading>; }
          if (block.kind === 'paragraph') return <div key={index} dir="auto" className="mb-4 leading-7"><ReactMarkdown>{block.text}</ReactMarkdown></div>;
          if (block.kind === 'list') { const List = block.ordered ? 'ol' : 'ul'; return <List key={index} className={`mb-4 ps-7 leading-7 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>{block.items.map((item, itemIndex) => <li key={itemIndex} dir="auto"><ReactMarkdown>{item}</ReactMarkdown></li>)}</List>; }
          return <div key={index} className="mb-4 overflow-x-auto"><table className="w-full border-collapse text-sm"><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} dir="auto" className="border border-neutral-300 p-2">{cell}</td>)}</tr>)}</tbody></table></div>;
        })}
      </article>
    </div>
  </div>;
}
