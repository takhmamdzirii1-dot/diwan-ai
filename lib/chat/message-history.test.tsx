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
import { canRegenerateAssistantMessage, chatRequestMessages, formatChatTimestamp, providerChatMessages, serializeChatSession } from './message-history';
import { attachConversationFile, sentMessageAttachments } from './conversation-attachments';

test('timestamps survive session serialization with compact local day labels', () => {
  const now = new Date('2026-09-27T22:00:00');
  const sent = new Date('2026-09-27T21:43:00');
  const saved = JSON.parse(serializeChatSession([{ role: 'user', content: 'Hello', createdAt: sent }], () => []));
  assert.equal(formatChatTimestamp(saved[0].createdAt, 'en', now), '21:43');
  assert.match(formatChatTimestamp(new Date('2026-09-26T21:43:00'), 'en', now) ?? '', /^Yesterday, 21:43$/);
  assert.doesNotMatch(formatChatTimestamp(new Date('2026-09-20T21:43:00'), 'en', now) ?? '', /:00$/);
});

test('generic regenerate is only for plain assistant text, never artifact or Agent results', () => {
  const text = { role: 'assistant', content: 'A complete answer.' };
  assert.equal(canRegenerateAssistantMessage(text), true);
  for (const type of ['chart', 'presentation', 'document', 'spreadsheet', 'file']) {
    assert.equal(canRegenerateAssistantMessage({ ...text, vantraParts: [{ type, artifact: { id: 'x' } }] }), false);
  }
  assert.equal(canRegenerateAssistantMessage(text, true), false);
  assert.equal(canRegenerateAssistantMessage({ ...text, vantraFailureKind: 'chart' }), false);
});

test('sent user file card and compact message timestamps render without raw resource data', () => {
  const artifact = runArtifactTool('create_spreadsheet', { title: 'Products',
    sheets: [{ name: 'Products', columns: ['Product', 'Price'], rows: [['A', 12]] }] });
  assert.equal(artifact.status, 'ok');
  if (artifact.status !== 'ok' || artifact.artifact.type !== 'spreadsheet') return;
  const attached = attachConversationFile([], { kind: 'spreadsheet', name: 'Products.xlsx', artifact: artifact.artifact }, 'chat-a');
  const sent = { id: 'user-1', role: 'user' as const, content: 'Analyze this file.',
    createdAt: new Date(), vantraAttachmentIds: [attached[0].attachmentId] };
  const restored = JSON.parse(serializeChatSession([sent], () => []))[0];
  const html = renderToStaticMarkup(<IntlProvider locale="en" messages={studioMessages}>
    <MessageBubble message={restored} isLatest={false}
      sentAttachments={sentMessageAttachments({ 'chat-a': attached }, 'chat-a', restored.vantraAttachmentIds)} />
  </IntlProvider>);
  assert.match(html, /Analyze this file\./);
  assert.match(html, /Products\.xlsx/);
  assert.match(html, /data-sent-attachments/);
  assert.ok(html.indexOf('Analyze this file.') < html.indexOf('Products.xlsx'));
  assert.match(html, /<time/);
  assert.doesNotMatch(html, /schemaVersion|vantraAttachmentIds/);
});

