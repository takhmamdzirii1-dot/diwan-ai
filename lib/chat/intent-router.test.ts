import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeIntentText, routeChatIntent, type IntentResource } from './intent-router';
import { requiredArtifactToolChoice, selectArtifactTools } from '@/lib/artifacts/tool-registry';

test('explicit artifact and export requests converge across English, French, Arabic, and typos', () => {
  const cases = [
    ['make a chart', 'create_chart', 'create_chart'], ['mak a charte', 'create_chart', 'create_chart'],
    ['crée un graphique', 'create_chart', 'create_chart'], ['donne moi un graphe', 'create_chart', 'create_chart'],
    ['اعمل لي مخطط', 'create_chart', 'create_chart'], ['عطيني شارت', 'create_chart', 'create_chart'],
    ['اريد اشوف الرسم', 'create_chart', 'create_chart'],
    ['make a presentation', 'create_presentation', 'create_presentation'],
    ['make ppt', 'create_presentation', 'create_presentation'],
    ['présentation', 'create_presentation', 'create_presentation'],
    ['powerpoint', 'create_presentation', 'create_presentation'],
    ['بوربوينت', 'create_presentation', 'create_presentation'],
    ['عرض تقديمي', 'create_presentation', 'create_presentation'],
    ['بريزنتيشن', 'create_presentation', 'create_presentation'],
    ['make a pdf report', 'export_pdf', 'create_document'],
    ['rapport pdf', 'export_pdf', 'create_document'], ['تقرير pdf', 'export_pdf', 'create_document'],
    ['اكتبلي طلب بصيغة pdf', 'export_pdf', 'create_document'],
    ['Écris-moi un rapport', 'create_document', 'create_document'],
    ['اكتب لي تقرير', 'create_document', 'create_document'],
    ['make an Excel spreadsheet', 'export_xlsx', 'create_spreadsheet'],
    ['export this as CSV', 'export_csv', 'create_spreadsheet'],
    ['write this as Word', 'export_docx', 'create_document'],
  ] as const;
  for (const [input, intent, tool] of cases) {
    assert.equal(routeChatIntent(input).intent, intent, input);
    const selection = selectArtifactTools(input);
    assert.deepEqual(selection.names, [tool], input);
    assert.deepEqual(requiredArtifactToolChoice(selection, 'native'), { type: 'tool', toolName: tool });
  }
});

test('normalization and question semantics protect ordinary Chat', () => {
  assert.equal(normalizeIntentText('  CRÉE   un   GRAPHIQUE '), 'cree un graphique');
  assert.equal(normalizeIntentText('أُرِيدُ مَخْطَطـًا'), 'اريد مخططا');
  for (const input of ['What is a chart?', 'Explain PowerPoint', 'ماهو PDF؟',
    'Qu’est-ce qu’un graphique ?', 'How do I make a chart?', 'I like charts']) {
    assert.equal(routeChatIntent(input).intent, 'normal_chat', input);
    assert.deepEqual(selectArtifactTools(input).names, [], input);
  }
  assert.equal(routeChatIntent('maybe something visual').confidence, 'low');
});

test('resource references resolve stable IDs, request selection, or file guidance', () => {
  const sheet: IntentResource = { attachmentId: 'sheet-1', kind: 'spreadsheet' };
  const other: IntentResource = { attachmentId: 'sheet-2', kind: 'spreadsheet' };
  for (const input of ['make a chart from the spreadsheet', 'crée un graphique depuis ce fichier',
    'اعمل لي مخطط من هذا الملف']) {
    assert.deepEqual(routeChatIntent(input, [sheet]).attachmentId, 'sheet-1', input);
    assert.equal(routeChatIntent(input, []).resourceStatus, 'missing', input);
    assert.equal(routeChatIntent(input, [sheet, other]).resourceStatus, 'ambiguous', input);
    assert.equal(routeChatIntent(input, [sheet, other], 'sheet-2').attachmentId, 'sheet-2', input);
  }
});
