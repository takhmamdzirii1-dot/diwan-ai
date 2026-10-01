import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { streamText } from 'ai';
import type { LanguageModelV1, LanguageModelV1StreamPart } from '@ai-sdk/provider';
import { z } from 'zod';
import { documentAfterResearch } from './document-step';
import { assessChatCompletion, emptyToolLifecycle, validatedExpectedActionPart } from './action-completion';
import { getArtifactTool } from '@/lib/artifacts/tool-registry';
import { documentFromMarkdown } from '@/lib/artifacts/core';
import { cleanCopyText, copyPayload } from './copy-content';
import { citationMarkdown, sourceDomain, type ChatWebSource } from './web-sources';
import { vantraCoreSystemPrompt, webEvidenceInstruction } from './system-prompt';
import ArtifactDocumentPreview from '@/src/components/studio/ArtifactDocumentPreview';
import ChatSources from '@/src/components/studio/ChatSources';

const sources: ChatWebSource[] = [{ id: 'S1', title: 'Official account', url: 'https://example.com/article', sourceClass: 'primary' }];
const markdown = '# بيتكوين\n\nمقال مرتب حول بيتكوين مع شرح مدعوم **للقارئ [[source:S1]]**.\n\n1. Node.js مع نص عربي [1]\n2. معلومات مدعومة.';

async function researchThenDocument(wrap: boolean) {
  const choices: unknown[] = [];
  const model: LanguageModelV1 = { specificationVersion: 'v1', provider: 'deterministic-fixture', modelId: 'fixture',
    defaultObjectGenerationMode: 'json', doGenerate: async () => { throw new Error('UNUSED'); },
    doStream: async (params) => {
      if (params.mode.type !== 'regular') throw new Error('UNEXPECTED_MODE');
      choices.push(params.mode.toolChoice);
      const step = choices.length;
      const documentRequired = params.mode.toolChoice?.type === 'tool' && params.mode.toolChoice.toolName === 'create_document';
      const parts: LanguageModelV1StreamPart[] = step === 1
        ? [{ type: 'tool-call', toolCallType: 'function', toolCallId: 'search-1', toolName: 'web_search', args: '{"query":"Bitcoin"}' }]
        : documentRequired ? [{ type: 'tool-call', toolCallType: 'function', toolCallId: 'doc-1', toolName: 'create_document',
          args: JSON.stringify({ title: 'بيتكوين', markdown, language: 'ar' }) }]
        : [{ type: 'text-delta', textDelta: 'Research completed.' }];
      parts.push({ type: 'finish', finishReason: parts[0].type === 'tool-call' ? 'tool-calls' : 'stop',
        usage: { promptTokens: 10, completionTokens: 10 } });
      return { stream: new ReadableStream({ start(controller) { parts.forEach((part) => controller.enqueue(part)); controller.close(); } }),
        rawCall: { rawPrompt: null, rawSettings: {} } };
    } };
  const definition = getArtifactTool('create_document')!;
  if (!('execute' in definition)) throw new Error('DOCUMENT_TOOL_REQUIRED');
  const result = await streamText({ model: wrap ? documentAfterResearch(model) : model, prompt: 'اعطيني مقال مرتب حول بيتكوين',
    maxSteps: 5, maxRetries: 0, toolChoice: 'auto', tools: {
      web_search: { parameters: z.object({ query: z.string() }), execute: async () => ({ evidence: sources }) },
      create_document: { parameters: definition.inputSchema, execute: async (input) => ({ status: 'ok', artifact: definition.execute(input as never) }) },
    } });
  const results: { toolCallId: string; toolName: string; result: unknown }[] = [];
  for await (const event of result.fullStream) if (event.type === 'tool-result') results.push(event);
  const part = validatedExpectedActionPart('create_document', 'native', await result.text, results,
    new Set(results.map((entry) => entry.toolCallId)));
  return { choices, part, completion: assessChatCompletion({ expectedAction: 'create_document', finishReason: await result.finishReason,
    outputStarted: true, expectedResultValid: Boolean(part), lifecycle: emptyToolLifecycle() }) };
}

test('production-shaped research -> stop fails; research -> required document produces the validated stored artifact', async () => {
  const before = await researchThenDocument(false);
  assert.equal(before.completion.failureCategory, 'expected_artifact_missing');
  const after = await researchThenDocument(true);
  assert.deepEqual(after.choices, [{ type: 'auto' }, { type: 'tool', toolName: 'create_document' }, { type: 'none' }]);
  assert.equal(after.part?.type, 'document');
  assert.equal(after.completion.completed, true);
});