test('Arabic changes content direction without moving message chrome or timestamps', () => {
  const render = (role: 'user' | 'assistant', content: string) => renderToStaticMarkup(
    <IntlProvider locale="en" messages={studioMessages}>
      <MessageBubble message={{ id: `${role}-direction`, role, content, createdAt: new Date() }} isLatest={false} />
    </IntlProvider>);
  const arabic = 'السعر 1992 USD للمنتج';
  const englishAssistant = render('assistant', 'Price 1992 USD for the product');
  const arabicAssistant = render('assistant', arabic);
  const englishUser = render('user', 'Price 1992 USD for the product');
  const arabicUser = render('user', arabic);
  for (const html of [englishAssistant, arabicAssistant, englishUser, arabicUser]) {
    assert.match(html, /dir="ltr"[^>]*class="group relative flex flex-col/);
    assert.match(html, /<time\b/);
  }
  for (const html of [englishAssistant, arabicAssistant]) {
    assert.match(html, /dir="ltr" class="flex items-center gap-2\.5 w-full justify-start"/);
    assert.match(html, /dir="ltr" class="w-full max-w-4xl/);
    assert.match(html, /class="mt-2 flex items-center gap-0\.5/);
  }
  for (const html of [englishUser, arabicUser]) {
    assert.match(html, /class="ms-auto flex w-fit max-w-\[88%\][^"\n]*" dir="ltr"/);
    assert.match(html, /class="self-end text-\[9px\] leading-none/);
  }
  assert.match(arabicAssistant, /data-chat-rendered-text="" dir="rtl"/);
  assert.match(englishAssistant, /data-chat-rendered-text="" dir="ltr"/);
  assert.match(arabicUser, /<p dir="rtl"/);
  assert.match(englishUser, /<p dir="ltr"/);
  assert.match(arabicAssistant, /السعر 1992 USD للمنتج/);
  assert.match(arabicUser, /السعر 1992 USD للمنتج/);
});

test('short user messages keep a compact, non-overlapping timestamp in both directions', () => {
  const render = (content: string) => renderToStaticMarkup(<IntlProvider locale="en" messages={studioMessages}>
    <MessageBubble message={{ id: content, role: 'user', content, createdAt: new Date() }} isLatest={false} />
  </IntlProvider>);
  const english = render('Hi');
  const arabic = render('مرحبا');
  const long = render('A longer message that wraps naturally. '.repeat(20));
  const bubbleClass = (html: string) => /<div class="(ms-auto flex w-fit[^"\n]+)" dir="ltr"/.exec(html)?.[1] ?? '';
  assert.equal(bubbleClass(english), bubbleClass(arabic));
  assert.equal(bubbleClass(english), bubbleClass(long));
  assert.match(bubbleClass(english), /\bgap-1\b/);
  assert.match(bubbleClass(english), /\bpt-2\.5 pb-1\.5\b/);
  assert.doesNotMatch(bubbleClass(english), /\bmin-h-|\babsolute\b/);
  for (const html of [english, arabic, long]) {
    assert.match(html, /<\/p><time\b[^>]*class="self-end text-\[9px\] leading-none/);
    assert.doesNotMatch(html, /<time\b[^>]*class="[^"]*absolute/);
  }
  assert.match(arabic, /<p dir="rtl"/);
  assert.match(english, /<p dir="ltr"/);
});

test('successful artifacts omit generic retry while plain assistant text keeps it', () => {
  const chart = runArtifactTool('create_chart', { title: 'Sales', chartType: 'bar',
    categories: ['Jan'], series: [{ name: 'Sales', values: [12] }] });
  assert.equal(chart.status, 'ok');
  if (chart.status !== 'ok') return;
  const render = (message: any) => renderToStaticMarkup(<IntlProvider locale="en" messages={studioMessages}>
    <MessageBubble message={message} isLatest onRegenerate={() => undefined} />
  </IntlProvider>);
  assert.doesNotMatch(render({ id: 'chart-1', role: 'assistant', content: '',
    createdAt: new Date(), vantraParts: [{ type: 'chart', artifact: chart.artifact }] }), /Retry response/i);
  assert.match(render({ id: 'text-1', role: 'assistant', content: 'A normal answer.',
    createdAt: new Date() }), /Retry response/i);
  const failedChart = renderToStaticMarkup(<IntlProvider locale="en" messages={studioMessages}>
    <MessageBubble message={{ id: 'chart-failed', role: 'assistant', content: 'Choose clear columns.',
      vantraFailureKind: 'chart', createdAt: new Date() } as any} isLatest onRegenerate={() => undefined}
      onRetryArtifact={() => undefined} />
  </IntlProvider>);
  assert.match(failedChart, /Try chart again/);
  assert.doesNotMatch(failedChart, /Retry response/i);
});

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
