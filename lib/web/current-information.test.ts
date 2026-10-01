import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { streamText, type LanguageModel } from 'ai';
import type { LanguageModelV1 } from '@ai-sdk/provider';
import type { ChatMessagePart } from '@/lib/artifacts/chat-parts';
import { chatRequestMessages, providerChatMessages, serializeChatSession } from '@/lib/chat/message-history';
import { normalizeRouteCapabilityStore, resolveRouteCapabilities } from '@/lib/models/capability-v2';
import { currentInformationPolicy, decideWebSearchWithHistory } from './selection';
import { evidenceModeForRequest, needsFreshEvidence } from './evidence';
import { resolveSearchStrategy, type NativeSearchAdapter } from './strategy';
import { createChatSearch } from './chat-search.server';
import { guardCurrentInformationStream } from './output-stream.server';
import { evaluateCurrentOutput } from './output';
import { loadSearchTurnContext, loadSearchSubjectContext } from './search-context.server';
import { safeStreamError } from './stream-diagnostics';
import { precedingSearchReference, searchContextSchema, type SearchTurnContext } from './search-context';
import { orchestrateWebSearch, SearchProviderError, type SearchExecution, type WebSearchHit } from './search.server';

const now = new Date('2026-09-30T12:00:00Z');
const route = { providerId: 'mock-provider', providerModelId: 'mock-model' };
const executionId = '11111111-1111-4111-8111-111111111111';
const hits: WebSearchHit[] = [{ title: 'AcmeNova models', url: 'https://acmenova.com/models?view=current',
  description: 'Current AcmeNova models include reasoning and general-purpose models for different tasks.',
  evidenceId: 'S1', evidenceLevel: 'primary_search', evidenceBundle: 'general_search_evidence' }];
const answer = 'AcmeNova provides reasoning and general-purpose models for different tasks. [[source:S1]]';
test('tool-step planning never reaches complete-answer validation, delivery, or settlement; final grounded answer does', async () => {
  const f = fixture(); await f.search.prepare();
  const planning = 'The user is asking about current models. Identify Intent. I should use web_search.';
  const wire = `0:${JSON.stringify(planning)}\n9:{"toolCallId":"search-1","toolName":"web_search","args":{}}\ne:{"finishReason":"tool-calls","isContinued":false}\na:{"toolCallId":"search-1","result":{}}\n0:${JSON.stringify(answer)}\ne:{"finishReason":"stop","isContinued":false}\nd:{"finishReason":"stop"}\n`;
  let settled = 0; let released = 0;
  const body = await guardCurrentInformationStream(new Response(wire), f.search, { required: true, toolSteps: true,
    language: 'en', executionId, onValidated: async () => { settled++; }, onTerminated: async () => { released++; } }).text();
  assert.doesNotMatch(body, /Identify Intent|I should use web_search|The user is asking/);
  assert.match(body, /AcmeNova provides/); assert.match(body, /https:\/\/acmenova.com/);
  assert.equal(settled, 1); assert.equal(released, 0); assert.deepEqual(f.counts(), [1, 0]);
});
test('combined verification clauses inherit only a fresh owned subject, including a failed prior answer', () => {
  const prior = [{ role: 'user', content: 'ما هو أحدث إصدار من Acme الآن؟' },
    { role: 'assistant', content: 'لم أتمكن من التحقق من المعلومات الحالية.' }];
  const result = decideWebSearchWithHistory('هل أنت متأكد؟ تحقق مرة أخرى.', prior);
  assert.equal(result.decision.path, 'required');
  assert.equal(result.evidenceRequest, prior[0].content);
  assert.equal(decideWebSearchWithHistory('هل أنت متأكد؟ موضوع جديد.', prior).evidenceRequest, 'هل أنت متأكد؟ موضوع جديد.');
});

test('repeated failed confirmations retain the original fresh subject without inheriting rejected evidence', () => {
  const original = 'ما هو أحدث إصدار من Acme الآن؟';
  const history = [{ role: 'user', content: original }, { role: 'assistant', content: 'Unable to verify.' },
    { role: 'user', content: 'هل أنت متأكد؟ تحقق مرة أخرى.' }, { role: 'assistant', content: 'Unable to verify.' }];
  const selection = decideWebSearchWithHistory('هل أنت متأكد؟', history);
  assert.equal(selection.decision.path, 'required');
  assert.equal(selection.evidenceRequest, original);
  assert.equal(decideWebSearchWithHistory('هل أنت متأكد؟', [...history,
    { role: 'user', content: 'Explain photosynthesis' }, { role: 'assistant', content: 'A stable explanation.' }]).decision.path, 'none');
  assert.match(decideWebSearchWithHistory('هل أنت متأكد؟', [{ role: 'user', content: 'latest Africa news today' },
    { role: 'assistant', content: 'Unable to verify.' }, { role: 'user', content: 'last week' },
    { role: 'assistant', content: 'Unable to verify.' }]).evidenceRequest, /Africa news last week/);
});
const native: NativeSearchAdapter = { protocol: 'fixture-search', documentationUrl: 'https://docs.example/native-search',
  supportsRequiredSearch: true, supportsRoute: (value) => value.providerId === route.providerId,
  bind: ({ model }) => model };
