import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntlProvider } from 'use-intl';
import MessageBubble from '@/src/components/studio/MessageBubble';
import studioMessages from '@/messages/studio-en.json';
import { messageDirection, webSourcesAnnotation, legacyWebSources, separateCitations, withCitationMetadata, sourceSiteName, type WebSourcesAnnotation } from './web-sources';
import { vantraCoreSystemPrompt, webEvidenceInstruction } from './system-prompt';
import { ChatStreamFinalizer, consumeCanonicalChatStream } from './client-finalization';

const sources: WebSourcesAnnotation = { type: 'vantra-web-sources', state: 'read', readCount: 2,
  sources: Array.from({ length: 7 }, (_, index) => ({ id: `S${index + 1}`, title: `Official source ${index + 1}`,
    url: `https://source${index + 1}.example/current` })) };
const render = (content: string, annotation: WebSourcesAnnotation | null = sources) => renderToStaticMarkup(
  <IntlProvider locale="en" messages={studioMessages} timeZone="UTC">
    <MessageBubble message={{ id: 'fixture', role: 'assistant', content, createdAt: new Date('2026-10-01T09:30:00Z'),
      annotations: annotation ? [annotation] : [] }} isLatest onRegenerate={() => {}} />
  </IntlProvider>);

test('UTC clock is refreshed per request; search style/source rules are explicit', () => {
  for (const date of ['2026-10-01T23:59:00Z', '2026-10-02T00:01:00Z']) {
    const prompt = vantraCoreSystemPrompt({ language: 'ar', now: new Date(date) });
    assert.match(prompt, new RegExp(new Date(date).toISOString().replace(/[.]/g, '\\.')));
    assert.match(prompt, /Never write a calendar date after today/); assert.match(prompt, /no emoji/i);
    assert.match(prompt, /as of <time> UTC/);
  }
  assert.match(webEvidenceInstruction(false, true), /forums.*only.*community opinion/);
  assert.match(webEvidenceInstruction(false, true), /rumors and leaks explicitly/);
});

test('message direction is dominant and independent of a Latin-first list item or citation label', () => {
  const ar = 'هذا شرح باللغة العربية لأحدث الأسعار والمعلومات المطلوبة.\n1. Node.js التفاصيل العربية $42 و~5%';
  assert.equal(messageDirection(ar), 'rtl'); assert.equal(messageDirection('English answer explaining a value.'), 'ltr');
  const html = render(ar + ' [Official](https://source1.example/current)');
  assert.match(html, /dir="rtl" class="w-full max-w-4xl/);
  assert.doesNotMatch(html, /<li dir="auto"/);
  assert.match(html, /<bdi dir="ltr">\$42<\/bdi>/); assert.match(html, /<bdi dir="ltr">~5%<\/bdi>/);
});

test('citations become visual-only block bubbles and a collapsed referenced-source control', () => {
  const html = render('Answer first. [Long official source title](https://source1.example/current)');
  assert.match(html, /data-source-bubble=""/); assert.match(html, /data-label="source1"/);
  assert.match(html, /data-label="1 Sources"/); assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /chat-source-chip|chat-source-row|<sup|Read .*sources/);
  assert.doesNotMatch(render('Static text.', null), /data-source-bubble/);
});

test('clean message text persists citation offsets and can reconstruct render-only references', () => {
  const original = 'A supported claim. [[source:S1]]\n\nAnother claim. [2]';
  const separated = separateCitations(original, sources.sources);
  assert.doesNotMatch(separated.text, /source:|\[2\]/);
  const annotation = { ...sources, citations: separated.citations };
  const html = render(separated.text, annotation);
  assert.match(html, /data-label="source1"/); assert.match(html, /data-label="source2"/);
  assert.match(withCitationMetadata(separated.text, annotation), /source:S1/);
  assert.equal(sourceSiteName('https://blog.parfumdo.com/article'), 'parfumdo');
  assert.equal(sourceSiteName('https://fr.example.co.uk/article'), 'example');
  assert.equal(separateCitations('`array[1]`', sources.sources).text, '`array[1]`');
});

