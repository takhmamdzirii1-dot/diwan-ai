import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { streamText } from 'ai';
import type { LanguageModelV1 } from '@ai-sdk/provider';
import { selectArtifactTools } from '@/lib/artifacts/tool-registry';
import { createChatSearch, currentInformationUnavailable } from './chat-search.server';
import { decideWebSearch } from './selection';
import { guardSearchDataStream } from './evidence';
import { orchestrateWebSearch, SearchProviderError, type SearchExecution, type WebSearchHit } from './search.server';

const now = new Date('2026-09-29T12:00:00Z');
const hits: WebSearchHit[] = [{ title: 'AcmeNova product documentation', url: 'https://acmenova.com/models',
  description: 'The current AcmeNova lineup includes reasoning and general-purpose models for different tasks.' }];
const health = { claim: async () => 'ok' as const, record: async () => undefined };
function fixture(request: string, options: { failBrave?: boolean; failBoth?: boolean; hits?: WebSearchHit[];
  native?: boolean; language?: 'en' | 'fr' | 'ar' } = {}) {
  let brave = 0; let tavily = 0;
  const search = createChatSearch({ decision: decideWebSearch(request), request,
    language: options.language ?? 'en', nativeToolsSupported: options.native ?? true,
    searchConfigured: true, now, operations: {
      search: async (query, _provider, searchOptions) => {
        let execution: SearchExecution | undefined;
        const found = await orchestrateWebSearch(query, { health, onExecution: (value) => {
          execution = value; searchOptions?.onExecution?.(value);
        },
          providers: [{ id: 'brave', search: async () => {
            brave++; if (options.failBrave || options.failBoth) throw new SearchProviderError('timeout');
            return options.hits ?? hits;
          } }, { id: 'tavily', search: async () => {
            tavily++; if (options.failBoth) throw new SearchProviderError('unavailable');
            return options.hits ?? hits;
          } }],
        });
        return { sourceId: 'search:fixture', name: 'Search', mimeType: 'text/markdown', text: '', hits: found, execution };
      },
      read: async () => { throw new Error('URL_TOO_LARGE'); },
    } });
  return { search, counts: () => [brave, tavily] };
}

test('current drivers, models, releases, and provider information REQUIRE one search', async () => {
  for (const request of ['latest NVIDIA RTX driver', 'latest AI model releases',
    'current provider model information', 'اخر نماذج open ai', 'derniers modèles AcmeNova',
    'Create a presentation about current AcmeNova models']) {
    assert.equal(decideWebSearch(request).path, 'required', request);
    const f = fixture(request, { hits: [
      { title: `Current ${request}`, url: 'https://vendor.example/current',
        description: `The current information about ${request} is documented in the latest product listing.` },
      { title: `Research about ${request}`, url: 'https://research.example/current',
        description: `This independent source discusses ${request} and current product details.` },
    ] });
    assert.equal((await f.search.prepare())?.status, 'ok');
    assert.deepEqual(f.counts(), [1, 0]);
    assert.equal(f.search.snapshot().webSearchDecision, 'required');
    assert.equal(f.search.snapshot().webSearchEvidenceSufficient, true);
    // A memory-only answer has no source IDs and cannot reach the customer unchanged.
    const response = await guardSearchDataStream(new Response('0:"The current answer is a stale guess."\n'),
      f.search.evidence, request, now, request.includes('نماذج') ? 'ar' : 'en');
    assert.doesNotMatch(await response.text(), /stale guess/);
  }
});

test('Arabic current-model research retains general_web and prefers official sources', async () => {
  const request = 'اخر نماذج open ai';
  const f = fixture(request, { language: 'ar', hits: [
    { title: 'OpenAI models comparison', url: 'https://research.example/models',
      description: 'A comparison of the current OpenAI reasoning and general-purpose model lineup.' },
    { title: 'OpenAI models', url: 'https://openai.com/models',
      description: 'The current lineup includes reasoning and general-purpose model families for different tasks.' },
  ] });
  assert.equal((await f.search.prepare())?.status, 'ok');
  assert.equal(f.search.snapshot().webSearchEvidenceMode, 'general_web');
  assert.equal(f.search.evidence()?.[0].url, 'https://openai.com/models');
  f.search.validateAnswer('تضم النماذج الحالية عائلات للاستدلال والاستخدام العام حسب المهمة المطلوبة. [[source:S1]]');
  assert.equal(f.search.snapshot().synthesisAccepted, true);
  assert.equal(f.search.snapshot().synthesisRejectionReason, null);
});