const verified = { state: 'supported' as const, protocol: native.protocol, verifiedAt: now.toISOString(),
  source: 'provider_documentation' as const };
function fixture(request = 'current AcmeNova models', options: { tools?: boolean; hosted?: boolean;
  configured?: boolean; weak?: boolean; failBrave?: boolean } = {}) {
  let brave = 0; let tavily = 0;
  const policy = currentInformationPolicy(request);
  const strategy = resolveSearchStrategy({ policy, route, toolsSupported: options.tools ?? true,
    vantraConfigured: options.configured ?? true, native: options.hosted ? verified : { state: 'unknown' },
    adapters: [native], now });
  const search = createChatSearch({ decision: policy.decision, request, language: 'en', now, strategy,
    ...route, modelId: 'selected-vantra-model', nativeToolsSupported: options.tools ?? true,
    searchConfigured: options.configured ?? true, operations: {
      read: async () => { throw new Error('URL_TOO_LARGE'); },
      search: async (query, _provider, searchOptions) => {
        let execution: SearchExecution | undefined;
        const result = await orchestrateWebSearch(query, {
          health: { claim: async () => 'ok' as const, record: async () => undefined },
          onExecution: (value) => { execution = value; searchOptions?.onExecution?.(value); },
          providers: [{ id: 'brave', search: async () => {
            brave++; if (options.failBrave) throw new SearchProviderError('timeout');
            return options.weak ? [{ title: 'Historical background', url: 'https://history.example/archive',
              description: 'Historical notes that do not verify this current requested information.' }] : hits;
          } }, { id: 'tavily', search: async () => { tavily++; return hits; } }],
        });
        return { sourceId: 'fixture', name: 'Search', mimeType: 'text/markdown', text: '', hits: result, execution };
      },
    } });
  return { search, strategy, counts: () => [brave, tavily] };
}
function document(content = answer): ChatMessagePart {
  return { type: 'document', artifact: { schemaVersion: 1, type: 'document', id: 'doc-1',
    title: 'AcmeNova models', language: 'en', direction: 'ltr', metadata: {},
    blocks: [{ kind: 'paragraph', text: content }] } };
}

test('one policy determines activation, freshness, and exact-fact validation across languages', () => {
  for (const [request, mode] of [
    ['latest NVIDIA RTX driver', 'structured_fact'], ['latest AI model releases', 'general_web'],
    ['current provider model information', 'general_web'], ['اخر نماذج open ai', 'general_web'],
    ['ما هو أحدث إصدار من Acme الآن؟', 'structured_fact'], ['prix actuel Acme', 'structured_fact'],
    ['اعطيني اخر 5 اخبار في دول افريقيا', 'fresh_news'], ['What happened in the region?', 'fresh_news'],
  ] as const) {
    const policy = currentInformationPolicy(request);
    assert.equal(policy.decision.path, 'required', request);
    assert.equal(needsFreshEvidence(request), policy.fresh);
    assert.equal(evidenceModeForRequest(request), policy.mode);
    assert.equal(policy.mode, mode);
  }
});

test('unknown/unsupported/expired/unimplemented hosted search uses VANTRA, never infers support from tools', () => {
  const policy = currentInformationPolicy('current AcmeNova models');
  for (const capability of [undefined, { state: 'unknown' as const }, { state: 'unsupported' as const },
    { ...verified, verifiedAt: '2020-01-01' }, { ...verified, source: undefined },
    { ...verified, protocol: 'unimplemented-protocol' }]) {
    for (const toolsSupported of [true, false]) {
      const strategy = resolveSearchStrategy({ policy, route, toolsSupported, vantraConfigured: true,
        native: capability, adapters: [native], now });
      assert.equal(strategy.kind, 'vantra_web_tool');
      assert.equal(strategy.execution, 'pre_search');
    }
  }
  assert.equal(resolveSearchStrategy({ policy, route: { ...route, providerId: 'wrong-provider' },
    toolsSupported: true, vantraConfigured: true, native: verified, adapters: [native], now }).kind, 'vantra_web_tool');
});

test('verified native protocol takes exclusive priority and requires an enforceable required-search mode', async () => {
  const f = fixture('current AcmeNova models', { hosted: true });
  assert.equal(f.strategy.kind, 'provider_native');
  assert.equal(f.search.nativeTool, undefined);
  await f.search.prepare();
  assert.equal(f.search.snapshot().webSearchEvidenceSufficient, null, 'configuration is not verification');
  await f.search.ingestNativeEvidence(hits);
  f.search.evaluateOutput(answer);
  assert.deepEqual(f.counts(), [0, 0]);
  assert.equal(f.search.snapshot().webValidationOutcome, 'accepted');
  assert.equal(f.search.snapshot().nativeSearchInvocationCount, 1);
  assert.equal(f.search.snapshot().webSearchApiRequestCount, 0);
  const strategy = resolveSearchStrategy({ policy: currentInformationPolicy('current AcmeNova models'),
    route, toolsSupported: false, vantraConfigured: true, native: verified,
    adapters: [{ ...native, supportsRequiredSearch: false }], now });
  assert.equal(strategy.kind, 'vantra_web_tool');
});

