import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChartArtifact, DocumentArtifact, PresentationArtifact, SpreadsheetArtifact } from '@/lib/artifacts/core';
import { attachmentMenuActions, chartFromStructuredRows, guidanceForChatError, guidanceForComposer,
  primaryArtifactActions, presentationFromChart, readableArtifactCopy, readableTableCopy, secondaryArtifactActions } from './contextual-guidance';

const base = { schemaVersion: 1 as const, id: 'a', title: 'Quarterly results', language: 'en', direction: 'ltr' as const, metadata: {} };
const table: DocumentArtifact = { ...base, type: 'document', blocks: [{ kind: 'table', rows: [['Month', 'Sales'], ['Jan', '10'], ['Feb', '20']] }] };
const sheet: SpreadsheetArtifact = { ...base, type: 'spreadsheet', sheets: [{ id: 's', name: 'Sales', columns: ['Month', 'Sales'], rows: [['Jan', 10], ['Feb', 20]] }] };
const chart: ChartArtifact = { ...base, type: 'chart', chartType: 'bar', categories: ['Jan', 'Feb'], series: [{ name: 'Sales', values: [10, 20] }] };
const presentation: PresentationArtifact = { ...base, type: 'presentation', slides: [
  { id: 'cover', layout: 'title', title: 'Quarterly results', blocks: [] },
  { id: 'data', layout: 'content', title: 'Sales', blocks: [{ kind: 'bullets', items: ['Up in February'] }] },
] };
const draft = { text: '', files: [] as Array<{ type: string }>, model: { visionInput: false, fileInput: false, creditCost: 2 },
  balance: 10, balanceStatus: 'ready', locale: 'en' };

test('missing file and wrong model produce task actions while ordinary text stays clean', () => {
  assert.deepEqual(guidanceForComposer({ ...draft, text: 'Analyze this spreadsheet' })?.actions, ['upload_spreadsheet']);
  assert.deepEqual(guidanceForComposer({ ...draft, text: 'Read this image' })?.actions, ['upload_image']);
  assert.deepEqual(guidanceForComposer({ ...draft, files: [{ type: 'image/png' }] })?.actions, ['switch_model']);
  assert.deepEqual(guidanceForComposer({ ...draft, files: [{ type: 'application/pdf' }] })?.actions, ['switch_model']);
  assert.equal(guidanceForComposer({ ...draft, text: 'What is compound interest?' }), null);
  assert.equal(guidanceForComposer({ ...draft, text: 'Explain what a spreadsheet is' }), null);
});

test('plan and credit guidance use supplied state without inventing unknown balances', () => {
  assert.deepEqual(guidanceForComposer({ ...draft, model: { ...draft.model, accessState: 'locked', requiredPlan: 'pro' } })?.actions, ['get_pro']);
  assert.deepEqual(guidanceForComposer({ ...draft, model: { ...draft.model, accessState: 'locked', requiredPlan: 'max' } })?.actions, ['view_plans']);
  assert.deepEqual(guidanceForComposer({ ...draft, balance: 1, requiresCredits: true })?.actions, ['add_credits']);
  assert.equal(guidanceForComposer({ ...draft, balance: 1 }), null); // Chat sends use an allowance, not wallet credits.
  assert.equal(guidanceForComposer({ ...draft, balance: null, balanceStatus: 'unavailable', requiresCredits: true }), null);
  assert.equal(guidanceForComposer({ ...draft, balance: 1, model: { ...draft.model, accessState: 'trial' }, requiresCredits: true }), null);
});

test('artifact actions are bounded and only structured data gets chart actions', () => {
  assert.deepEqual(primaryArtifactActions({ type: 'text', text: 'Compound interest grows over time.' }), []);
  assert.deepEqual(primaryArtifactActions({ type: 'document', artifact: table }), ['copy_table', 'create_chart']);
  assert.deepEqual(primaryArtifactActions({ type: 'spreadsheet', artifact: sheet }), ['analyze', 'create_chart', 'build_presentation']);
  assert.deepEqual(secondaryArtifactActions({ type: 'spreadsheet', artifact: sheet }), ['preview', 'download_xlsx']);
  assert.deepEqual(primaryArtifactActions({ type: 'chart', artifact: chart }), ['download_png', 'use_in_presentation']);
  assert.deepEqual(primaryArtifactActions({ type: 'presentation', artifact: presentation }), ['preview', 'download_pptx']);
  assert.deepEqual(secondaryArtifactActions({ type: 'presentation', artifact: presentation }), ['copy_outline']);
  for (const part of [{ type: 'document', artifact: table }, { type: 'spreadsheet', artifact: sheet },
    { type: 'chart', artifact: chart }, { type: 'presentation', artifact: presentation }] as const) {
    assert.ok(primaryArtifactActions(part).length <= 3);
  }
});

test('copy returns readable data rather than internal artifact JSON', () => {
  assert.equal(readableTableCopy(table), 'Month\tSales\nJan\t10\nFeb\t20');
  for (const part of [{ type: 'document', artifact: table }, { type: 'spreadsheet', artifact: sheet },
    { type: 'chart', artifact: chart }, { type: 'presentation', artifact: presentation }] as const) {
    const copied = readableArtifactCopy(part);
    assert.ok(copied.length > 0);
    assert.doesNotMatch(copied, /schemaVersion|"type"\s*:/);
  }
  assert.match(readableArtifactCopy({ type: 'presentation', artifact: presentation }), /Up in February/);
});

test('selection and local chart/presentation assembly use no AI or network', () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => { calls++; throw new Error('Unexpected network call'); }) as typeof fetch;
  try {
    const created = chartFromStructuredRows('Sales', 'en', 'ltr', sheet.sheets[0].columns, sheet.sheets[0].rows);
    assert.deepEqual(created?.series[0].values, [10, 20]);
    assert.equal(presentationFromChart(created!).slides[1].blocks[0].kind, 'chart');
    primaryArtifactActions({ type: 'spreadsheet', artifact: sheet });
    assert.equal(calls, 0);
  } finally { globalThis.fetch = previousFetch; }
});

test('attachment menu stays simple when the selected model cannot read files', () => {
  assert.deepEqual(attachmentMenuActions(true, true), ['upload_image', 'upload_document', 'upload_spreadsheet']);
  assert.deepEqual(attachmentMenuActions(false, true), ['upload_spreadsheet']);
});

test('technical errors become safe customer guidance', () => {
  assert.deepEqual(guidanceForChatError('{"error":"MODEL_CAPABILITY_UNSUPPORTED","provider":"secret"}', 'en').actions, ['switch_model']);
  assert.deepEqual(guidanceForChatError('{"error":"INSUFFICIENT_CREDITS"}', 'en').actions, ['add_credits']);
  assert.deepEqual(guidanceForChatError('{"error":"FILE_READ_FAILED"}', 'en').actions, ['choose_file']);
  assert.deepEqual(guidanceForChatError('{"error":"MODEL_PLAN_ACCESS_REQUIRED","requiredPlan":"pro"}', 'en').actions, ['get_pro']);
  assert.deepEqual(guidanceForChatError('{"error":"MODEL_PLAN_ACCESS_REQUIRED"}', 'en').actions, ['view_plans']);
  const unknown = guidanceForChatError('{"error":"provider-secret-stack-trace"}', 'en');
  assert.equal(unknown.kind, 'recoverable_error');
  assert.doesNotMatch(unknown.message, /provider|stack|JSON|secret/i);
});