test('artifact exposure does not suppress native web_search; explicit artifact requirement is unchanged', async () => {
  const request = 'Evaluate AcmeNova for our company';
  const selection = selectArtifactTools(request, { semantic: true });
  assert.ok(selection.names.includes('create_document'));
  const f = fixture(request);
  assert.equal(decideWebSearch(request).path, 'optional');
  assert.ok(f.search.nativeTool);
  assert.equal(f.search.snapshot().webSearchToolExposed, true);
  assert.deepEqual(f.counts(), [0, 0]);
  await Promise.all([f.search.nativeTool!.execute!({ query: 'AcmeNova models' }),
    f.search.nativeTool!.execute!({ query: 'AcmeNova other query' })]);
  assert.deepEqual(f.counts(), [1, 0]);
  assert.equal(f.search.snapshot().webSearchToolCalled, true);
  const explicit = selectArtifactTools('Create a presentation about current AcmeNova models');
  assert.deepEqual(explicit.names, ['create_presentation']);
  assert.equal(fixture('Create a presentation about current AcmeNova models').search.toolExposed, true);
});

test('none and tool-incapable optional turns make zero search calls; required still pre-searches', async () => {
  for (const request of ['اشرح عملية البناء الضوئي', 'Explain photosynthesis', 'Translate these notes']) {
    const f = fixture(request);
    assert.equal(f.search.toolExposed, false);
    assert.equal(await f.search.prepare(), null);
    assert.deepEqual(f.counts(), [0, 0]);
  }
  const optional = fixture('Is AcmeNova suitable for us?', { native: false });
  assert.equal(optional.search.nativeTool, undefined);
  assert.equal(await optional.search.prepare(), null);
  assert.deepEqual(optional.counts(), [0, 0]);
  const required = fixture('current AcmeNova models', { native: false });
  assert.equal((await required.search.prepare())?.status, 'ok');
  assert.deepEqual(required.counts(), [1, 0]);
});

test('required unavailable/insufficient search fails honestly and never earns synthesis success', async () => {
  const f = fixture('latest AcmeNova models', { failBoth: true });
  assert.equal((await f.search.prepare())?.status, 'unavailable');
  assert.deepEqual(f.counts(), [1, 1]);
  assert.equal(f.search.snapshot().webSearchApiRequestCount, 2);
  assert.equal((await f.search.nativeTool!.execute!({ query: 'retry' })).status, 'unavailable');
  assert.deepEqual(f.counts(), [1, 1], 'no retry loop after a failed search');
  f.search.markUnverified();
  assert.equal(f.search.snapshot().synthesisAccepted, false);
  assert.equal(f.search.snapshot().synthesisRejectionReason, 'search_unavailable');
  for (const language of ['ar', 'en', 'fr'] as const) assert.ok(currentInformationUnavailable(language));
  const route = readFileSync(new URL('../../app/api/generate/chat/route.ts', import.meta.url), 'utf8');
  const refusal = route.slice(route.indexOf('if (requiredSearchUnavailable)'), route.indexOf('let chatReserved'));
  assert.match(refusal, /CURRENT_INFORMATION_UNVERIFIED/);
  assert.match(refusal, /attemptCount: 0/);
  assert.match(refusal, /actualUsage: webSearch.snapshot\(\)/);
  assert.doesNotMatch(refusal, /streamText|reserveChatUsage/);
});

test('technical Brave failure uses Tavily once; cached native calls reuse pre-search', async () => {
  const f = fixture('current AcmeNova models', { failBrave: true });
  assert.equal((await f.search.prepare())?.status, 'ok');
  await f.search.nativeTool!.execute!({ query: 'another query' });
  assert.deepEqual(f.counts(), [1, 1]);
  assert.equal(f.search.snapshot().webSearchFallbackUsed, true);
  assert.equal(f.search.snapshot().webSearchProviderUsed, 'tavily');
  assert.equal(f.search.snapshot().webSearchApiRequestCount, 2);
});

test('technically successful but insufficient evidence never triggers Tavily or permits a memory answer', async () => {
  const f = fixture('latest AcmeNova version', { hits: [{ title: 'AcmeNova history',
    url: 'https://history.example/acmenova', description: 'A historical overview of the company founding.' }] });
  assert.equal((await f.search.prepare())?.status, 'unavailable');
  assert.deepEqual(f.counts(), [1, 0]);
  assert.equal(f.search.snapshot().webSearchApiRequestCount, 1);
  assert.equal(f.search.snapshot().webSearchEvidenceSufficient, false);
  f.search.markUnverified();
  assert.equal(f.search.snapshot().synthesisAccepted, false);
  assert.equal(f.search.snapshot().synthesisRejectionReason, 'insufficient_evidence');
  const guarded = await guardSearchDataStream(new Response('0:"An unverified current model guess."\n'),
    f.search.evidence, 'latest AcmeNova version', now, 'en');
  assert.doesNotMatch(await guarded.text(), /unverified current model guess/);
});

