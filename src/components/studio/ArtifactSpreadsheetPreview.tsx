'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ChartArtifact, ChartType, PresentationArtifact, SpreadsheetArtifact } from '@/lib/artifacts/core';
import { chartFromSheet, presentationFromSheet, spreadsheetContext } from '@/lib/artifacts/spreadsheet-actions';

const ArtifactChart = dynamic(() => import('./ArtifactChart'), { ssr: false });
const ArtifactPresentationPreview = dynamic(() => import('./ArtifactPresentationPreview'), { ssr: false });
const PAGE_SIZE = 50;
const copy = {
  en: { analyze: 'Analyze', aiPresentation: 'Create AI presentation', xlsx: 'Download XLSX', close: 'Close', opening: 'Opening workbook locally…', sheet: 'Sheet', rows: 'rows', columns: 'columns', previous: 'Previous rows', next: 'Next rows', chartType: 'Chart type', range: 'Rows', first: 'First row', last: 'Last row', createChart: 'Create chart', png: 'Download PNG', usePresentation: 'Use in presentation' },
  fr: { analyze: 'Analyser', aiPresentation: 'Créer une présentation IA', xlsx: 'Télécharger XLSX', close: 'Fermer', opening: 'Ouverture locale du classeur…', sheet: 'Feuille', rows: 'lignes', columns: 'colonnes', previous: 'Lignes précédentes', next: 'Lignes suivantes', chartType: 'Type de graphique', range: 'Lignes', first: 'Première ligne', last: 'Dernière ligne', createChart: 'Créer un graphique', png: 'Télécharger PNG', usePresentation: 'Utiliser dans une présentation' },
  ar: { analyze: 'تحليل', aiPresentation: 'إنشاء عرض بالذكاء الاصطناعي', xlsx: 'تنزيل XLSX', close: 'إغلاق', opening: 'جارٍ فتح الملف محليًا…', sheet: 'الورقة', rows: 'صفوف', columns: 'أعمدة', previous: 'الصفوف السابقة', next: 'الصفوف التالية', chartType: 'نوع الرسم', range: 'الصفوف', first: 'الصف الأول', last: 'الصف الأخير', createChart: 'إنشاء رسم', png: 'تنزيل PNG', usePresentation: 'استخدامه في عرض' },
};
const safeError = {
  en: { file: "I couldn't read this file.", chart: "I couldn't create a chart from these rows.", export: "I couldn't download this spreadsheet." },
  fr: { file: "Je n'ai pas pu lire ce fichier.", chart: "Je n'ai pas pu créer de graphique avec ces lignes.", export: "Je n'ai pas pu télécharger cette feuille de calcul." },
  ar: { file: 'تعذرت قراءة هذا الملف.', chart: 'تعذر إنشاء رسم بياني من هذه الصفوف.', export: 'تعذر تنزيل جدول البيانات.' },
};
const chartNames: Record<ChartType, [string, string, string]> = {
  bar: ['Bar', 'Barres', 'أعمدة'], line: ['Line', 'Courbe', 'خطي'], area: ['Area', 'Aire', 'مساحة'],
  pie: ['Pie', 'Secteurs', 'دائري'], donut: ['Donut', 'Anneau', 'حلقي'], scatter: ['Scatter', 'Nuage de points', 'مبعثر'],
};

