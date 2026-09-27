import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ChartArtifact, DocumentArtifact, PresentationArtifact, SpreadsheetArtifact } from '@/lib/artifacts/core';
import ArtifactSmartCard from './ArtifactSmartCard';

const base = { schemaVersion: 1 as const, id: 'a', title: 'Results', language: 'en', direction: 'ltr' as const, metadata: {} };
const table: DocumentArtifact = { ...base, metadata: { artifactKind: 'table' }, type: 'document', blocks: [{ kind: 'table', rows: [['Month', 'Sales'], ['Jan', '10']] }] };
const spreadsheet: SpreadsheetArtifact = { ...base, type: 'spreadsheet', sheets: [{ id: 's', name: 'Sales', columns: ['Month', 'Sales'], rows: [['Jan', 10]] }] };
const chart: ChartArtifact = { ...base, type: 'chart', chartType: 'bar', categories: ['Jan'], series: [{ name: 'Sales', values: [10] }] };
const presentation: PresentationArtifact = { ...base, type: 'presentation', slides: [{ id: 'cover', layout: 'title', title: 'Results', blocks: [] }] };

test('validated artifact cards render customer actions without internal names or more than three primary buttons', () => {
  const cases = [
    [{ type: 'document' as const, artifact: table }, ['Copy table', 'Create chart']],
    [{ type: 'spreadsheet' as const, artifact: spreadsheet }, ['Analyze', 'Create chart', 'Build presentation']],
    [{ type: 'chart' as const, artifact: chart }, ['Download PNG', 'Use in presentation']],
    [{ type: 'presentation' as const, artifact: presentation }, ['Preview', 'Download PPTX']],
  ] as const;
  for (const [part, labels] of cases) {
    const html = renderToStaticMarkup(<ArtifactSmartCard part={part} locale="en" timestamp="21:43" />);
    for (const label of labels) assert.match(html, new RegExp(label));
    assert.doesNotMatch(html, /schemaVersion|create_spreadsheet|tool calling|provider ID/i);
    const primary = html.split('<details')[0].match(/<button\b/g) ?? [];
    assert.ok(primary.length <= 3);
    assert.match(html, /<time[^>]*>21:43<\/time>/);
    assert.doesNotMatch(html, /Retry response/);
  }
});

test('Arabic artifact content keeps the action footer in the same physical layout', () => {
  const arabic = { ...chart, title: 'السعر 1992 USD', direction: 'rtl' as const };
  const html = renderToStaticMarkup(<ArtifactSmartCard part={{ type: 'chart', artifact: arabic }}
    locale="ar" timestamp="21:43" />);
  assert.match(html, /<section data-testid="artifact-chart" class="w-full space-y-2" dir="ltr"/);
  assert.match(html, /السعر 1992 USD/);
  assert.match(html, /<time class="ms-auto[^"\n]*">21:43<\/time>/);
});
