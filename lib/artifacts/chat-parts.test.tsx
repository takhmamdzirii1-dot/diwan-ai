import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chatPartsFromMessage, presentationRequested, streamingSafeText } from './chat-parts';
import { documentFromMarkdown, type ChartArtifact, type SpreadsheetArtifact } from './core';
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
