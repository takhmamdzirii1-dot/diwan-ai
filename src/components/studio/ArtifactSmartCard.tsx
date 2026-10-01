'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ChatMessagePart } from '@/lib/artifacts/chat-parts';
import type { ChatWebSource } from '@/lib/chat/web-sources';
import { copyChatContent } from '@/lib/chat/copy-content';
import type { ChartArtifact, PresentationArtifact, SpreadsheetArtifact, ArtifactSheet } from '@/lib/artifacts/core';
import { presentationFromSheet } from '@/lib/artifacts/spreadsheet-actions';
import { artifactActionLabel, chartFromStructuredRows, documentTable, presentationFromChart,
  primaryArtifactActions, readableArtifactCopy, readableTableCopy, secondaryArtifactActions, type ArtifactAction } from '@/lib/chat/contextual-guidance';

const ArtifactDocumentPreview = dynamic(() => import('./ArtifactDocumentPreview'), { ssr: false });
const ArtifactSpreadsheetPreview = dynamic(() => import('./ArtifactSpreadsheetPreview'), { ssr: false });
const ArtifactPresentationPreview = dynamic(() => import('./ArtifactPresentationPreview'), { ssr: false });
const ArtifactChart = dynamic(() => import('./ArtifactChart'), { ssr: false });

