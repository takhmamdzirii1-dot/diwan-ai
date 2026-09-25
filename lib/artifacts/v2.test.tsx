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
  assert.ok(isArtifact(presentation)); assert.equal(presentation.slides.length, 3);
  const html = renderToStaticMarkup(<ArtifactPresentationPreview artifact={presentation} charts={[chart]} onClose={() => undefined} />);
  assert.match(html, /dir="rtl"/); assert.match(html, /شريحة 1 \/ 3/); assert.match(html, /تنزيل PowerPoint/);
  const blob = await presentationToPptx(presentation, [chart]);
  assert.equal((await blob.slice(0, 2).text()), 'PK'); assert.ok(blob.size > 1000);
  const archive = await JSZip.loadAsync(await blob.arrayBuffer());
  assert.ok(Object.keys(archive.files).some((path) => /^ppt\/charts\/chart\d+\.xml$/.test(path)));
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