test('required native call without evidence fails and cannot dispatch Brave afterward', async () => {
  const f = fixture('current AcmeNova models', { hosted: true });
  const response = guardCurrentInformationStream(new Response('0:"A confident memory-only answer."\nd:{"finishReason":"stop"}\n'),
    f.search, { required: true, language: 'en', executionId });
  const body = await response.text();
  assert.doesNotMatch(body, /confident memory-only/);
  assert.match(body, /CURRENT_INFORMATION_UNVERIFIED/);
  assert.equal(f.search.snapshot().webValidationOutcome, 'rejected');
  assert.deepEqual(f.counts(), [0, 0]);
});

test('tool-incapable required turns pre-search; weak evidence cannot invoke Tavily', async () => {
  const f = fixture('current AcmeNova models', { tools: false });
  assert.equal((await f.search.prepare())?.status, 'ok');
  assert.deepEqual(f.counts(), [1, 0]);
  assert.equal(f.search.nativeTool, undefined);
  const weak = fixture('current AcmeNova models', { weak: true });
  assert.equal((await weak.search.prepare())?.status, 'ok');
  assert.deepEqual(weak.counts(), [1, 0]);
  const technical = fixture('current AcmeNova models', { failBrave: true });
  await technical.search.prepare();
  assert.deepEqual(technical.counts(), [1, 1]);
  await technical.search.prepare();
  assert.deepEqual(technical.counts(), [1, 1]);
});

test('required-current policy cannot be downgraded by an optional caller/model that ignores tools', async () => {
  let requests = 0;
  const search = createChatSearch({ decision: { path: 'optional' }, request: 'current AcmeNova models',
    language: 'en', now, nativeToolsSupported: true, searchConfigured: true, operations: {
      read: async () => { throw new Error('URL_TOO_LARGE'); }, search: async () => {
        requests++; return { sourceId: 'fixture', name: 'Search', mimeType: 'text/markdown', text: '', hits };
      },
    } });
  await search.prepare();
  assert.equal(requests, 1);
  assert.equal(search.snapshot().webSearchDecision, 'required');
  assert.equal(search.evaluateOutput('Invalid source. [[source:S99]]')?.accepted, false);
});

test('static and tool-incapable optional profiles make zero retrieval calls', async () => {
  for (const request of ['Explain photosynthesis', 'اشرح عملية البناء الضوئي', 'Translate these notes']) {
    const f = fixture(request, { hosted: true });
    assert.equal(f.strategy.kind, 'none');
    assert.equal(await f.search.prepare(), null);
    assert.equal(f.search.nativeTool, undefined);
    assert.deepEqual(f.counts(), [0, 0]);
  }
  const optional = fixture('Is AcmeNova useful?', { tools: false });
  assert.equal(optional.strategy.kind, 'none');
  assert.equal(await optional.search.prepare(), null);
  assert.deepEqual(optional.counts(), [0, 0]);
});

test('bounded search context is ownership checked and excludes rejected/completed-only records', async () => {
  const context: SearchTurnContext = { version: 1, subject: 'current AcmeNova models', timeframe: '',
    fresh: true, mode: 'general_web', sourceUrls: [hits[0].url] };
  const row = { user_id: 'owner', state: 'completed', modality: 'chat',
    execution_metadata: { webValidationOutcome: 'accepted', searchTurnContext: context } };
  assert.deepEqual(await loadSearchTurnContext('owner', executionId, async () => row), context);
  for (const invalid of [{ ...row, user_id: 'another-user' }, { ...row, state: 'failed' },
    { ...row, execution_metadata: { searchTurnContext: context } },
    { ...row, execution_metadata: { ...row.execution_metadata, webValidationOutcome: 'rejected' } }])
    assert.equal(await loadSearchTurnContext('owner', executionId, async () => invalid), null);
  assert.equal(searchContextSchema.safeParse({ ...context, subject: 'a'.repeat(301) }).success, false);
  assert.equal(searchContextSchema.safeParse({ ...context, providerSecrets: 'not-allowed' }).success, false);
  const source = readFileSync(new URL('./search-context.server.ts', import.meta.url), 'utf8');
  assert.match(source, /\.eq\('user_id', userId\)/);
});

test('context reference survives reload/request serialization but never becomes provider input', () => {
  const messages = [{ role: 'assistant', content: answer,
    annotations: [{ type: 'vantra-search-context', executionId }, { secret: 'not-a-context-reference' }] }];
  const restored = JSON.parse(serializeChatSession(messages, () => []));
  const request = chatRequestMessages(restored);
  assert.deepEqual(precedingSearchReference(request), { type: 'vantra-search-context', executionId });
  assert.doesNotMatch(JSON.stringify(request), /secret/);
  assert.doesNotMatch(JSON.stringify(providerChatMessages(request)), /executionId|annotations/);
  assert.equal(precedingSearchReference([...request, { role: 'user' }]), null, 'no unrelated intervening turn');
});

