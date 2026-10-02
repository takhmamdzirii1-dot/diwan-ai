'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { DocumentArtifact } from '@/lib/artifacts/core';
import { documentToMarkdown, documentToText } from '@/lib/artifacts/core';
import styles from './ArtifactDocumentPreview.module.css';
import { cleanCopyText, copyChatContent, copySelectionWithoutSources } from '@/lib/chat/copy-content';
import { citationMarkdown, separateCitations, type ChatWebSource } from '@/lib/chat/web-sources';
import { remarkCitationGroups, referencedSources } from '@/lib/chat/citation-presentation';
import ChatSources, { CitationGroup } from './ChatSources';
import { documentDirection } from '@/lib/artifacts/document-direction';
import { isolatedPlainText } from '@/lib/chat/bidi';
import { isolateText } from './BidiText';

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

export default function ArtifactDocumentPreview({ artifact, locale, onClose, inline = false, sources = [] }: { artifact: DocumentArtifact; locale: string; onClose: () => void; inline?: boolean; sources?: ChatWebSource[] }) {
  const t = labels[locale as keyof typeof labels] ?? labels.en;
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const direction = documentDirection(artifact);
  const displayTitle = cleanCopyText(artifact.title, sources.map((source) => source.url));
  const referenced = referencedSources(documentToMarkdown(artifact), sources);
  const copy = async () => {
    setError(false);
    try { await copyChatContent(documentToText(artifact), sources.map((source) => source.url), direction);
      setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setError(true); }
  };
  const text = (value: string, heading = false) => <ReactMarkdown remarkPlugins={[[remarkCitationGroups, { sources }]]} components={{
    a: ({ href, title, children }) => {
      const ids = title?.startsWith('vantra-citations:') ? title.slice('vantra-citations:'.length).split(',') : [];
      return ids.length ? <CitationGroup sources={sources.filter((source) => ids.includes(source.id))} locale={locale} direction={direction}>{isolateText(children, direction)}</CitationGroup>
        : /^(?:\d+|S\d+)$/u.test(String(children).trim()) ? null
          : <a href={href} target="_blank" rel="noopener noreferrer" dir="auto">{children}</a>;
    },
    p: ({ children }) => <span>{isolateText(children, direction)}</span>,
    code: ({ children }) => <code dir="ltr">{children}</code>,
  }}>{citationMarkdown(heading ? separateCitations(value, sources).text : value, sources)}</ReactMarkdown>;
  const filename = displayTitle.replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'document';
  const exportText = (format: 'txt' | 'md') => {
    const content = separateCitations(format === 'txt' ? documentToText(artifact) : documentToMarkdown(artifact), sources).text;
    download(new Blob([format === 'txt' ? isolatedPlainText(content, direction) : content], { type: 'text/plain;charset=utf-8' }), `${filename}.${format}`);
  };
  const exportWord = async () => {
    setError(false);
    try { const { documentToDocx } = await import('@/lib/artifacts/docx-export'); download(await documentToDocx(artifact, sources), `${filename}.docx`); }
    catch { setError(true); }
  };
  return <div onCopy={(event) => copySelectionWithoutSources(event, direction)} role={inline ? 'region' : 'dialog'} aria-modal={inline ? undefined : true} aria-label={displayTitle} data-vantra-print-document={inline ? undefined : ''} className={inline ? 'w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-3 print:bg-white' : 'fixed inset-0 z-[100] overflow-y-auto bg-black/90 p-3 sm:p-8 print:static print:bg-white print:p-0'} dir="ltr">
    <div className="mx-auto max-w-4xl">
      <div data-vantra-document-actions className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-neutral-950 p-3 print:hidden">
        <h2 className="me-auto truncate text-sm font-semibold text-white">{displayTitle}</h2>
        {!inline && <><button type="button" onClick={() => void copy()} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white">{copied ? locale.startsWith('ar') ? 'تم النسخ' : locale.startsWith('fr') ? 'Copié' : 'Copied' : t.copy}</button>
        <button type="button" onClick={() => exportText('txt')} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white">{t.txt}</button>
        <button type="button" onClick={() => exportText('md')} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white">{t.markdown}</button>
        <button type="button" onClick={() => void exportWord()} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white">{t.word}</button>
        <button type="button" onClick={() => window.print()} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white">{t.pdf}</button></>}
        {!inline && <button type="button" onClick={onClose} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black">{t.close}</button>}
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red-200 print:hidden">{t.exportError}</p>}
      <article lang={artifact.language} dir={direction} className={`${styles.paper} ${inline ? 'max-h-[28rem] overflow-y-auto rounded-xl px-5 py-6 sm:px-8 print:max-h-none print:p-0' : 'min-h-[70vh] rounded-xl px-7 py-10 shadow-2xl sm:px-14 print:min-h-0 print:rounded-none print:p-0 print:shadow-none'}`}>
        {(!artifact.blocks[0] || artifact.blocks[0].kind !== 'heading' || artifact.blocks[0].text.trim() !== artifact.title.trim())
          && <h1 className="hidden text-2xl font-bold print:block">{isolateText(displayTitle, direction)}</h1>}
        {artifact.blocks.map((block, index) => {
          if (block.kind === 'heading') { const Heading = (`h${block.level}` as 'h1' | 'h2' | 'h3'); return <Heading key={index} className={`${block.level === 1 ? 'text-2xl' : block.level === 2 ? 'text-xl' : 'text-lg'} mb-3 mt-6 font-bold`}>{text(block.text, true)}</Heading>; }
          if (block.kind === 'paragraph') return <div key={index} className="mb-4 leading-7">{text(block.text)}</div>;
          if (block.kind === 'list') { const List = block.ordered ? 'ol' : 'ul'; return <List key={index} dir={direction} className={`mb-4 ps-7 leading-7 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{text(item)}</li>)}</List>; }
          return <div key={index} className="mb-4 overflow-x-auto"><table dir={direction} className="w-full border-collapse text-sm"><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="border border-neutral-300 p-2">{text(cell)}</td>)}</tr>)}</tbody></table></div>;
        })}
        {referenced.length > 0 && <ChatSources locale={locale} direction={direction} annotation={{ type: 'vantra-web-sources', state: 'read', readCount: 0, sources: referenced }} />}
      </article>
    </div>
  </div>;
}
