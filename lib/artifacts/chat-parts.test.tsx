import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chatPartsFromMessage, presentationRequested, streamingSafeText, PRESENTATION_OUTPUT_INSTRUCTION } from './chat-parts';
import { documentFromMarkdown, parsePresentationResponse, PRESENTATION_MODEL_SHAPE, type ChartArtifact, type SpreadsheetArtifact } from './core';
import ArtifactDocumentPreview from '@/src/components/studio/ArtifactDocumentPreview';
import ArtifactSpreadsheetPreview from '@/src/components/studio/ArtifactSpreadsheetPreview';
import ArtifactPresentationPreview from '@/src/components/studio/ArtifactPresentationPreview';
import ArtifactChart from '@/src/components/studio/ArtifactChart';
import MessageBubble from '@/src/components/studio/MessageBubble';
import { IntlProvider } from 'use-intl';
import studioMessages from '@/messages/studio-en.json';

const base = { schemaVersion: 1, id: 'artifact-1', title: 'Quarterly report', language: 'en', direction: 'ltr', metadata: {} } as const;
const presentationJson = JSON.stringify({ type: 'presentation', title: 'Quarterly report', slides: [
  { title: 'Revenue', layout: 'title', blocks: [{ kind: 'text', text: 'Revenue grew.' }] },
] });

test('normal and old text messages remain text; one presentation pipeline handles button and Chat intent', () => {
  assert.equal(presentationRequested('Create a concise presentation from this spreadsheet.'), true);
  assert.equal(presentationRequested('Create a presentation from this spreadsheet'), true);
  assert.equal(presentationRequested('Bonjour'), false);
  assert.deepEqual(chatPartsFromMessage('Hello **VANTRA**', 'en'), [{ type: 'text', text: 'Hello **VANTRA**' }]);
  assert.equal(chatPartsFromMessage('```json\n' + presentationJson + '\n```', 'en')[0].type, 'presentation');
  assert.equal(chatPartsFromMessage(presentationJson, 'en')[0].type, 'presentation');
  assert.equal(streamingSafeText('```json\n' + presentationJson.slice(0, 30)), '');
  assert.equal(streamingSafeText(presentationJson.slice(0, 30)), '');
});

test('the real PresentationArtifact shape and deterministic formatting variations validate', () => {
  const exact = JSON.stringify(PRESENTATION_MODEL_SHAPE);
  const direct = parsePresentationResponse(exact, 'en');
  assert.equal(direct.reason, null);
  assert.equal(direct.artifact?.slides[0].blocks.length, 3);
  assert.match(PRESENTATION_OUTPUT_INSTRUCTION, /schemaVersion/);
  assert.match(PRESENTATION_OUTPUT_INSTRUCTION, /"kind":"bullets"/);

  const fenced = parsePresentationResponse(`Before the deck.\n\x60\x60\x60json\n${exact}\n\x60\x60\x60\nAfter the deck.`, 'en');
  assert.equal(fenced.reason, null);
  assert.deepEqual(fenced.shape, { fenced: true, proseBefore: true, proseAfter: true });

  // Representative LLM formatting: one unfenced JSON object with harmless prose.
  const prose = `Here is your presentation:\n${presentationJson}\nYou can preview it below.`;
  const extracted = parsePresentationResponse(prose, 'en');
  assert.equal(extracted.reason, null);
  assert.deepEqual(extracted.shape, { fenced: false, proseBefore: true, proseAfter: true });
  assert.equal(chatPartsFromMessage(prose, 'en')[0].type, 'presentation');
  assert.equal(parsePresentationResponse(presentationJson, 'en').artifact?.slides[0].id, 'slide-1');
  const kpi = parsePresentationResponse(JSON.stringify({ type: 'presentation', title: 'Summary', slides: [{ title: 'Key metrics', variant: 'kpi', blocks: [{ kind: 'table', rows: [['Revenue', '$1,200']] }] }] }), 'en');
  assert.equal(kpi.artifact?.slides[0].variant, 'kpi');
});

test('presentation failures retain safe internal categories without showing JSON', () => {
  assert.equal(parsePresentationResponse('No JSON here.', 'en').reason, 'presentation_json_not_found');
  assert.equal(parsePresentationResponse('{"type":"presentation","slides":[', 'en').reason, 'presentation_json_parse_failed');
  assert.equal(parsePresentationResponse('{"type":"presentation","slides":[]}', 'en').reason, 'presentation_schema_invalid');
  const badBlock = '{"type":"presentation","slides":[{"title":"Slide","blocks":[{"kind":"video","src":"bad"}]}]}';
  const failed = parsePresentationResponse(badBlock, 'en');
  assert.equal(failed.reason, 'presentation_block_invalid');
  if (failed.artifact !== null) assert.fail('Invalid block must not become an artifact');
  const part = chatPartsFromMessage(badBlock, 'en')[0];
  assert.equal(part.type, 'text');
  if (part.type === 'text') {
    assert.equal(part.failureCategory, 'presentation_block_invalid');
    assert.doesNotMatch(part.text, /"kind"|"slides"|video/);
  }
  assert.equal(streamingSafeText('Here is a deck: {"type":"presentation","slides":['), 'Here is a deck:');
});