test('trusted context carries subject/timeframe through confirmation, temporal and pronoun follow-ups', () => {
  const context: SearchTurnContext = { version: 1, subject: 'اخر اخبار افريقيا اليوم', timeframe: 'اليوم',
    fresh: true, mode: 'fresh_news', sourceUrls: [hits[0].url] };
  for (const request of ['هل أنت متأكد؟', 'اخر اسبوع', 'اعطني باقي النتائج', 'وهل هو مجاني؟']) {
    const selection = decideWebSearchWithHistory(request, [], context);
    assert.equal(selection.decision.path, 'required');
    assert.match(selection.evidenceRequest, /افريقيا/);
    if (request === 'اخر اسبوع') {
      assert.doesNotMatch(selection.evidenceRequest, /اليوم/);
      assert.match(selection.evidenceRequest, /اخر اسبوع/);
    }
  }
  assert.equal(decideWebSearchWithHistory('Explain calculus', [], context).decision.path, 'none');
  assert.equal(decideWebSearchWithHistory('and my vacation?', [], context).evidenceRequest, 'and my vacation?');
  assert.equal(decideWebSearchWithHistory('هل أنت متأكد؟', [], null).decision.path, 'none');
});

test('current text/document/presentation/spreadsheet/chart/file share the evidence requirement', () => {
  const doc = document();
  const parts: ChatMessagePart[] = [doc,
    { type: 'presentation', artifact: { ...('artifact' in doc ? doc.artifact : {}), type: 'presentation',
      slides: [{ id: 'slide-1', layout: 'content', title: 'AcmeNova models', blocks: [{ kind: 'text', text: answer }] }]
    } as Extract<ChatMessagePart, { type: 'presentation' }>['artifact'] },
    { type: 'spreadsheet', artifact: { schemaVersion: 1, type: 'spreadsheet', id: 'sheet-1', title: 'AcmeNova models',
      language: 'en', direction: 'ltr', metadata: {}, sheets: [{ id: 's1', name: 'Models', columns: ['Model'], rows: [[answer]] }] } },
    { type: 'chart', artifact: { schemaVersion: 1, type: 'chart', id: 'chart-1', title: 'Models', language: 'en',
      direction: 'ltr', metadata: {}, chartType: 'bar', categories: [answer], series: [{ name: 'Models', values: [null] }] } },
    { type: 'file', name: 'models.txt', mimeType: 'text/plain;charset=utf-8', format: 'txt', content: answer }];
  for (const part of parts) {
    const input = { text: '', parts: [part], hits, request: 'current AcmeNova models', now, language: 'en' as const };
    const result = evaluateCurrentOutput(input);
    assert.equal(result.accepted, true, part.type);
    assert.doesNotMatch(JSON.stringify(result.parts), /\[\[source:/);
    assert.match(JSON.stringify(result.parts), /https:\/\/acmenova.com\/models\?view=current/);
    assert.equal(evaluateCurrentOutput({ ...input, hits: [] }).accepted, false);
  }
  assert.equal(evaluateCurrentOutput({ text: '', parts: [document(answer.replace('S1', 'S99'))],
    hits, request: 'current AcmeNova models', now, language: 'en' }).accepted, false);
});

test('transparent current-value calculations preserve provenance in text and artifacts', () => {
  const evidence: WebSearchHit[] = [{ title: 'Acme fares', url: 'https://acme.com/fares',
    description: 'A single trip costs approximately 4 units.', evidenceId: 'S1' }];
  for (const value of ['A return trip would cost approximately 8 units (two single fares). [[source:S1]]',
    'The observed single fare is around 4 units. [[source:S1]]']) {
    const input = { hits: evidence, request: 'current Acme return fare', language: 'en' as const, now };
    assert.equal(evaluateCurrentOutput({ ...input, text: value, parts: [] }).accepted, true);
    assert.equal(evaluateCurrentOutput({ ...input, text: '', parts: [document(value)] }).accepted, true);
    assert.equal(evaluateCurrentOutput({ ...input, text: value.replace('S1', 'S99'), parts: [] }).accepted, false);
    assert.equal(evaluateCurrentOutput({ ...input, text: '', parts: [document(value.replace('S1', 'S99'))] }).accepted, false);
  }
});

test('current/LTS bullet formatting and exact server-owned URLs remain compatible', () => {
  const exact: WebSearchHit[] = [{ title: 'Acme downloads', url: 'https://acme.com/en/download/current',
    description: 'Acme Current 3.2.0, LTS 2.1.0.', evidenceLevel: 'primary_search', evidenceBundle: 'primary_exact' }];
  const text = '- الإصدار الحالي (Current): **3.2.0** [[source:S1]]\n- الدعم طويل الأمد (LTS): **2.1.0** [[source:S1]]';
  const input = { text, parts: [], hits: exact, request: 'ما هو أحدث إصدار من Acme الآن؟', language: 'ar' as const, now };
  assert.equal(evaluateCurrentOutput(input).accepted, true);
  const differentlyLabeled = evaluateCurrentOutput({ ...input, hits: [{ ...exact[0], title: 'Official release blog' }] });
  assert.equal(differentlyLabeled.accepted, true);
  assert.match(differentlyLabeled.text, /\[Official release blog\]\(https:\/\/acme.com\/en\/download\/current\)/);
  assert.match(evaluateCurrentOutput(input).text, /Current.*3\.2\.0/);
  assert.match(evaluateCurrentOutput(input).text, /LTS.*2\.1\.0/);
  assert.equal(evaluateCurrentOutput({ ...input, text: text.replaceAll('[[source:S1]]', '[[source:S99]]') }).accepted, false);
  assert.equal(evaluateCurrentOutput({ ...input, text: text.replaceAll('[[source:S1]]', '[Source](https://acme.com/altered)') }).accepted, false);
});

test('release history retains channel scope and is never certified as latest by citation presence', async () => {
  const official: WebSearchHit[] = [{ title: 'Acme release history', url: 'https://acme.com/blog/release',
    description: 'Acme 22.23.3 (LTS) historical entry. Acme 26.10.0 (Current) release entry.' }];
  const request = 'ما هو أحدث إصدار Acme LTS الآن؟';
  const search = createChatSearch({ request, decision: currentInformationPolicy(request).decision, language: 'ar', now,
    nativeToolsSupported: false, searchConfigured: true, operations: {
      search: async () => ({ sourceId: 'fixture', name: 'Search', mimeType: 'text/markdown', text: '', hits: official }),
      read: async () => { throw new Error('URL_UNAVAILABLE'); } } });
  const prepared = await search.prepare();
  assert.match(prepared!.context, /LTS/);
  assert.match(prepared!.context, /historical entry/);
  assert.match(prepared!.context, /26\.10\.0 \(Current\)/);
  assert.equal(search.evaluateOutput('إصدار LTS موثق هنا. [[source:S99]]')?.accepted, false);
});

test('failed current turn keeps conversational subject but never loads rejected evidence', async () => {
  const original = 'ما هو أحدث إصدار من Node.js الآن؟';
  const selection = decideWebSearchWithHistory('هل أنت متأكد؟', [{ role: 'user', content: original }]);
  assert.equal(selection.decision.path, 'required');
  assert.equal(selection.evidenceRequest, original);
  const f = fixture(); await f.search.prepare(); f.search.evaluateOutput('Invalid source. [[source:S99]]');
  assert.equal(f.search.contextForPersistence(), null);
  const subject = f.search.subjectForPersistence(); assert.ok(subject);
  assert.equal('sourceUrls' in subject, false);
  const row = { user_id: 'owner', state: 'failed', modality: 'chat', execution_metadata: {
    webValidationOutcome: 'rejected', searchSubjectContext: subject, searchTurnContext: {
      ...subject, sourceUrls: ['https://untrusted.example/'] } } };
  assert.deepEqual(await loadSearchSubjectContext('owner', executionId, async () => row), subject);
  assert.equal(await loadSearchTurnContext('owner', executionId, async () => row), null);
  assert.equal(await loadSearchSubjectContext('other', executionId, async () => row), null);
  assert.equal(await loadSearchSubjectContext('owner', executionId, async () => ({ ...row, state: 'user_cancelled' })), null);
  assert.equal(decideWebSearchWithHistory('هل أنت متأكد؟', [{ role: 'user', content: 'Explain photosynthesis' }]).decision.path, 'none');
  assert.equal(decideWebSearchWithHistory('هل أنت متأكد؟', [
    { role: 'user', content: original }, { role: 'user', content: 'Explain calculus' }]).decision.path, 'none');
  const inherited = decideWebSearchWithHistory('هل أنت متأكد؟', [], subject);
  assert.equal(inherited.decision.path, 'required');
  assert.equal(inherited.seenSourceUrls, undefined);
});

test('stream errors preserve only allowlisted category/code/status, never arbitrary sensitive messages', () => {
  const error = Object.assign(new Error('secret prompt/token must not be retained'), {
    name: 'AI_APICallError', code: 'rate_limit_exceeded', statusCode: 429,
    requestBodyValues: { secret: 'not-retained' } });
  assert.deepEqual(safeStreamError(error), { upstreamErrorObserved: true,
    upstreamErrorCategory: 'AI_APICallError', upstreamErrorCode: 'rate_limit_exceeded', upstreamHttpStatus: 429 });
  assert.equal(safeStreamError({ name: 'secret', code: 'sb_secret_private', statusCode: 999 }).upstreamErrorCode, null);
  assert.equal(safeStreamError({ cause: { code: 'ECONNRESET' } }).upstreamErrorCode, 'ECONNRESET');
  assert.equal(safeStreamError({ responseBody: '{"error":{"code":"server_error","message":"secret"}}' })
    .upstreamErrorCode, 'server_error');
  assert.doesNotMatch(JSON.stringify(safeStreamError(error)), /secret|prompt|token/);
});

test('provider error terminal versus missing terminal are distinguishable and neither completes usage', async () => {
  for (const [wire, reason, seen] of [
    ['0:"Partial"\n3:""\nd:{"finishReason":"error"}\n', 'provider_error', true],
    ['0:"Partial"\n', 'missing_terminal', false],
  ] as const) {
    const f = fixture('Explain photosynthesis'); let completed = 0; let terminal: unknown;
    let diagnostics: unknown;
    const guarded = guardCurrentInformationStream(new Response(wire), f.search, {
      required: false, language: 'en', executionId, onValidated: async () => { completed++; },
      onDiagnostics: (value) => { diagnostics = value; },
      onTerminated: async (value) => { terminal = value; },
    });
    await guarded.text(); assert.equal(completed, 0); assert.equal(terminal, reason);
    assert.deepEqual(diagnostics, { streamTerminalFrameSeen: seen, streamTerminalFrameMissing: !seen,
      streamWireFinishReason: seen ? 'error' : null, streamReadFailed: false, streamErrorFrameSeen: seen });
  }
});

test('wire gate blocks unverified tool results and renders valid artifacts with exact URLs', async () => {
  for (const valid of [true, false]) {
    const f = fixture(); await f.search.prepare();
    const part = document(valid ? answer : 'Invalid source. [[source:S99]]');
    const frame = `9:${JSON.stringify({ toolCallId: 'doc-1', toolName: 'create_document', args: {} })}\n`
      + `a:${JSON.stringify({ toolCallId: 'doc-1', result: { status: 'ok', artifact: 'artifact' in part ? part.artifact : null } })}\n`
      + 'd:{"finishReason":"tool-calls"}\n';
    const body = await guardCurrentInformationStream(new Response(frame), f.search,
      { required: true, language: 'en', executionId }).text();
    assert.equal(/CURRENT_INFORMATION_UNVERIFIED/.test(body), !valid);
    if (valid) {
      const result = JSON.parse(body.split('\n').find((line) => line.startsWith('a:'))!.slice(2));
      assert.doesNotMatch(JSON.stringify(result), /\[\[source:/);
      assert.match(body, /vantra-search-context/);
    } else assert.doesNotMatch(body, /Invalid source|a:|9:/);
  }
});

test('selected-model SDK native-search fixture produces normalized evidence without any VANTRA retrieval', async () => {
  const f = fixture('current AcmeNova models', { hosted: true });
  let modelCalls = 0;
  const model: LanguageModelV1 = { specificationVersion: 'v1', provider: route.providerId,
    modelId: route.providerModelId, defaultObjectGenerationMode: undefined,
    doGenerate: async () => { throw new Error('unused'); }, doStream: async () => {
      modelCalls++; await f.search.ingestNativeEvidence(hits);
      return { rawCall: { rawPrompt: [], rawSettings: {} }, stream: new ReadableStream({ start(controller) {
        controller.enqueue({ type: 'text-delta', textDelta: answer });
        controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1 } });
        controller.close();
      } }) };
    } };
  const bound: LanguageModel = f.strategy.nativeAdapter!.bind({ model, required: true, maxSearchInvocations: 1,
    onEvidence: async (evidence) => { await f.search.ingestNativeEvidence(evidence); return f.search.evidence() ?? []; } });
  const result = await streamText({ model: bound, prompt: 'fixture', maxRetries: 0 });
  const body = await guardCurrentInformationStream(result.toDataStreamResponse(), f.search,
    { required: true, language: 'en', executionId }).text();
  assert.equal(modelCalls, 1);
  assert.deepEqual(f.counts(), [0, 0]);
  assert.match(body, /acmenova.com\/models\?view=current/);
  assert.equal(f.search.snapshot().webSearchActualProviderModel, route.providerModelId);
  assert.equal(f.search.snapshot().webSearchSelectedModel, 'selected-vantra-model');
  assert.equal(f.search.snapshot().webValidationOutcome, 'accepted');
});

test('native capability metadata is identity-bound, allowlisted and preserved without changing V2 tool semantics', () => {
  const store = normalizeRouteCapabilityStore({ route: { ...route, evidence: {}, overrides: { tools: 'force_enabled' },
    nativeSearch: { ...verified, endpoint: 'https://untrusted.example', headers: { authorization: 'not-allowed' } } } });
  assert.doesNotMatch(JSON.stringify(store), /endpoint|headers|not-allowed/);
  const resolved = resolveRouteCapabilities({ route: { id: 'route', ...route }, stored: store, now: now.toISOString() });
  assert.deepEqual(resolved.nativeSearch, verified);
  assert.equal(resolved.resolved.tools.state, 'supported');
  assert.equal(resolveRouteCapabilities({ route: { id: 'route', ...route, providerModelId: 'different-model' },
    stored: store }).nativeSearch.state, 'unknown');
});

test('optional selected-model search and artifact tools coexist through the real SDK and terminal gate', async () => {
  const f = fixture('Which AcmeNova models suit our company?');
  let calls = 0; let finalOutcome: unknown; let finished = false;
  const model: LanguageModelV1 = { specificationVersion: 'v1', provider: route.providerId,
    modelId: route.providerModelId, defaultObjectGenerationMode: undefined,
    doGenerate: async () => { throw new Error('unused'); }, doStream: async () => {
      const first = ++calls === 1;
      return { rawCall: { rawPrompt: [], rawSettings: {} }, stream: new ReadableStream({ start(controller) {
        controller.enqueue({ type: 'tool-call', toolCallType: 'function', toolCallId: first ? 'search' : 'document',
          toolName: first ? 'web_search' : 'create_document',
          args: JSON.stringify(first ? { query: 'AcmeNova current models' } : {}) });
        controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage: { promptTokens: 1, completionTokens: 1 } });
        controller.close();
      } }) };
    } };
  const { tool } = await import('ai'); const { z } = await import('zod');
  const part = document();
  const result = await streamText({ model, prompt: 'fixture', maxRetries: 0, maxSteps: 2,
    tools: { web_search: f.search.nativeTool!, create_document: tool({ parameters: z.object({}),
      execute: async () => ({ status: 'ok', artifact: 'artifact' in part ? part.artifact : null }) }) },
    onFinish: () => { finished = true; } });
  const body = await guardCurrentInformationStream(result.toDataStreamResponse(), f.search, {
    required: false, language: 'en', executionId, onValidated: async () => {
      assert.equal(finished, true);
      finalOutcome = f.search.snapshot().webValidationOutcome;
    },
  }).text();
  assert.equal(calls, 2, 'one selected model tool loop, no hidden classifier');
  assert.deepEqual(f.counts(), [1, 0]);
  assert.equal(finalOutcome, 'accepted');
  assert.match(body, /acmenova.com\/models\?view=current/);
  assert.doesNotMatch(body.split('\n').filter((line) => line.startsWith('a:') && line.includes('artifact')).join('\n'), /\[\[source:/);
});

test('optional search holds the complete answer and cannot reverse a rejected pre-search prefix', async () => {
  const f = fixture('Which AcmeNova models suit our company?');
  assert.equal(f.search.toolExposed, true);
  const prefix = 'Use this unsupported source https://unreturned.example/ . ';
  let upstream!: ReadableStreamDefaultController<Uint8Array>;
  let observed: unknown;
  const encoder = new TextEncoder();
  const response = guardCurrentInformationStream(new Response(new ReadableStream<Uint8Array>({
    start(controller) { upstream = controller; controller.enqueue(encoder.encode(`0:${JSON.stringify(prefix)}\n`)); },
  })), f.search, { required: false, language: 'en', executionId,
    onValidated: async () => { observed = f.search.snapshot().webValidationOutcome; },
  });
  const reader = response.body!.getReader();
  let delivered = false;
  const firstRead = reader.read().then((value) => { delivered = true; return value; });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(delivered, false, 'pre-search text must not reach the client');
  await f.search.nativeTool!.execute!({ query: 'AcmeNova current models' });
  // Same ordering as SDK onFinish: complete-output validation precedes the wire gate.
  assert.equal(f.search.evaluateOutput(prefix + answer)?.accepted, false);
  const rejection = f.search.snapshot().webValidationFailureReason;
  upstream.enqueue(encoder.encode(`9:${JSON.stringify({ toolCallId: 'search', toolName: 'web_search', args: {} })}\n0:${JSON.stringify(answer)}\nd:{"finishReason":"stop"}\n`));
  upstream.close();
  const decoder = new TextDecoder();
  let body = decoder.decode((await firstRead).value);
  while (true) { const next = await reader.read(); if (next.done) break; body += decoder.decode(next.value); }
  reader.releaseLock();
  assert.match(body, /CURRENT_INFORMATION_UNVERIFIED/);
  assert.doesNotMatch(body, /unreturned\.example|AcmeNova provides/);
  assert.equal(observed, 'rejected');
  assert.equal(f.search.evaluateOutput(answer)?.accepted, false, 'a valid suffix cannot reverse full-answer rejection');
  assert.equal(f.search.snapshot().webValidationFailureReason, rejection);
  assert.deepEqual(f.counts(), [1, 0]);
});

test('optional search wire validation includes the prefix even without prior onFinish validation', async () => {
  const f = fixture('Which AcmeNova models suit our company?');
  let upstream!: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  const response = guardCurrentInformationStream(new Response(new ReadableStream<Uint8Array>({
    start(controller) { upstream = controller; controller.enqueue(encoder.encode('0:"Unsupported https://unreturned.example/ . "\n')); },
  })), f.search, { required: false, language: 'en', executionId });
  await f.search.nativeTool!.execute!({ query: 'AcmeNova current models' });
  upstream.enqueue(encoder.encode(`0:${JSON.stringify(answer)}\nd:{"finishReason":"stop"}\n`)); upstream.close();
  const body = await response.text();
  assert.match(body, /CURRENT_INFORMATION_UNVERIFIED/);
  assert.doesNotMatch(body, /unreturned\.example|AcmeNova provides/);
  assert.equal(f.search.snapshot().webValidationOutcome, 'rejected');
});

test('terminal callback observes rejected output before any success can be persisted', async () => {
  for (const frame of ['0:"Invalid source. [[source:S99]]"\nd:{"finishReason":"stop"}\n',
    `0:${JSON.stringify('x'.repeat(1_000_001))}\n`]) {
    const f = fixture(); await f.search.prepare(); let outcome: unknown;
    const body = await guardCurrentInformationStream(new Response(frame), f.search, {
      required: true, language: 'en', executionId,
      onValidated: async () => { outcome = f.search.snapshot().webValidationOutcome; },
      onTerminated: async () => { outcome = f.search.snapshot().webValidationOutcome; },
    }).text();
    assert.equal(outcome, 'rejected');
    assert.match(body, /CURRENT_INFORMATION_UNVERIFIED/);
    assert.doesNotMatch(body, /Invalid source/);
  }
});

test('stream gate never completes or consumes usage for provider errors or missing terminal frames', async () => {
  for (const frame of [`0:${JSON.stringify(answer)}\n3:"provider failure"\nd:{"finishReason":"stop"}\n`,
    `0:${JSON.stringify(answer)}\n`, `0:${JSON.stringify(answer)}\nd:{"finishReason":"error"}\n`]) {
    const f = fixture(); await f.search.prepare();
    const settlements: string[] = [];
    const body = await guardCurrentInformationStream(new Response(frame), f.search, {
      required: true, language: 'en', executionId,
      onValidated: async () => { settlements.push('completed'); },
      onTerminated: async (reason) => { settlements.push(`released:${reason}`); },
    }).text();
    assert.equal(settlements.length, 1);
    assert.match(settlements[0], /^released:/);
    assert.match(body, /PROVIDER_STREAM_FAILED/);
    assert.doesNotMatch(body, /AcmeNova provides/);
  }
});

test('downstream cancellation and request abort release once without a late Completed callback', async () => {
  for (const abortRequest of [true, false]) {
    const f = fixture(); await f.search.prepare();
    let sourceCancelled = false;
    const settlements: string[] = [];
    const aborter = new AbortController();
    const upstream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(answer)}\n`)); },
      cancel() { sourceCancelled = true; },
    });
    const response = guardCurrentInformationStream(new Response(upstream), f.search, {
      required: true, language: 'en', executionId, signal: aborter.signal,
      onValidated: async () => { settlements.push('completed'); },
      onTerminated: async (reason) => { settlements.push(`released:${reason}`); },
    });
    const downstream = response.body!.getReader();
    if (abortRequest) {
      aborter.abort();
      // The read-status annotation can already be queued before abort. It is
      // not customer answer content; drain it and assert terminal closure.
      let next = await downstream.read();
      while (!next.done) {
        assert.match(new TextDecoder().decode(next.value), /^8:/u);
        next = await downstream.read();
      }
      assert.equal(next.done, true, 'request abort must close the downstream too');
    } else await downstream.cancel();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(sourceCancelled, true);
    assert.deepEqual(settlements, ['released:cancelled']);
    downstream.releaseLock();
  }
});

test('upstream read failure is provider-owned and never reaches the successful usage callback', async () => {
  const f = fixture(); await f.search.prepare();
  const settlements: string[] = [];
  const response = guardCurrentInformationStream(new Response(new ReadableStream({
    start(controller) { controller.error(new Error('fixture transport interrupted')); },
  })), f.search, { required: true, language: 'en', executionId,
    onValidated: async () => { settlements.push('completed'); },
    onTerminated: async (reason) => { settlements.push(`released:${reason}`); },
  });
  assert.match(await response.text(), /PROVIDER_STREAM_FAILED/);
  assert.deepEqual(settlements, ['released:provider_error']);
});

test('ordinary Chat stays incremental but its completion callback waits for the wire terminal', async () => {
  const f = fixture('Explain photosynthesis');
  const settlements: string[] = [];
  let upstream!: ReadableStreamDefaultController<Uint8Array>;
  const response = guardCurrentInformationStream(new Response(new ReadableStream<Uint8Array>({
    start(controller) { upstream = controller; controller.enqueue(new TextEncoder().encode('0:"Stable explanation."\n')); },
  })), f.search, { required: false, language: 'en', executionId,
    onValidated: async () => { settlements.push('completed'); },
    onTerminated: async () => { settlements.push('released'); },
  });
  const reader = response.body!.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /Stable explanation/);
  assert.deepEqual(settlements, []);
  upstream.enqueue(new TextEncoder().encode('d:{"finishReason":"stop"}\n')); upstream.close();
  while (!(await reader.read()).done) { /* Drain terminal frames. */ }
  assert.deepEqual(settlements, ['completed']);
  assert.deepEqual(f.counts(), [0, 0]);
  const routeSource = readFileSync(new URL('../../app/api/generate/chat/route.ts', import.meta.url), 'utf8');
  assert.match(routeSource, /finishAfterVerification = finishCompletion;/);
  assert.doesNotMatch(routeSource, /else await finishCompletion\(\)/);
  reader.releaseLock();
});

test('Arabic/French artifact evidence renders server-owned citations and never exposes source tokens', () => {
  for (const [language, request, content] of [
    ['ar', 'اخر نماذج AcmeNova', 'تتضمن نماذج AcmeNova الحالية نماذج للتفكير ومهام عامة. [[source:S1]]'],
    ['fr', 'modèles actuels AcmeNova', 'AcmeNova propose des modèles de raisonnement et généralistes. [[source:S1]]'],
  ] as const) {
    const result = evaluateCurrentOutput({ text: '', parts: [document(content)], request, hits, language, now });
    assert.equal(result.accepted, true);
    assert.equal(result.citationsCount, 1);
    assert.doesNotMatch(JSON.stringify(result.parts), /\[\[source:|&#x20;/);
  }
});

test('current presentation cannot bypass verification through a cached chart reference', () => {
  const doc = document();
  const part: ChatMessagePart = { type: 'presentation', artifact: {
    ...('artifact' in doc ? doc.artifact : {}), type: 'presentation',
    slides: [{ id: 'slide-1', layout: 'content', variant: 'chart', title: 'Current models',
      blocks: [{ kind: 'text', text: answer }, { kind: 'chart', chartId: 'unverified-cached-chart' }] }],
  } as Extract<ChatMessagePart, { type: 'presentation' }>['artifact'] };
  assert.equal(evaluateCurrentOutput({ text: '', parts: [part], hits,
    request: 'current AcmeNova models', language: 'en', now }).reason, 'expected_answer_missing');
});