test('server pre-search requires document immediately, old conversation tool results do not', async () => {
  const choices: unknown[] = [];
  const model: LanguageModelV1 = { specificationVersion: 'v1', provider: 'fixture', modelId: 'fixture', defaultObjectGenerationMode: 'json',
    doGenerate: async () => { throw new Error('UNUSED'); }, doStream: async (params) => {
      if (params.mode.type === 'regular') choices.push(params.mode.toolChoice);
      return { stream: new ReadableStream({ start(c) { c.close(); } }), rawCall: { rawPrompt: null, rawSettings: {} } };
    } };
  const options = { inputFormat: 'messages' as const, mode: { type: 'regular' as const, toolChoice: { type: 'auto' as const } },
    prompt: [{ role: 'tool' as const, content: [{ type: 'tool-result' as const, toolCallId: 'old', toolName: 'create_document', result: {} }] },
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'New article' }] }] };
  await documentAfterResearch(model).doStream(options);
  await documentAfterResearch(model, () => true).doStream(options);
  assert.deepEqual(choices, [{ type: 'auto' }, { type: 'tool', toolName: 'create_document' }]);
});

test('document instructions stay long-form after research; ordinary Chat style is unchanged', () => {
  const options = { language: 'ar' as const, now: new Date('2026-10-01T10:00:00Z') };
  assert.match(vantraCoreSystemPrompt({ ...options, document: true }), /long-form document/);
  assert.match(webEvidenceInstruction(false, true), /complete requested long-form/);
  assert.match(vantraCoreSystemPrompt(options), /Answer first, then short key points/);
  const route = readFileSync(new URL('../../app/api/generate/chat/route.ts', import.meta.url), 'utf8');
  assert.match(route, /clamp\(body\.max_tokens, 64, 8192, documentTask \? 8192 : 2048\)/u);
});

test('copy is clean RTL text plus escaped HTML; real factual and ordered-list numbers survive', () => {
  const payload = copyPayload(markdown + '\n\n42 <script> is plain content.', sources.map((s) => s.url));
  assert.doesNotMatch(payload.plain, /source:S1|\[1\]|\*\*/);
  assert.match(payload.plain, /1\. Node.js/); assert.match(payload.plain, /42/);
  assert.match(payload.html, /dir="rtl"/); assert.match(payload.html, /&lt;script&gt;/);
  assert.equal(cleanCopyText('[S1](https://example.com/article) Text', sources.map((s) => s.url)), 'Text');
});

test('stored Arabic document renders citations inside bold/lists; unsourced markers disappear', () => {
  const artifact = documentFromMarkdown('stored-doc', markdown, 'ar');
  const html = renderToStaticMarkup(<ArtifactDocumentPreview artifact={artifact} locale="ar" onClose={() => {}} sources={sources} />);
  assert.equal((html.match(/class="chat-citation"/gu) ?? []).length, 2);
  assert.match(html, /<ol dir="rtl"/); assert.doesNotMatch(html, /source:S1/);
  assert.equal(citationMarkdown('Useful **text [1]** and 42.'), 'Useful **text ** and 42.');
});

test('source presentation merges localized domains and keeps primary before outlets before Reddit', () => {
  assert.equal(sourceDomain('https://ar.sa.example.com/a'), 'example.com');
  const html = renderToStaticMarkup(<ChatSources locale="ar" annotation={{ type: 'vantra-web-sources', state: 'read', readCount: 3,
    sources: [{ id: 'S2', title: 'Forum', url: 'https://www.reddit.com/r/test' },
      { id: 'S3', title: 'News', url: 'https://ar.reuters.com/article' }, ...sources,
      { id: 'S4', title: 'Duplicate domain', url: 'https://ar.example.com/a' }] }} />);
  assert.ok(html.indexOf('example.com') < html.indexOf('reuters.com'));
  assert.ok(html.indexOf('reuters.com') < html.indexOf('reddit.com'));
  assert.match(html, /المصادر/); assert.doesNotMatch(html, /Read 0/);
  assert.equal((html.match(/class="chat-source-chip"/gu) ?? []).length, 3);
});