test('headings and colon lead-ins have no bubbles; differing sentence sources keep their own blocks', () => {
  const html = render('# Heading [1]\n\nIntroduction: [1]\n\nFirst claim. [1] Second claim. [2]');
  assert.doesNotMatch(html.match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? '', /data-source-bubble/);
  assert.doesNotMatch(html.match(/<p[^>]*>Introduction:[\s\S]*?<\/p>/)?.[0] ?? '', /data-source-bubble/);
  assert.match(html, /First <span class="chat-source-tail"><bdi dir="auto">claim\./);
  assert.match(html, /Second <span class="chat-source-tail"><bdi dir="auto">claim\./);
});

test('list items with the same source share one last-item bubble; distinct sources stay per item', () => {
  const shared = render('- First. [1]\n- Second. [1]');
  assert.equal((shared.match(/data-label="source1"/gu) ?? []).length, 1);
  const distinct = render('- First. [1]\n- Second. [2]');
  assert.equal((distinct.match(/data-label="source[12]"/gu) ?? []).length, 2);
});

test('shared table citations render below the table; distinct row citations stay with their row', () => {
  const shared = render('| Metric | Value |\n| --- | --- |\n| A | 10 [1] |\n| B | 20 [1] |');
  assert.doesNotMatch(shared.match(/<table[\s\S]*?<\/table>/)?.[0] ?? '', /data-source-bubble/);
  assert.match(shared, /<\/table>[\s\S]*data-label="source1"/);
  const distinct = render('| Metric | Value |\n| --- | --- |\n| A | 10 [1] |\n| B | 20 [2] |');
  const rows = distinct.match(/<tr[\s\S]*?<\/tr>/gu) ?? [];
  assert.match(rows[1], /data-label="source1"/); assert.doesNotMatch(rows[1], /data-label="source2"/);
  assert.match(rows[2], /data-label="source2"/);
});

test('citation before sentence punctuation closes its own block, including nested emphasis', () => {
  const html = render('First **important claim [1]**. Second supported claim [2].');
  assert.match(html, /<bdi dir="auto"><strong[^>]*>claim <\/strong>\./);
  const blocks = html.match(/<p[\s\S]*?<\/p>/gu) ?? [];
  assert.match(blocks[0], /data-label="source1"/); assert.doesNotMatch(blocks[0], /data-label="source2"/);
  assert.match(blocks[1], /data-label="source2"/);
});

test('search in progress shows only searching, never pending provider content or source bubbles', () => {
  const html = renderToStaticMarkup(<IntlProvider locale="en" messages={studioMessages} timeZone="UTC">
    <MessageBubble message={{ id: 'pending', role: 'assistant', content: 'Identify Intent. Tool Usage. Let us search.',
      annotations: [sources] }} isLatest isStreaming isThinking />
  </IntlProvider>);
  assert.match(html, /Searching…/); assert.doesNotMatch(html, /Identify Intent|Tool Usage|Let us search|data-source-bubble/);
});

test('source metadata rejects secrets/unsafe URLs and supports old saved search messages', () => {
  assert.equal(webSourcesAnnotation([{ ...sources, sources: [{ id: 'S1', title: 'bad', url: 'javascript:alert(1)' }] }]), null);
  assert.equal(webSourcesAnnotation([{ ...sources, sources: [{ id: 'S1', title: 'bad', url: 'https://site.example/?token=private' }] }]), null);
  assert.equal(legacyWebSources([], '[Source](https://source1.example/current)'), null);
  assert.equal(legacyWebSources([{ type: 'vantra-search-context', executionId: 'f5995848-c40b-4df5-a433-5585c6da8004' }],
    '[Source](https://source1.example/current)')?.sources.length, 1);
});

test('canonical finalization and history preserve source UI metadata without altering terminal status', async () => {
  let committed: { annotations?: unknown[] } | undefined;
  const finalizer = new ChatStreamFinalizer('fixture', (value) => { committed = value; });
  const stream = new Response(`8:${JSON.stringify([sources])}\n0:"Answer"\nd:{"finishReason":"stop"}\n`).body!;
  const status = await consumeCanonicalChatStream(stream, (text) => finalizer.append(text), undefined,
    undefined, undefined, undefined, undefined, (annotation) => finalizer.setWebSources(annotation));
  finalizer.consumerDone(); finalizer.rawDone(status);
  assert.equal(status, 'completed'); assert.deepEqual(webSourcesAnnotation(committed?.annotations), sources);
});