function download(blob: Blob, title: string, extension: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'artifact'}.${extension}`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const syntheticSheet = (artifact: SpreadsheetArtifact): ArtifactSheet | null => {
  const sheet = artifact.sheets[0];
  return sheet ? { ...sheet, rows: [sheet.columns, ...sheet.rows] } : null;
};

export default function ArtifactSmartCard({ part, locale, onRequestPrompt, timestamp, sources }: {
  part: Extract<ChatMessagePart, { artifact: unknown }>;
  locale: string;
  onRequestPrompt?: (prompt: string, artifact?: import('@/lib/artifacts/core').SpreadsheetArtifact, context?: string) => void;
  timestamp?: string | null;
  sources?: ChatWebSource[];
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generatedChart, setGeneratedChart] = useState<ChartArtifact | null>(null);
  const [generatedPresentation, setGeneratedPresentation] = useState<PresentationArtifact | null>(null);
  const [chartExport, setChartExport] = useState<(() => string) | null>(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const chartReady = useCallback((exportPng: () => string) => setChartExport(() => exportPng), []);
  const primary = primaryArtifactActions(part);
  const secondary = secondaryArtifactActions(part);
  const title = part.artifact.title;
  const copied = locale.startsWith('ar') ? 'تم النسخ' : locale.startsWith('fr') ? 'Copié' : 'Copied';
  const downloaded = locale.startsWith('ar') ? 'تم التنزيل' : locale.startsWith('fr') ? 'Téléchargé' : 'Downloaded';
  const failed = locale.startsWith('ar') ? 'تعذر إكمال هذا الإجراء الآن.' : locale.startsWith('fr') ? "Impossible de terminer cette action pour le moment." : "I couldn't complete this right now.";
  const handleAction = async (action: ArtifactAction) => {
    setActionError(''); setNotice('');
    try {
      if (action === 'copy' || action === 'copy_table' || action === 'copy_outline') {
        const text = action === 'copy_table' && part.type === 'document' ? readableTableCopy(part.artifact) : readableArtifactCopy(part);
        if (part.type === 'document') await copyChatContent(text, sources?.map((source) => source.url));
        else await navigator.clipboard.writeText(text);
        setNotice(copied);
      } else if (action === 'preview' || action === 'export_document') setPreviewOpen(true);
      else if (action === 'create_chart') {
        const table = part.type === 'document' ? documentTable(part.artifact) : null;
        const chart = table && table.length > 1 ? chartFromStructuredRows(title, part.artifact.language, part.artifact.direction,
          table[0], table.slice(1)) : part.type === 'spreadsheet' && part.artifact.sheets[0]
          ? chartFromStructuredRows(title, part.artifact.language, part.artifact.direction,
            part.artifact.sheets[0].columns, part.artifact.sheets[0].rows) : null;
        if (!chart) throw new Error('NO_CHART_DATA');
        setGeneratedChart(chart);
      } else if (action === 'analyze' && part.type === 'spreadsheet') {
        const sheet = part.artifact.sheets[0];
        if (!sheet || !onRequestPrompt) throw new Error('NO_SHEET');
        onRequestPrompt('Analyze this spreadsheet and summarize the main findings.', part.artifact);
      } else if (action === 'build_presentation' && part.type === 'spreadsheet') {
        const sheet = syntheticSheet(part.artifact);
        if (!sheet) throw new Error('NO_SHEET');
        setGeneratedPresentation(presentationFromSheet(part.artifact, sheet));
      } else if (action === 'use_in_presentation' && part.type === 'chart') {
        setGeneratedPresentation(presentationFromChart(part.artifact));
      } else if (action === 'download_png' && part.type === 'chart') {
        const url = chartExport?.();
        if (!url) throw new Error('CHART_NOT_READY');
        const link = document.createElement('a'); link.href = url; link.download = `${title.replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'chart'}.png`; link.click();
        setNotice(downloaded);
      } else if (action === 'download_xlsx' && part.type === 'spreadsheet') {
        const { exportSpreadsheet } = await import('@/lib/artifacts/spreadsheet-io');
        download(await exportSpreadsheet(part.artifact), title, 'xlsx'); setNotice(downloaded);
      } else if (action === 'download_csv' && part.type === 'spreadsheet') {
        const sheet = part.artifact.sheets[0];
        if (!sheet) throw new Error('NO_SHEET');
        const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
        const csv = [sheet.columns, ...sheet.rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
        download(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }), title, 'csv');
        setNotice(downloaded);
      } else if (action === 'download_pptx' && part.type === 'presentation') {
        const { presentationToPptx } = await import('@/lib/artifacts/pptx-export');
        download(await presentationToPptx(part.artifact, []), title, 'pptx'); setNotice(downloaded);
      }
    } catch { setActionError(failed); }
  };

  return <section data-testid={`artifact-${part.type}`} className="w-full space-y-2" dir="ltr" aria-label={title}>
    {part.type === 'document' && <ArtifactDocumentPreview artifact={part.artifact} locale={locale} sources={sources} onClose={() => undefined} inline />}
    {part.type === 'spreadsheet' && <ArtifactSpreadsheetPreview initialArtifact={part.artifact} locale={locale} onClose={() => undefined}
      onAnalyze={(prompt, artifact, context) => onRequestPrompt?.(prompt, artifact, context)} inline inlineActionsHandledExternally />}
    {part.type === 'chart' && <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-3">
      <ArtifactChart artifact={part.artifact} onReady={chartReady} /></div>}
    {part.type === 'presentation' && <ArtifactPresentationPreview artifact={part.artifact} onClose={() => undefined} inline />}
    <div className="flex flex-wrap items-center gap-2">
      {primary.slice(0, 3).map((action) => <button key={action} type="button" onClick={() => void handleAction(action)}
        disabled={action === 'download_png' && !chartExport}
        className="rounded-lg border border-[var(--studio-border-strong)] px-2.5 py-1.5 text-xs text-[var(--studio-text-primary)] hover:bg-white/[0.07] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
        {artifactActionLabel(action, locale)}
      </button>)}
      {secondary.length > 0 && <details className="relative text-xs text-[var(--studio-text-secondary)]">
        <summary className="cursor-pointer rounded-lg border border-[var(--studio-border)] px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
          {locale.startsWith('ar') ? 'المزيد' : locale.startsWith('fr') ? 'Plus' : 'More'}</summary>
        <div className="absolute top-full z-20 mt-1 min-w-36 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-popover)] p-1 shadow-[var(--studio-shadow)]">
          {secondary.map((action) => <button key={action} type="button" onClick={() => void handleAction(action)}
            className="block w-full rounded-md px-2.5 py-1.5 text-start text-xs text-[var(--studio-text-primary)] hover:bg-white/[0.07]">
            {artifactActionLabel(action, locale)}</button>)}
        </div>
      </details>}
      {timestamp && <time className="ms-auto text-[10px] tabular-nums text-white/40 sm:text-white/25 sm:group-hover:text-white/55">{timestamp}</time>}
    </div>
    {notice && <span role="status" className="text-xs text-[var(--studio-text-secondary)]">{notice}</span>}
    {actionError && <p role="alert" className="text-xs text-red-300">{actionError}</p>}
    {generatedChart && <ArtifactSmartCard part={{ type: 'chart', artifact: generatedChart }} locale={locale} />}
    {previewOpen && part.type === 'document' && <ArtifactDocumentPreview artifact={part.artifact} locale={locale} sources={sources} onClose={() => setPreviewOpen(false)} />}
    {previewOpen && part.type === 'spreadsheet' && <ArtifactSpreadsheetPreview initialArtifact={part.artifact} locale={locale}
      onClose={() => setPreviewOpen(false)} onAnalyze={(prompt, artifact, context) => { setPreviewOpen(false); onRequestPrompt?.(prompt, artifact, context); }} />}
    {previewOpen && part.type === 'presentation' && <ArtifactPresentationPreview artifact={part.artifact} onClose={() => setPreviewOpen(false)} />}
    {generatedPresentation && <ArtifactPresentationPreview artifact={generatedPresentation}
      charts={part.type === 'chart' ? [part.artifact] : []} onClose={() => setGeneratedPresentation(null)} />}
  </section>;
}
