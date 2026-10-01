import assert from 'node:assert/strict';
import test from 'node:test';
import { deliverResearchAnswer } from './research-answer';
import { evaluateCurrentOutput } from './output';
import { guardCurrentInformationStream } from './output-stream.server';
import { createChatSearch } from './chat-search.server';
import type { ChatMessagePart } from '@/lib/artifacts/chat-parts';
import type { WebSearchHit } from './search.server';

const hits: WebSearchHit[] = [{ title: 'Public transport fare', url: 'https://transit.example/fares?service=local',
  description: 'The single fare is 4 units, with variable weekend frequency.', evidenceId: 'S1' }];
const part = (id: string, content: string): ChatMessagePart => ({ type: 'document', artifact: {
  schemaVersion: 1, type: 'document', id, title: 'Transport', language: 'en', direction: 'ltr', metadata: {},
  blocks: [{ kind: 'paragraph', text: content }],
} });
function session() {
  return createChatSearch({ request: 'current transit fares', language: 'en', nativeToolsSupported: true,
    searchConfigured: true, decision: { path: 'required', tool: { kind: 'web_search', query: 'transit fares' } },
    operations: { search: async () => ({ sourceId: 'fixture', name: 'Search', mimeType: 'text/markdown', text: '', hits }),
      read: async () => { throw new Error('URL_UNAVAILABLE'); } } });
}

test('paraphrases, transparent calculations and estimates are synthesized, not literal-number/name filtered', () => {
  for (const [language, answer] of [
    ['en', 'Budget around 8 units for a return trip (two single fares). [[source:S1]]'],
    ['fr', 'Prévoyez environ 8 unités pour un aller-retour, soit deux trajets simples. [[source:S1]]'],
    ['ar', 'احسب حوالي 8 وحدات للذهاب والعودة، أي تذكرتين منفردتين. [[source:S1]]'],
  ] as const) {
    const delivered = deliverResearchAnswer(answer, hits, language);
    assert.equal(delivered.accepted, true);
    assert.match(delivered.text, /8/);
    assert.match(delivered.text, /https:\/\/transit.example\/fares\?service=local/);
    assert.doesNotMatch(delivered.text, /\[\[source:/);
  }
});

test('missing citations and ordinary formatting are warnings, not wholesale answer erasure', () => {
  const result = deliverResearchAnswer('The single fare is four units.\n\nWeekend frequency varies.', hits, 'en');
  assert.equal(result.accepted, true);
  assert.deepEqual(result.warnings, ['citations_missing']);
  assert.match(result.text, /four units/);
});

test('server owns citation labels/URLs; unknown and active references cannot reach delivery', () => {
  const good = 'The fare is 4 units. [[source:S1]]';
  for (const bad of ['Unrelated claim [[source:S99]]', 'See https://invented.example/',
    '[Invented label](https://transit.example/fares)', 'Malformed [[source:S1]', '<script>bad()</script>']) {
    const result = deliverResearchAnswer(`${good}\n\n${bad}`, hits, 'en');
    assert.equal(result.accepted, true);
    assert.match(result.text, /4 units/);
    assert.doesNotMatch(result.text, /Unrelated|invented|Malformed|script|\[\[source:/);
    assert.ok(result.warnings.some((value) => /omitted/.test(value)));
  }
  const exact = deliverResearchAnswer('[Wrong label](https://transit.example/fares?service=local)', hits, 'en');
  assert.equal(exact.accepted, true); assert.doesNotMatch(exact.text, /Wrong label/);
});

test('recognized secrets reject the complete answer; formatting-space decoding is narrow', () => {
  for (const secret of ['sb_secret_012345678901234567890', 'API_KEY=012345678901234567890'])
    assert.equal(deliverResearchAnswer(secret, hits, 'en').accepted, false);
  const result = deliverResearchAnswer('Fare: 4. [[source:S1]]&#x20;\n\n&lt;script&gt;', hits, 'en');
  assert.equal(result.accepted, true); assert.doesNotMatch(result.text, /&#x20;/);
  assert.match(result.text, /&lt;script&gt;/);
});

test('unsafe omitted artifact never reappears in a tool frame or shifts another artifact attribution', async () => {
  const search = session(); await search.prepare();
  const bad = part('unsafe-doc', 'Unreturned source [[source:S99]]');
  const good = part('safe-doc', 'Fare is 4 units. [[source:S1]]');
  const frames = [bad, good].flatMap((item, index) => [
    `9:${JSON.stringify({ toolCallId: `doc-${index}`, toolName: 'create_document', args: {} })}`,
    `a:${JSON.stringify({ toolCallId: `doc-${index}`, result: { status: 'ok', artifact: 'artifact' in item ? item.artifact : null } })}`,
  ]).join('\n');
  let completed = 0;
  const body = await guardCurrentInformationStream(new Response(`${frames}\nd:{"finishReason":"stop"}\n`), search,
    { required: true, language: 'en', executionId: 'fixture', onValidated: async () => { completed++; } }).text();
  const toolResults = body.split('\n').filter((line) => line.startsWith('a:')).join('\n');
  assert.doesNotMatch(toolResults, /unsafe-doc|S99/); assert.match(toolResults, /safe-doc/);
  assert.match(toolResults, /transit.example/); assert.equal(completed, 1);
});

test('partial safe text remains useful while invalid artifacts and dangling chart references are withheld', () => {
  const result = evaluateCurrentOutput({ text: 'The fare is 4 units. [[source:S1]]',
    parts: [part('bad', 'Bad citation [[source:S99]]')], hits, request: 'current fares', language: 'en', now: new Date() });
  assert.equal(result.accepted, true); assert.equal(result.parts.length, 0);
  assert.ok(result.warnings.includes('unsafe_artifact_omitted'));
});

test('citation rendering cannot bypass the existing artifact field-size schema', () => {
  const document = part('long-title', 'Fare is 4 units. [[source:S1]]');
  if ('artifact' in document) document.artifact.title = '[[source:S1]]'.repeat(12);
  const result = evaluateCurrentOutput({ text: 'Fare is 4 units. [[source:S1]]', parts: [document],
    hits, request: 'current fares', language: 'en', now: new Date() });
  assert.equal(result.accepted, true);
  assert.equal(result.parts.length, 0);
  assert.ok(result.warnings.includes('artifact_schema_omitted'));
});
