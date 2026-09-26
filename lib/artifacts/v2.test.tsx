import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { documentFromMarkdown, isArtifact, presentationFromResponse } from './core';
import { importSpreadsheet, exportSpreadsheet } from './spreadsheet-io';
import { chartFromSheet, presentationFromSheet, spreadsheetContext } from './spreadsheet-actions';
import { presentationToPptx } from './pptx-export';
import { formatPresentationCell, presentationChart, presentationTheme, presentationVariant } from './presentation-design';
import ArtifactPresentationPreview from '@/src/components/studio/ArtifactPresentationPreview';

function workbookFile(): File {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Month', 'Sales'], ['Jan', 10], ['Feb', 20], ['مارس', 30]]), 'Sales');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['الاسم', 'القيمة'], ['مرحبا', 42]]), 'Arabic');
  return new File([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], 'report.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

test('document V1 remains valid and XLSX/CSV import stays local with multiple sheets and Arabic cells', async () => {
  assert.ok(isArtifact(documentFromMarkdown('doc', '# Report', 'en')));
  const workbook = await importSpreadsheet(workbookFile(), 'ar');
  assert.ok(isArtifact(workbook)); assert.equal(workbook.direction, 'rtl');
  assert.deepEqual(workbook.sheets.map((sheet) => sheet.name), ['Sales', 'Arabic']);
  assert.equal(workbook.sheets[1].rows[1][0], 'مرحبا');
  const csv = new File(['Month,Sales\nJan,10\nFeb,20'], 'sales.csv', { type: 'text/csv' });
  const importedCsv = await importSpreadsheet(csv, 'en');
  assert.equal(importedCsv.sheets[0].rows[1][0], 'Jan');
  assert.equal(importedCsv.sheets[0].rows[1][1], 10);
  const blob = await exportSpreadsheet(workbook); assert.equal((await blob.slice(0, 2).text()), 'PK');
  const roundtrip = await importSpreadsheet(new File([blob], 'roundtrip.xlsx'), 'ar');
  assert.equal(roundtrip.sheets[1].rows[1][0], 'مرحبا');
});

test('untrusted formulas are never executed and formula-like strings are escaped on export', async () => {
  const artifact = await importSpreadsheet(new File(['Name,Value\nA,=1+2'], 'unsafe.csv'), 'en');
  const exported = await exportSpreadsheet(artifact);
  const workbook = XLSX.read(await exported.arrayBuffer(), { type: 'array' });
  const cell = workbook.Sheets[workbook.SheetNames[0]].B2;
  assert.notEqual(cell?.f, '1+2');
  assert.match(String(cell?.v), /^'/);
});

test('charts and bounded analysis use existing sheet data without network calls', async () => {
  const workbook = await importSpreadsheet(workbookFile(), 'ar');
  const sheet = workbook.sheets[0];
  for (const type of ['bar', 'line', 'pie', 'area', 'donut', 'scatter'] as const) {
    const chart = chartFromSheet(workbook, sheet, type);
    assert.ok(isArtifact(chart)); assert.equal(chart.series[0].values[0], 10); assert.equal(chart.direction, 'rtl');
  }
  const context = spreadsheetContext(workbook, sheet);
  assert.match(context, /Rows: 4/); assert.match(context, /Jan\t10/);
  assert.ok(context.length < 12_500);
});

test('presentation preview and PPTX export use the same artifact, including chart and RTL', async () => {
  const workbook = await importSpreadsheet(workbookFile(), 'ar');
  const chart = chartFromSheet(workbook, workbook.sheets[0], 'bar');
  const presentation = presentationFromSheet(workbook, workbook.sheets[0], chart);
  assert.ok(isArtifact(presentation)); assert.equal(presentation.slides.length, 5);
  assert.deepEqual(presentation.slides.map(presentationVariant), ['cover', 'kpi', 'chart', 'table', 'insights']);
  assert.equal(presentation.slides[3].blocks[0].kind, 'table');
  assert.ok(!JSON.stringify(presentation.slides).includes('Jan'));
  assert.ok(!JSON.stringify(presentation.slides).includes('Feb'));
  const html = renderToStaticMarkup(<ArtifactPresentationPreview artifact={presentation} charts={[chart]} onClose={() => undefined} />);
  assert.match(html, /dir="rtl"/); assert.match(html, /شريحة 1 \/ 5/); assert.match(html, /تنزيل PowerPoint/);
  assert.match(html, /data-slide-variant="cover"/);
  const blob = await presentationToPptx(presentation, [chart]);
  assert.equal((await blob.slice(0, 2).text()), 'PK'); assert.ok(blob.size > 1000);
  const archive = await JSZip.loadAsync(await blob.arrayBuffer());
  assert.ok(Object.keys(archive.files).some((path) => /^ppt\/charts\/chart\d+\.xml$/.test(path)));
  assert.equal(Object.keys(archive.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path)).length, 5);
  const coverXml = await archive.file('ppt/slides/slide1.xml')!.async('string');
  assert.match(coverXml, /101214/); // Executive Dark canvas shared by preview and export.
});

test('presentation theme and metrics formatting stay deterministic and compatible with old slides', () => {
  const oldSlide = { id: 'old', layout: 'content' as const, title: 'Metrics', blocks: [{ kind: 'table' as const, rows: [['Metric', 'Value'], ['Revenue', '$1,200']] }] };
  assert.equal(presentationVariant(oldSlide), 'table');
  assert.equal(formatPresentationCell('$1200', 'en'), '$1,200');
  const artifact = { schemaVersion: 1 as const, id: 'old', type: 'presentation' as const, title: 'Old', language: 'en', direction: 'ltr' as const, metadata: {}, slides: [oldSlide] };
  assert.equal(presentationTheme(artifact).canvas, '#101214');
  assert.equal(presentationTheme({ ...artifact, metadata: { presentationTheme: 'executive-light' } }).canvas, '#F6F6F3');
  assert.equal(presentationTheme({ ...artifact, metadata: { presentationTheme: 'unknown' } }).canvas, '#101214');
  const chart = { schemaVersion: 1 as const, id: 'chart', type: 'chart' as const, title: 'Trend', language: 'en', direction: 'ltr' as const, metadata: {}, chartType: 'bar' as const,
    categories: Array.from({ length: 20 }, (_, index) => String(index)), series: [{ name: 'A', values: Array.from({ length: 20 }, (_, index) => index) }] };
  assert.equal(presentationChart(chart).categories.length, 12);
});

test('each executive slide type renders distinct in-chat content without raw worksheet rows', () => {
  const book = { schemaVersion: 1 as const, id: 'sheet', type: 'spreadsheet' as const, title: 'Quarterly review', language: 'en', direction: 'ltr' as const, metadata: {},
    sheets: [{ id: 'sheet-1', name: 'Revenue', columns: ['Month', 'Sales'], rows: [['Month', 'Sales'], ['Jan', 10], ['Feb', 20], ['Mar', 30]] }] };
  const artifact = presentationFromSheet(book, book.sheets[0]);
  for (const slide of artifact.slides) {
    const html = renderToStaticMarkup(<ArtifactPresentationPreview artifact={{ ...artifact, slides: [slide] }} onClose={() => undefined} inline />);
    assert.match(html, new RegExp(`data-slide-variant="${slide.variant}"`));
    assert.doesNotMatch(html, />Jan</);
  }
  const kpi = renderToStaticMarkup(<ArtifactPresentationPreview artifact={{ ...artifact, slides: [artifact.slides[1]] }} onClose={() => undefined} inline />);
  assert.match(kpi, /Key metrics/);
  assert.match(kpi, /Latest/);
  assert.match(kpi, /Average/);
});

test('structured AI presentation is bounded and rejects unsupported blocks', () => {
  const content = '```json\n' + JSON.stringify({ type: 'presentation', title: 'تقرير', slides: [{ title: 'مرحبا VANTRA', layout: 'title', blocks: [{ kind: 'text', text: 'مبيعات' }] }] }) + '\n```';
  const artifact = presentationFromResponse(content, 'ar');
  assert.equal(artifact?.direction, 'rtl'); assert.equal(artifact?.slides[0].blocks[0].kind, 'text');
  assert.equal(presentationFromResponse('{"type":"presentation","slides":[{"title":"x","blocks":[{"kind":"image","src":"javascript:alert(1)"}]}]}', 'en'), null);
  assert.equal(isArtifact({ schemaVersion: 1, id: 'bad', type: 'spreadsheet', title: 'Bad', language: 'en', direction: 'ltr', sheets: [{ id: 's', name: 'Sheet', columns: ['A'], rows: [123] }] }), false);
});

test('deterministic import, chart and PowerPoint export make no network requests', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => { calls++; throw new Error('Unexpected network request'); }) as typeof fetch;
  try {
    const workbook = await importSpreadsheet(workbookFile(), 'en');
    const chart = chartFromSheet(workbook, workbook.sheets[0], 'line');
    const presentation = presentationFromSheet(workbook, workbook.sheets[0], chart);
    await exportSpreadsheet(workbook);
    await presentationToPptx(presentation, [chart]);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});
