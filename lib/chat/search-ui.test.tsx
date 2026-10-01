import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntlProvider } from 'use-intl';
import MessageBubble from '@/src/components/studio/MessageBubble';
import studioMessages from '@/messages/studio-en.json';
import { messageDirection, webSourcesAnnotation, legacyWebSources, type WebSourcesAnnotation } from './web-sources';
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

test('search citations are badges; footer is collapsed with five rows and show more', () => {
  const html = render('Answer first. [Long official source title](https://source1.example/current)');
  assert.match(html, /<sup class="chat-citation"/); assert.match(html, /chat-source-chips/);
  assert.match(html, /Read <bdi>2<\/bdi> sources/); assert.match(html, /<details class="chat-source-footer">/);
  assert.equal((html.match(/class="chat-source-row"/g) ?? []).length, 5);
  assert.match(html, /Show <bdi>2<\/bdi> more/); assert.doesNotMatch(html, /<details[^>]+open/);
  assert.doesNotMatch(render('Static text.', null), /chat-source-footer|chat-citation/);
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