test('button and ordinary Chat presentation requests share one zero-repair parser', () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => { calls++; throw new Error('Unexpected AI repair call'); }) as typeof fetch;
  try {
    for (const prompt of ['Create a concise presentation from this spreadsheet.', 'Create a presentation from this spreadsheet']) {
      assert.equal(presentationRequested(prompt), true);
      assert.equal(chatPartsFromMessage(presentationJson, 'en')[0].type, 'presentation');
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('the Chat bubble keeps old Markdown readable and never exposes presentation JSON', () => {
  const renderBubble = (content: string) => renderToStaticMarkup(
    <IntlProvider locale="en" messages={studioMessages}>
      <MessageBubble message={{ id: 'old-message', role: 'assistant', content }} isLatest={false} />
    </IntlProvider>,
  );
  assert.match(renderBubble('Hello **VANTRA**'), /<strong[^>]*>VANTRA<\/strong>/);
  assert.doesNotMatch(renderBubble(presentationJson), /&quot;slides&quot;|"slides"|Revenue grew\./);
});

test('structured spreadsheet, chart, document and presentation render inline with existing previews', () => {
  const sheet: SpreadsheetArtifact = { ...base, type: 'spreadsheet', sheets: [
    { id: 'sheet-1', name: 'Sales', columns: ['Month', 'Sales'], rows: [['Jan', 10]] },
  ] };
  const chart: ChartArtifact = { ...base, type: 'chart', chartType: 'bar', categories: ['Jan'], series: [{ name: 'Sales', values: [10] }] };
  const document = documentFromMarkdown('doc-1', '# Report\n\nA clear summary.', 'en');
  assert.equal(chatPartsFromMessage(JSON.stringify(sheet), 'en')[0].type, 'spreadsheet');
  assert.equal(chatPartsFromMessage(JSON.stringify(chart), 'en')[0].type, 'chart');
  assert.equal(chatPartsFromMessage(JSON.stringify(document), 'en')[0].type, 'document');
  assert.match(renderToStaticMarkup(<ArtifactSpreadsheetPreview initialArtifact={sheet} locale="en" onClose={() => undefined} onAnalyze={() => undefined} inline />), /Jan/);
  assert.match(renderToStaticMarkup(<ArtifactChart artifact={chart} />), /Quarterly report/);
  assert.match(renderToStaticMarkup(<ArtifactDocumentPreview artifact={document} locale="en" onClose={() => undefined} inline />), /A clear summary/);
  const presentation = chatPartsFromMessage(presentationJson, 'en')[0];
  assert.equal(presentation.type, 'presentation');
  if (presentation.type === 'presentation') {
    const html = renderToStaticMarkup(<ArtifactPresentationPreview artifact={presentation.artifact} onClose={() => undefined} inline />);
    assert.match(html, /Revenue grew/);
    assert.match(html, /Download PowerPoint/);
    assert.doesNotMatch(html, /role="dialog"/);
  }
});

test('invalid or unsafe structured output never falls through as copyable raw JSON', () => {
  for (const response of [
    '{"type":"presentation","slides":[{"title":"Bad","blocks":[{"kind":"image","src":"javascript:alert(1)"}]}]}',
    '{"type":"spreadsheet","sheets":[{"rows":[123]}]}',
    '{"type":"image","url":"javascript:alert(1)","name":"Bad"}',
  ]) {
    const parts = chatPartsFromMessage(response, 'en');
    assert.equal(parts[0].type, 'text');
    if (parts[0].type === 'text') assert.doesNotMatch(parts[0].text, /"type"|javascript:/);
  }
  const storedRaw = [{ type: 'text', text: presentationJson }];
  assert.equal(chatPartsFromMessage(presentationJson, 'en', storedRaw)[0].type, 'presentation');
  assert.equal(chatPartsFromMessage('{"type":"image","url":"/api/media/1","name":"Image"}', 'en')[0].type, 'image');
  assert.equal(chatPartsFromMessage('{"type":"video","url":"https://example.com/v.mp4","name":"Video"}', 'en')[0].type, 'video');
  assert.equal(chatPartsFromMessage('{"type":"file","url":"/api/media/2","name":"Report"}', 'en')[0].type, 'file');
});
