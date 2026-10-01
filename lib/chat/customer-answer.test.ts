import assert from 'node:assert/strict';
import test from 'node:test';
import { CustomerAnswer, internalTextFrames } from './customer-answer';
import { consumeCanonicalChatStream } from './client-finalization';
import { serializeChatSession, completeMessageText } from './message-history';
import { copyPayload } from './copy-content';
import { documentFromMarkdown, documentToText } from '@/lib/artifacts/core';
import { documentDirection } from '@/lib/artifacts/document-direction';
import { documentToDocx } from '@/lib/artifacts/docx-export';
import JSZip from 'jszip';
import { streamText } from 'ai';
import type { LanguageModelV1, LanguageModelV1StreamPart } from '@ai-sdk/provider';
import { z } from 'zod';

const planning = 'The user is asking in French about what scents are trending.\n1. Identify Intent\n2. Language: French.\nLet\'s do a search.';
const final = 'Pour créer un parfum actuel, privilégiez les notes boisées. Une composition équilibrée reste importante.';

test('installed SDK emits matching onStepFinish and wire boundaries for native tool orchestration', async () => {
  const projected = new CustomerAnswer(); let calls = 0;
  const model: LanguageModelV1 = { specificationVersion: 'v1', provider: 'fixture', modelId: 'fixture', defaultObjectGenerationMode: 'json',
    doGenerate: async () => { throw new Error('UNUSED'); }, doStream: async () => {
      const toolStep = ++calls === 1;
      const events: LanguageModelV1StreamPart[] = [{ type: 'text-delta', textDelta: toolStep ? planning : final }];
      if (toolStep) events.push({ type: 'tool-call', toolCallType: 'function', toolCallId: 'search-1', toolName: 'web_search', args: '{"query":"fixture"}' });
      events.push({ type: 'finish', finishReason: toolStep ? 'tool-calls' : 'stop', usage: { promptTokens: 10, completionTokens: 10 } });
      return { stream: new ReadableStream({ start(c) { events.forEach(event => c.enqueue(event)); c.close(); } }), rawCall: { rawPrompt: null, rawSettings: {} } };
    } };
  const stream = await streamText({ model, prompt: 'fixture', maxSteps: 2, maxRetries: 0,
    tools: { web_search: { parameters: z.object({ query: z.string() }), execute: async () => ({ evidence: 'fixture' }) } },
    onChunk: ({ chunk }) => { if (chunk.type === 'text-delta') projected.append(chunk.textDelta); },
    onStepFinish: step => { projected.finishStep(step); } });
  const wire = (await stream.toDataStreamResponse().text()).trim().split('\n');
  const excluded = internalTextFrames(wire);
  const delivered = wire.filter((line, index) => line.startsWith('0:') && !excluded.has(index)).map(line => JSON.parse(line.slice(2))).join('');
  assert.equal(calls, 2); assert.equal(projected.text, final); assert.equal(delivered, final);
  assert.equal((await stream.usage).completionTokens, 20, 'internal-step usage is still accounted for');
});

test('captured perfume-shaped tool step is excluded identically from server answer and canonical wire/history/copy/export', async () => {
  const answer = new CustomerAnswer();
  answer.append(planning); answer.finishStep({ finishReason: 'tool-calls', toolCalls: [{ toolName: 'web_search' }] });
  answer.append(final); answer.finishStep({ finishReason: 'stop', toolCalls: [] });
  assert.equal(answer.text, final); assert.equal(answer.internalTextChars, planning.length);
  const lines = [`0:${JSON.stringify(planning)}`, '9:{"toolCallId":"search-1","toolName":"web_search","args":{}}',
    'e:{"finishReason":"tool-calls","isContinued":false}', 'a:{"toolCallId":"search-1","result":{}}',
    `0:${JSON.stringify(final)}`, 'e:{"finishReason":"stop","isContinued":false}', 'd:{"finishReason":"stop"}'];
  const excluded = internalTextFrames(lines);
  assert.deepEqual([...excluded], [0]);
  let delivered = '';
  const status = await consumeCanonicalChatStream(new Response(lines.filter((_, i) => !excluded.has(i)).join('\n') + '\n').body!,
    delta => { delivered += delta; });
  assert.equal(status, 'completed'); assert.equal(delivered, final);
  const saved = serializeChatSession([{ id: 'assistant', role: 'assistant', content: delivered }], () => []);
  const restored = completeMessageText(JSON.parse(saved)[0]);
  const artifact = documentFromMarkdown('stored-answer', restored, 'fr');
  for (const projection of [saved, restored, copyPayload(restored).plain, copyPayload(restored).html, documentToText(artifact)]) {
    assert.doesNotMatch(projection, /Identify Intent|Let's do a search|The user is asking/);
    assert.match(projection, /composition équilibrée/);
  }
  const zip = await JSZip.loadAsync(await (await documentToDocx(artifact)).arrayBuffer());
  const xml = await zip.file('word/document.xml')!.async('string');
  assert.doesNotMatch(xml, /Identify Intent|The user is asking/); assert.match(xml, /composition équilibrée/);
});

test('ordinary explanations, continued text, and incomplete step boundaries are never removed by phrase guessing', () => {
  const answer = new CustomerAnswer(); answer.append(planning);
  answer.finishStep({ finishReason: 'stop', toolCalls: [] }); assert.equal(answer.text, planning);
  const continued = new CustomerAnswer(); continued.append('A legitimate explanation.');
  continued.finishStep({ finishReason: 'tool-calls', toolCalls: [{}], isContinued: true });
  assert.equal(continued.text, 'A legitimate explanation.');
  assert.equal(internalTextFrames([`0:${JSON.stringify(planning)}`, '9:{"toolName":"web_search"}']).size, 0);
});

test('Arabic direction is determined from the complete document, with logical copy order and isolated Latin/numeric runs', async () => {
  const artifact = documentFromMarkdown('rtl', '# Node.js\n\nهذه فقرة عربية طويلة للمعلومات المطلوبة مع OpenAI و GPT-5.6 وسعر $42 ونسبة ~5%.\n\n1. Node.js معلومات عربية واضحة.\n2. المزيد من المعلومات العربية.', 'ar');
  artifact.direction = 'ltr';
  assert.equal(documentDirection(artifact), 'rtl');
  const payload = copyPayload(documentToText(artifact), [], documentDirection(artifact));
  assert.equal(payload.plain.replace(/[\u2066-\u2069]/gu, ''), copyPayload(documentToText(artifact), [], 'ltr').plain.replace(/[\u2066-\u2069]/gu, ''));
  assert.match(payload.html, /<bdi dir="ltr">OpenAI/); assert.match(payload.html, /<bdi dir="ltr">\$42/);
  const zip = await JSZip.loadAsync(await (await documentToDocx(artifact)).arrayBuffer());
  const xml = await zip.file('word/document.xml')!.async('string');
  assert.match(xml, /<w:bidi\/>/); assert.match(xml, /<w:rtl w:val="false"\/>/);
  assert.match(xml, /<w:numPr>/); assert.match(xml, /Node.js/);
});
