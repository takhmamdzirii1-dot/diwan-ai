import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatStreamPart, parseComplexResponse } from '@ai-sdk/ui-utils';
import { IntlProvider } from 'use-intl';
import studioMessages from '@/messages/studio-en.json';
import MessageBubble from '@/src/components/studio/MessageBubble';
import ArtifactSpreadsheetPreview from '@/src/components/studio/ArtifactSpreadsheetPreview';
import { chatPartsFromMessage, streamingSafeText } from '@/lib/artifacts/chat-parts';
import { runArtifactTool } from '@/lib/artifacts/tool-registry';
import { chatRequestMessages, providerChatMessages, serializeChatSession } from './message-history';

test('full multi-turn history survives request construction and session reload in order', () => {
  const history = [
    { role: 'user', content: [{ type: 'text', text: 'ALPHA ' }, { type: 'text', text: 'FIRST MESSAGE COMPLETE' }] },
    { role: 'assistant', content: 'Acknowledged.' },
    { role: 'user', content: 'Remember this second item: BETA' },
    { role: 'assistant', content: 'Acknowledged.' },
    { role: 'user', content: 'What was my first message?' },
  ];
  const outgoing = chatRequestMessages(history);
  assert.deepEqual(outgoing.map(({ role, content }) => [role, content]), [
    ['user', 'ALPHA FIRST MESSAGE COMPLETE'], ['assistant', 'Acknowledged.'],
    ['user', 'Remember this second item: BETA'], ['assistant', 'Acknowledged.'],
    ['user', 'What was my first message?'],
  ]);
  const parsed = providerChatMessages([{ role: 'system', content: 'System.' },
    ...outgoing.map((message) => ({ ...message, vantraParts: [{ type: 'text', text: 'UI only' }] }))]);
  assert.deepEqual(parsed.map(({ role, content }) => [role, content]), [
    ['system', 'System.'], ...outgoing.map(({ role, content }) => [role, content]),
  ]);
  assert.ok(parsed.every((message) => !('vantraParts' in message)));
  const reloaded = JSON.parse(serializeChatSession(outgoing, (message) =>
    chatPartsFromMessage(String(message.content), 'en')));
  assert.deepEqual(chatRequestMessages(reloaded), outgoing);
  assert.equal(reloaded[0].content, 'ALPHA FIRST MESSAGE COMPLETE');
  assert.equal(chatRequestMessages([{ role: 'user', content: '', parts: [
    { type: 'text', text: 'ALPHA ' }, { type: 'text', text: 'FIRST MESSAGE COMPLETE' },
  ] }])[0].content, 'ALPHA FIRST MESSAGE COMPLETE');
  const longSession = Array.from({ length: 60 }, (_, index) => ({ role: 'user', content: `Turn ${index}` }));
  assert.equal(JSON.parse(serializeChatSession(longSession, () => [])).length, 60);
  assert.equal(JSON.parse(serializeChatSession(longSession, () => []))[0].content, 'Turn 0');
});

async function streamedMessage(deltas: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const delta of deltas) controller.enqueue(encoder.encode(formatStreamPart('text', delta)));
      controller.close();
    },
  });
  const updates: string[] = [];
  const result = await parseComplexResponse({
    reader: stream.getReader(),
    generateId: () => 'assistant-1',
    update: (merged) => updates.push(merged.at(-1)?.content ?? ''),
  });
  return { text: result.messages[0]?.content, updates };
}

test('AI SDK stream appends every delta and final Chat text contains the complete answer', async () => {
  const result = await streamedMessage(['Your first ', 'message was: ', '"What is ', 'compound interest?"']);
  assert.deepEqual(result.updates, ['Your first ', 'Your first message was: ',
    'Your first message was: "What is ', 'Your first message was: "What is compound interest?"']);
  assert.equal(result.text, 'Your first message was: "What is compound interest?"');
  assert.deepEqual(chatPartsFromMessage(result.text!, 'en'), [{ type: 'text', text: result.text }]);
  const html = renderToStaticMarkup(<IntlProvider locale="en" messages={studioMessages}>
    <MessageBubble message={{ id: 'assistant-1', role: 'assistant', content: result.text! }} isLatest={false} />
  </IntlProvider>);
  assert.match(html, /Your first message was: &quot;What is compound interest\?&quot;/);
});

test('Markdown split across deltas remains complete and ordinary prose is never hidden', async () => {
  const result = await streamedMessage(['**"What is ', 'compound interest?', '"**']);
  assert.equal(result.text, '**"What is compound interest?"**');
  assert.equal(streamingSafeText(result.text!), result.text);
  assert.equal(streamingSafeText('Use {compound interest} in this example.'), 'Use {compound interest} in this example.');
  assert.equal(streamingSafeText('This Markdown includes ```ts\nconst x = { value: 1 };\n```'),
    'This Markdown includes ```ts\nconst x = { value: 1 };\n```');
});

test('text and presentation parts retain their order and normal artifacts still render', () => {
  const presentation = runArtifactTool('create_presentation', {
    title: 'Complete deck', slides: [{ title: 'Overview', variant: 'cover', blocks: [] }],
  });
  assert.equal(presentation.status, 'ok');
  if (presentation.status !== 'ok') return;
  const stored = [
    { type: 'text', text: 'Before the deck. ' },
    { type: 'presentation', artifact: presentation.artifact },
    { type: 'text', text: ' After the deck.' },
  ];
  const parts = chatPartsFromMessage('Before the deck.  After the deck.', 'en', stored);
  assert.deepEqual(parts.map((part) => part.type), ['text', 'presentation', 'text']);
  const html = renderToStaticMarkup(<IntlProvider locale="en" messages={studioMessages}>
    <MessageBubble message={{ id: 'mixed', role: 'assistant', content: 'Before the deck.  After the deck.', vantraParts: stored } as any} isLatest={false} />
  </IntlProvider>);
  const before = html.indexOf('Before the deck.');
  const after = html.indexOf('After the deck.');
  assert.ok(before >= 0 && after > before);
});

test('plain answers expose no chart action, while a real chartable spreadsheet keeps its chart control', () => {
  const plain = renderToStaticMarkup(<IntlProvider locale="en" messages={studioMessages}>
    <MessageBubble message={{ id: 'plain', role: 'assistant', content: 'Compound interest grows over time.' }} isLatest={false} />
  </IntlProvider>);
  assert.doesNotMatch(plain, /Create (?:a )?chart/i);
  const sheet = runArtifactTool('create_spreadsheet', {
    title: 'Rates', sheets: [{ name: 'Rates', columns: ['Year', 'Amount'], rows: [['Year', 'Amount'], ['2026', 10]] }],
  });
  assert.equal(sheet.status, 'ok');
  if (sheet.status !== 'ok' || sheet.artifact.type !== 'spreadsheet') return;
  const withTable = renderToStaticMarkup(<ArtifactSpreadsheetPreview
    initialArtifact={sheet.artifact} locale="en" onClose={() => undefined} onAnalyze={() => undefined} />);
  assert.match(withTable, /Create chart/);
});