function download(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename.replace(/[\\/:*?"<>|]/g, '').slice(0, 90); link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); }

export default function ArtifactSpreadsheetPreview({ file: sourceFile, initialArtifact, locale, onClose, onAnalyze, onArtifactReady, inline = false, inlineActionsHandledExternally = false }: { file?: File; initialArtifact?: SpreadsheetArtifact; locale: string; onClose: () => void; onAnalyze: (prompt: string) => void | Promise<void>; onArtifactReady?: (artifact: SpreadsheetArtifact) => void; inline?: boolean; inlineActionsHandledExternally?: boolean }) {
  const file = sourceFile ?? { name: initialArtifact?.title ?? 'Spreadsheet' };
  const t = copy[locale as keyof typeof copy] ?? copy.en;
  const safe = safeError[locale as keyof typeof safeError] ?? safeError.en;
  const chartLocaleIndex = locale === 'ar' ? 2 : locale === 'fr' ? 1 : 0;
  const [artifact, setArtifact] = useState<SpreadsheetArtifact | null>(initialArtifact ?? null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(101);
  const [chart, setChart] = useState<ChartArtifact | null>(null);
  const [presentation, setPresentation] = useState<PresentationArtifact | null>(null);
  const [error, setError] = useState('');
  const [exportPng, setExportPng] = useState<(() => string) | null>(null);
  const handleChartReady = useCallback((fn: () => string) => setExportPng(() => fn), []);
  useEffect(() => { if (!sourceFile) return; let cancelled = false; void import('@/lib/artifacts/spreadsheet-io').then(({ importSpreadsheet }) => importSpreadsheet(sourceFile, locale)).then((result) => { if (!cancelled) { setArtifact(result); onArtifactReady?.(result); } }).catch(() => { if (!cancelled) setError(safe.file); }); return () => { cancelled = true; }; }, [sourceFile, locale, safe.file, onArtifactReady]);
  const sheet = artifact?.sheets[sheetIndex];
  const makeChart = () => { if (!artifact || !sheet) return; try { setExportPng(null); setChart(chartFromSheet(artifact, sheet, chartType, Math.max(0, rangeStart - 1), Math.min(sheet.rows.length, rangeEnd))); setError(''); } catch { setError(safe.chart); } };
  const exportXlsx = async () => { if (!artifact) return; try { const { exportSpreadsheet } = await import('@/lib/artifacts/spreadsheet-io'); download(await exportSpreadsheet(artifact), `${artifact.title}.xlsx`); } catch { setError(safe.export); } };
  const analyze = (presentationRequest = false) => { if (!artifact || !sheet) return; const context = spreadsheetContext(artifact, sheet, page * PAGE_SIZE, Math.min(sheet.rows.length, (page + 1) * PAGE_SIZE)); onClose(); void onAnalyze(presentationRequest ? `Create a concise presentation from this spreadsheet. Use only the selected bounded data below; do not request more data.\n\n${context}` : `Analyze this spreadsheet and summarize the main findings. Use only the selected bounded data below; state limitations.\n\n${context}`); };
  if (inline) return <section aria-label={artifact?.title ?? t.sheet} className="w-full rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-3 text-white" dir={artifact?.direction ?? 'auto'}>
    <header className="mb-3 flex items-center justify-between gap-3"><h3 className="truncate text-sm font-semibold">{artifact?.title}</h3>{!inlineActionsHandledExternally && <button type="button" disabled={!artifact} onClick={() => void exportXlsx()} className="rounded-lg border border-white/20 px-3 py-2 text-xs disabled:opacity-50">{t.xlsx}</button>}</header>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {sheet && <div className="max-h-72 overflow-auto rounded-lg border border-white/10"><table className="min-w-full border-collapse text-xs"><thead className="bg-neutral-900"><tr>{sheet.columns.slice(0, 12).map((column, index) => <th key={`${index}-${column}`} className="border border-white/10 p-2 text-start">{column}</th>)}</tr></thead><tbody>{sheet.rows.slice(0, 8).map((row, rowIndex) => <tr key={rowIndex}>{row.slice(0, 12).map((cell, cellIndex) => <td key={cellIndex} dir="auto" className="max-w-60 truncate border border-white/10 p-2">{cell == null ? '' : String(cell)}</td>)}</tr>)}</tbody></table></div>}
  </section>;
  return <div role="dialog" aria-modal="true" aria-label={file.name} className="fixed inset-0 z-[100] overflow-y-auto bg-black/95 p-3 text-white sm:p-8" dir={artifact?.direction ?? 'auto'}>
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-neutral-950 p-3"><h2 className="me-auto truncate text-sm font-semibold">{artifact?.title ?? file.name}</h2><button type="button" onClick={() => analyze()} disabled={!sheet} className="rounded-lg border border-white/20 px-3 py-2 text-xs disabled:opacity-50">{t.analyze}</button><button type="button" onClick={() => analyze(true)} disabled={!sheet} className="rounded-lg border border-white/20 px-3 py-2 text-xs disabled:opacity-50">{t.aiPresentation}</button><button type="button" onClick={() => void exportXlsx()} disabled={!artifact} className="rounded-lg border border-white/20 px-3 py-2 text-xs disabled:opacity-50">{t.xlsx}</button><button type="button" onClick={onClose} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black">{t.close}</button></header>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {!artifact && !error && <p className="text-sm text-white/60">{t.opening}</p>}
      {sheet && <><div className="flex flex-wrap items-center gap-2"><label className="text-xs text-white/60">{t.sheet} <select value={sheetIndex} onChange={(event) => { setSheetIndex(Number(event.target.value)); setPage(0); setChart(null); }} className="ms-2 rounded-lg border border-white/20 bg-neutral-900 p-2 text-white">{artifact?.sheets.map((item, index) => <option key={item.id} value={index}>{item.name}</option>)}</select></label><span className="text-xs text-white/40">{sheet.rows.length} {t.rows} · {sheet.columns.length} {t.columns}</span></div>
        <div className="max-h-[52vh] overflow-auto rounded-xl border border-white/10"><table className="min-w-full border-collapse text-xs"><thead className="sticky top-0 bg-neutral-900"><tr><th className="border border-white/10 p-2">#</th>{sheet.columns.map((column) => <th key={column} className="border border-white/10 p-2 text-start">{column}</th>)}</tr></thead><tbody>{sheet.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((row, index) => <tr key={page * PAGE_SIZE + index}><th className="border border-white/10 p-2 text-white/40">{page * PAGE_SIZE + index + 1}</th>{sheet.columns.map((column, cellIndex) => <td key={column} dir="auto" className="max-w-60 truncate border border-white/10 p-2">{row[cellIndex] == null ? '' : String(row[cellIndex])}</td>)}</tr>)}</tbody></table></div>
        <div className="flex items-center justify-between text-xs"><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg border border-white/20 px-3 py-2 disabled:opacity-40">{t.previous}</button><span>{page * PAGE_SIZE + 1}–{Math.min(sheet.rows.length, (page + 1) * PAGE_SIZE)} / {sheet.rows.length}</span><button type="button" disabled={(page + 1) * PAGE_SIZE >= sheet.rows.length} onClick={() => setPage(page + 1)} className="rounded-lg border border-white/20 px-3 py-2 disabled:opacity-40">{t.next}</button></div>
        <section className="rounded-xl border border-white/10 p-3"><div className="mb-3 flex flex-wrap items-center gap-2"><label className="text-xs">{t.chartType} <select value={chartType} onChange={(event) => setChartType(event.target.value as ChartType)} className="ms-2 rounded-lg border border-white/20 bg-neutral-900 p-2">{(['bar','line','area','pie','donut','scatter'] as const).map((type) => <option key={type} value={type}>{chartNames[type][chartLocaleIndex]}</option>)}</select></label><label className="text-xs">{t.range} <input aria-label={t.first} type="number" min={1} max={sheet.rows.length} value={rangeStart} onChange={(event) => setRangeStart(Number(event.target.value))} className="ms-2 w-16 rounded-lg border border-white/20 bg-neutral-900 p-2" />–<input aria-label={t.last} type="number" min={rangeStart} max={sheet.rows.length} value={rangeEnd} onChange={(event) => setRangeEnd(Number(event.target.value))} className="w-16 rounded-lg border border-white/20 bg-neutral-900 p-2" /></label><button type="button" onClick={makeChart} className="rounded-lg border border-white/20 px-3 py-2 text-xs">{t.createChart}</button>{chart && <><button type="button" disabled={!exportPng} onClick={() => { const url = exportPng?.(); if (url) { const link = document.createElement('a'); link.href = url; link.download = 'chart.png'; link.click(); } }} className="rounded-lg border border-white/20 px-3 py-2 text-xs disabled:opacity-40">{t.png}</button><button type="button" onClick={() => setPresentation(presentationFromSheet(artifact!, sheet, chart))} className="rounded-lg border border-white/20 px-3 py-2 text-xs">{t.usePresentation}</button></>}</div>{chart && <ArtifactChart artifact={chart} onReady={handleChartReady} />}</section>
      </>}
    </div>
    {presentation && <ArtifactPresentationPreview artifact={presentation} charts={chart ? [chart] : []} onClose={() => setPresentation(null)} />}
  </div>;
}