test('required and optional paths share evidence, source-ID guard, and safe terminal metadata', async () => {
  const required = fixture('current AcmeNova models');
  const optional = fixture('Which AcmeNova models suit us?');
  await required.search.prepare();
  await optional.search.nativeTool!.execute!({ query: 'AcmeNova models' });
  assert.deepEqual(required.search.evidence(), optional.search.evidence());
  const answer = 'AcmeNova offers reasoning and general-purpose models for different tasks. [[source:S1]]';
  for (const f of [required, optional]) {
    f.search.validateAnswer(answer);
    assert.equal(f.search.snapshot().synthesisAccepted, true);
    const rendered = await (await guardSearchDataStream(new Response(`0:${JSON.stringify(answer)}\n`),
      f.search.evidence, 'current AcmeNova models', now, 'en')).text();
    assert.match(rendered, /https:\/\/acmenova.com\/models/);
    assert.doesNotMatch(rendered, /\[\[source:|&#x20;/);
    f.search.validateAnswer(answer.replace('S1', 'S99'));
    assert.equal(f.search.snapshot().synthesisAccepted, false);
    assert.equal(f.search.snapshot().synthesisRejectionReason, 'unsupported_url');
    assert.doesNotMatch(JSON.stringify(f.search.snapshot()), /https:|AcmeNova|source:S|reasoning and/);
  }
  const route = readFileSync(new URL('../../app/api/generate/chat/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(route, /taskSelection\.names\.length === 0/);
  assert.ok(route.indexOf('webSearch.validateAnswer(searchSynthesisText)') < route.lastIndexOf('await finalizeOnce({'));
});

test('unused optional search preserves incremental ordinary Chat streaming', async () => {
  let close!: () => void;
  const done = new Promise<void>((resolve) => { close = resolve; });
  const source = new Response(new ReadableStream({ async start(controller) {
    controller.enqueue(new TextEncoder().encode('0:"Hello"\n'));
    await done;
    controller.enqueue(new TextEncoder().encode('0:" world"\n')); controller.close();
  } }));
  const f = fixture('What is photosynthesis?');
  const guarded = await guardSearchDataStream(source, f.search.evidence, 'What is photosynthesis?', now);
  const reader = guarded.body!.getReader();
  assert.equal(new TextDecoder().decode((await reader.read()).value), '0:"Hello"\n');
  close();
  assert.equal(new TextDecoder().decode((await reader.read()).value), '0:" world"\n');
  assert.equal((await reader.read()).done, true);
  assert.deepEqual(f.counts(), [0, 0]);
});

test('locked SDK native tool loop uses selected model and validates continuation before Jobs snapshot', async () => {
  const f = fixture('Which AcmeNova models suit our company?');
  let calls = 0; let synthesis = ''; let saved: Record<string, unknown> = {};
  const model: LanguageModelV1 = { specificationVersion: 'v1', provider: 'fixture', modelId: 'selected-model',
    defaultObjectGenerationMode: undefined, doGenerate: async () => { throw new Error('unused'); },
    doStream: async (options) => {
      const first = calls++ === 0;
      if (!first) assert.match(JSON.stringify(options.prompt), /source:S1/);
      return { rawCall: { rawPrompt: [], rawSettings: {} }, stream: new ReadableStream({ start(controller) {
        if (first) {
          controller.enqueue({ type: 'text-delta', textDelta: 'I will check.' });
          controller.enqueue({ type: 'tool-call', toolCallType: 'function', toolCallId: 'search-1',
            toolName: 'web_search', args: JSON.stringify({ query: 'AcmeNova current models' }) });
        } else controller.enqueue({ type: 'text-delta',
          textDelta: 'AcmeNova offers reasoning and general-purpose models. [[source:S1]]' });
        controller.enqueue({ type: 'finish', finishReason: first ? 'tool-calls' : 'stop',
          usage: { promptTokens: 1, completionTokens: 1 } }); controller.close();
      } }) };
    } };
  const result = await streamText({ model, prompt: 'fixture', tools: { web_search: f.search.nativeTool! },
    maxRetries: 0, maxSteps: 2, onChunk: ({ chunk }) => {
      if (chunk.type === 'text-delta' && f.search.evidence() !== null) synthesis += chunk.textDelta;
    }, onFinish: () => { f.search.validateAnswer(synthesis); saved = f.search.snapshot(); } });
  const response = await guardSearchDataStream(result.toDataStreamResponse(), f.search.evidence,
    'Which AcmeNova models suit our company?', now, 'en');
  const body = await response.text();
  assert.equal(calls, 2, 'one selected-model tool loop; no classifier or other model');
  assert.deepEqual(f.counts(), [1, 0]);
  assert.equal(saved.webSearchToolCalled, true);
  assert.equal(saved.synthesisAccepted, true);
  assert.match(body, /https:\/\/acmenova.com\/models/);
  // Tokens may remain in internal tool-result frames, never in customer text frames.
  assert.doesNotMatch(body.split('\n').filter((line) => line.startsWith('0:')).join('\n'), /\[\[source:/);
});
