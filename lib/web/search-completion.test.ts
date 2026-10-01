import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFreshEvidenceBundle, evaluateSearchSynthesis, freshFactKey, groundedSearchSummary, searchEvidence } from './evidence';
import { searchContextForRequest } from './context.server';
import { deliverResearchAnswer } from './research-answer';
import { createChatSearch } from './chat-search.server';
import { currentInformationPolicy, decideWebSearchWithHistory } from './selection';
import { readPublicWebPage } from './url-reader.server';
import { driverRequestScope, driverEvidenceMatchesScope } from './driver-scope';
import { explicitAnnouncement } from './news-evidence';
import type { WebSearchHit } from './search.server';
import { guardCurrentInformationStream } from './output-stream.server';
import { consumeCanonicalChatStream } from '@/lib/chat/client-finalization';
import { serializeChatSession, chatRequestMessages } from '@/lib/chat/message-history';
import { precedingSearchReference } from './search-context';
import { loadSearchSubjectContext, loadSearchTurnContext } from './search-context.server';

const now = new Date('2026-09-30T12:00:00Z');

// Sanitized public evidence and provider text captured for execution 82bf1180.
// Replay upstream output: no model, search, URL, or financial calls in this test.
test('recorded French news accepts supported prose formatting but rejects unregistered references', async () => {
  const request = 'Donne-moi jusqu’à 3 actualités sur les annonces de nouveaux modèles d’IA cette semaine, avec la date de chaque annonce.';
  const evidence: WebSearchHit = {
    title: 'Vous avez raté la conférence OpenAI DevDay ? On vous résume les annonces (dots, GPT-6.1, etc.) - Numerama',
    url: 'https://numerama.com/tech/2342271-openai-dev-day-2026-toutes-les-annonces.html',
    description: 'OpenAI a tenu ce 29 septembre son DevDay 2026. Au programme : dots, des agents IA toujours actifs, un nouveau modèle GPT-6.1 Sol, des outils collaboratifs pour concurrencer Microsoft et Google, et un abonnement à 500 dollars par mois.',
    publishedAt: '2026-09-29', announcementDate: '2026-09-29', articleEvidence: true,
    evidenceId: 'S1', evidenceLevel: 'corroborated',
  };
  const item = '1. **OpenAI DevDay 2026** – Annonce faite le **29 septembre 2026**.\n   - Nouveaux modèles et outils : **GPT-6.1 Sol**, des agents IA « toujours actifs », des outils collaboratifs positionnés face à Microsoft et Google, et un abonnement à **500 $/mois** [[source:S1]].';
  const recorded = 'Je dispose maintenant d’une source confirmant une annonce récente. Voici ce qui est vérifié pour cette semaine (semaine du 29 septembre 2026) :\n\n' + item + '\n\nC’est l’unique annonce de modèle d’IA datée de cette semaine que je peux citer de manière vérifiée. Si vous souhaitez que j’élargisse la recherche à d’autres annonces (autres fabricants, autre semaine), dites-le-moi.';
  for (const [answer, accepted] of [[recorded, true], [item, true], [item.replace('S1', 'S99'), false]] as const) {
    const search = createChatSearch({ decision: { path: 'required', tool: { kind: 'web_search', query: request } },
      request, language: 'fr', now, nativeToolsSupported: false, searchConfigured: true,
      operations: { search: async () => ({ sourceId: 'recorded', name: 'Search', mimeType: 'text/markdown', text: '', hits: [evidence] }),
        read: async () => { throw new Error('URL_UNAVAILABLE'); } } });
    assert.equal((await search.prepare())?.status, 'ok');
    let finalized = 0; let finalAccepted: unknown;
    // Mirror SDK onFinish, then replay the SAME complete output through the wire gate.
    search.evaluateOutput(answer, []);
    const response = guardCurrentInformationStream(new Response(`0:${JSON.stringify(answer)}\nd:{"finishReason":"stop"}\n`), search,
      { required: true, language: 'fr', executionId: '82bf1180-d8ad-4124-9d69-6875fc814385',
        operationId: '0060eac6-515b-45a0-85d6-2448dfb3cd2c',
        onValidated: async () => { finalized++; finalAccepted = search.snapshot().synthesisAccepted; } });
    let delivered = '';
    const status = await consumeCanonicalChatStream(response.body!, (delta) => { delivered += delta; });
    assert.equal(finalized, 1); assert.equal(finalAccepted, accepted);
    assert.equal(status, accepted ? 'completed' : 'unverified');
    if (accepted) { assert.match(delivered, /GPT-6\.1 Sol/); assert.match(delivered, /https:\/\/numerama.com\/tech\/2342271/); }
    else { assert.doesNotMatch(delivered, /source:S99|500/); assert.equal(search.contextForPersistence(), null); }
    assert.doesNotMatch(delivered, /\[\[source:|&#x20;/);
  }
});
const dual: WebSearchHit = { title: 'Acme live downloads', url: 'https://acme.com/fr/download/lts',
  description: 'Acme Current 8.2.0. LTS 7.1.0.', evidenceId: 'S1', evidenceLevel: 'primary_page',
  verifiedPage: true, contentComplete: true };

test('one dual-channel source honors explicit LTS in selection, synthesis context, fallback, and final guard', () => {
  for (const [request, language, answer] of [
    ['latest Acme LTS version now', 'en', 'The LTS release is 7.1.0. [[source:S1]]'],
    ['ما هو أحدث إصدار Acme LTS الآن؟', 'ar', 'أحدث إصدار LTS هو 7.1.0. [[source:S1]]'],
    ['Quelle est la dernière version LTS Acme maintenant ?', 'fr', 'La version LTS est 7.1.0. [[source:S1]]'],
  ] as const) {
    assert.equal(freshFactKey(dual.description, request), 'version:lts:7.1.0');
    const assessed = assessFreshEvidenceBundle([dual], request, '2026-09-30');
    assert.equal(assessed.factKey, 'version:lts:7.1.0');
    assert.equal(assessed.kind, 'primary_exact');
    const context = searchEvidence(assessed.hits, request, now).text;
    assert.match(context, /LTS 7\.1\.0/); assert.doesNotMatch(context, /Current 8\.2\.0/);
    assert.equal(evaluateSearchSynthesis(answer, assessed.hits, request, now, language).synthesisAccepted, true);
    assert.equal(evaluateSearchSynthesis(answer.replace('7.1.0', '8.2.0'), assessed.hits, request, now, language).synthesisAccepted, false);
    assert.equal(evaluateSearchSynthesis('Current is 8.2.0. [[source:S1]]', assessed.hits, request, now, 'en').synthesisAccepted, false);
    assert.match(groundedSearchSummary(assessed.hits, request, now, language), /LTS.*7\.1\.0/);
    assert.doesNotMatch(groundedSearchSummary(assessed.hits, request, now, language), /8\.2\.0/);
  }
  const request = 'latest Acme Current version now';
  assert.equal(freshFactKey(dual.description, request), 'version:current:8.2.0');
  assert.equal(evaluateSearchSynthesis('Current is 8.2.0. [[source:S1]]', [dual], request, now, 'en').synthesisAccepted, true);
});

test('generic versions do not assume Current/LTS conventions; old Current listing cannot prove latest LTS', () => {
  const plain = { ...dual, description: 'Latest Acme version 9.4.1.' };
  assert.equal(freshFactKey(plain.description, 'latest Acme version now'), 'version:latest:9.4.1');
  assert.equal(evaluateSearchSynthesis('The latest version is 9.4.1. [[source:S1]]', [plain],
    'latest Acme version now', now, 'en').synthesisAccepted, true);
  assert.equal(freshFactKey(plain.description, 'latest Acme LTS version now'), null);
  const archive = { ...dual, url: 'https://acme.com/blog/release', description:
    'Acme 6.5.0 (LTS) Sep 09, 2026. Acme 8.2.0 (Current) Sep 22, 2026. Acme 8.1.0 (Current) Sep 16, 2026.' };
  assert.equal(assessFreshEvidenceBundle([archive], 'latest Acme LTS version now', '2026-09-30').kind, 'insufficient');
  assert.equal(assessFreshEvidenceBundle([archive, dual], 'latest Acme LTS version now', '2026-09-30').factKey, 'version:lts:7.1.0');
});

test('retrieval keeps the original multilingual request and explicit channel scope', async () => {
  const request = 'ما هو أحدث إصدار Acme LTS الآن؟'; let query = '';
  const result = await searchContextForRequest(request, request, {
    search: async (value) => { query = value; return { sourceId: 'fixture', name: 'Search',
      mimeType: 'text/markdown', text: '', hits: [dual] }; }, read: async () => { throw new Error('URL_TOO_LARGE'); },
  });
  assert.equal(query, request);
  assert.equal(result.telemetry.evidenceQuality, 'search_observations');
  assert.match(result.evidence.text, /LTS 7\.1\.0/);
});

test('dated French news reads returned articles, not aggregate pages; event dates differ from publication/update', async () => {
  const request = 'Les dernières actualités Acme cette semaine, avec les dates des annonces, 5 nouvelles';
  const reads: string[] = []; let searches = 0;
  const articles = [1, 2, 3].map((id) => ({ title: `Acme annonce un produit ${id}`,
    url: `https://journal.example/2026/09/acme-annonce-produit-${id}`,
    description: 'Un article détaillé sur une annonce de produit Acme.', publishedAt: '2026-09-30' }));
  const result = await searchContextForRequest(request, request, {
    search: async () => { searches++; return { sourceId: 'fixture', name: 'Search', mimeType: 'text/markdown', text: '',
      hits: [{ title: 'Acme actualités', url: 'https://acme.com/news', description: 'Toutes les actualités et les annonces Acme.',
        publishedAt: '2026-09-30' }, ...articles] }; },
    read: async (url) => { reads.push(url); return { sourceId: url, name: 'Article', mimeType: 'text/markdown',
      text: 'Acme a lancé son produit le 29 septembre 2026. Le produit améliore les outils de création.',
      pagePublishedAt: '2026-09-30', pageUpdatedAt: '2026-09-30', contentComplete: true }; },
  });
  assert.equal(searches, 1); assert.deepEqual(reads, articles.slice(0, 2).map((hit) => hit.url));
  assert.equal(result.hits.length, 4); assert.equal(result.telemetry.evidenceQuality, 'page_and_search_observations');
  assert.equal(result.hits.filter((hit) => hit.verifiedPage).length, 2);
  assert.ok(result.hits.filter((hit) => hit.verifiedPage).every((hit) => hit.pagePublishedAt === '2026-09-30' && hit.pageUpdatedAt === '2026-09-30'));
  assert.match(result.evidence.text, /29 septembre 2026/);
  const answer = '1. Acme a annoncé son produit le 2026-09-29. [[source:S1]]\n2. Une autre annonce Acme date du 2026-09-29. [[source:S2]]';
  const evaluated = deliverResearchAnswer(answer, result.hits, 'fr');
  assert.equal(evaluated.accepted, true);
  assert.equal(deliverResearchAnswer(answer.replaceAll('S1', 'S99').replaceAll('S2', 'S99'), result.hits, 'fr').accepted, false);
});

test('publication dates are never inferred announcement dates; reader preserves metadata separately', async () => {
  assert.equal(explicitAnnouncement('Published 2026-09-30. Acme launched a new product.'), null);
  assert.equal(explicitAnnouncement('Acme launched its product on September 29, 2026.')?.date, '2026-09-29');
  const page = await readPublicWebPage('https://acme.com/blog/product-launch', {
    resolver: async () => [{ address: '93.184.216.34', family: 4 }], load: async () => ({ status: 200, contentType: 'text/html',
      body: '<head><meta content="2026-09-30" property="article:published_time"><script type="application/ld+json">{"dateModified":"2026-09-30"}</script></head><main>Acme launched its product on September 29, 2026.</main>' }) });
  assert.equal(page.pagePublishedAt, '2026-09-30'); assert.equal(page.pageUpdatedAt, '2026-09-30');
  assert.equal(explicitAnnouncement(page.text)?.date, '2026-09-29');
  const request = 'latest Acme news today with announcement dates';
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'fixture', name: 'Search', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Acme announcements', url: 'https://acme.com/news', publishedAt: '2026-09-30',
        description: 'The aggregate page contains various recent product announcements.' }] }),
    read: async () => ({ ...page, sourceId: 'https://acme.com/news', text: 'Published 2026-09-30. Acme launched a new product.' }),
  });
  assert.equal(result.hits.length, 1);
  assert.equal(result.hits[0].announcementDate ?? null, null);
  assert.match(result.context, /does not prove an event date/);
});

test('driver scope survives follow-ups without certifying historical snippets', async () => {
  let calls = 0; const request = 'latest NVIDIA RTX driver';
  const search = createChatSearch({ request, decision: currentInformationPolicy(request).decision, language: 'en',
    searchConfigured: true, nativeToolsSupported: true, operations: {
      search: async () => { calls++; throw new Error('not allowed'); }, read: async () => { calls++; throw new Error('not allowed'); } } });
  await search.prepare(); assert.equal(calls, 1);
  assert.deepEqual(driverRequestScope(request)?.missing, ['platform', 'channel']);
  const selection = decideWebSearchWithHistory('Windows 11 Game Ready', [], search.subjectForPersistence());
  assert.equal(selection.decision.path, 'required');
  assert.match(selection.evidenceRequest, /NVIDIA RTX driver.*Windows 11 Game Ready/);
  assert.match(selection.contextSubject!, /Windows 11 Game Ready/);
  const scope = driverRequestScope(selection.evidenceRequest)!;
  assert.deepEqual(scope.missing, []);
  assert.equal(driverEvidenceMatchesScope('Windows 11 Game Ready Current 600.10', scope), true);
  for (const text of ['Windows 10 Game Ready Current 600.10', 'Linux Game Ready Current 600.10',
    'Windows 11 Studio Current 600.10', 'Windows 11 Game Ready Latest Driver Version: ~ddVersion_td~']) {
    assert.equal(driverEvidenceMatchesScope(text, scope), false);
    assert.equal(freshFactKey(text, selection.evidenceRequest), null);
  }
  const old = { title: 'NVIDIA Windows 11 Game Ready driver', url: 'https://nvidia.com/blog/old-driver-release',
    publishedAt: '2026-01-01', description: 'Windows 11 Game Ready Current 600.10.', evidenceLevel: 'primary_search' as const };
  assert.equal(assessFreshEvidenceBundle([old], selection.evidenceRequest, '2026-09-30').kind, 'insufficient');
});

test('client stream -> persisted reload -> owned subject -> consecutive failed follow-ups -> new retrieval -> final client answer', async () => {
  const owner = 'qa-owner'; const original = 'ما هو أحدث إصدار Acme LTS الآن؟';
  const rows = new Map<string, { user_id: string; state: string; modality: string; execution_metadata: Record<string, unknown> }>();
  let previousId = '11111111-1111-4111-8111-111111111111';
  let messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; annotations?: unknown[] }> = [{ id: 'u0', role: 'user', content: original }];
  const subject = { version: 1, subject: original, fresh: true, mode: 'structured_fact', timeframe: '' };
  rows.set(previousId, { user_id: owner, state: 'failed', modality: 'chat', execution_metadata: {
    webValidationOutcome: 'rejected', searchSubjectContext: subject, searchTurnContext: { ...subject, sourceUrls: ['https://failed.example/'] } } });
  const read = async (id: string) => rows.get(id) ?? null;
  const reference = { type: 'vantra-search-context', executionId: previousId };
  messages.push({ id: 'a0', role: 'assistant', content: 'لم أتمكن من التحقق.', annotations: [reference] });
  let searchCount = 0;
  for (let turn = 1; turn <= 3; turn++) {
    // This is the actual Studio serialization boundary used on page reload.
    messages = JSON.parse(serializeChatSession(messages, () => []));
    const payload = chatRequestMessages([...messages, { role: 'user', content: 'هل أنت متأكد؟' }]);
    const ref = precedingSearchReference(payload.slice(0, -1))!; assert.equal(ref.executionId, previousId);
    assert.equal(await loadSearchTurnContext(owner, ref.executionId, read), null);
    assert.equal(await loadSearchSubjectContext('another-user', ref.executionId, read), null);
    const owned = await loadSearchSubjectContext(owner, ref.executionId, read);
    const selection = decideWebSearchWithHistory(payload.at(-1)!.content, payload.slice(0, -1), owned);
    assert.equal(selection.evidenceRequest, original); assert.equal(selection.decision.path, 'required');
    const search = createChatSearch({ decision: selection.decision, request: selection.evidenceRequest,
      contextSubject: selection.contextSubject, language: 'ar', now, nativeToolsSupported: false, searchConfigured: true,
      operations: { search: async () => { searchCount++; return { sourceId: 'fixture', name: 'Search',
        mimeType: 'text/markdown', text: '', hits: [dual] }; }, read: async () => { throw new Error('URL_TOO_LARGE'); } } });
    assert.equal((await search.prepare())?.status, 'ok');
    const id = `11111111-1111-4111-8111-11111111111${turn}`;
    const text = turn < 3 ? 'مرجع غير معروف. [[source:S99]]' : 'أحدث إصدار LTS هو 7.1.0. [[source:S1]]';
    const guarded = guardCurrentInformationStream(new Response(`0:${JSON.stringify(text)}\nd:{"finishReason":"stop"}\n`), search,
      { required: true, language: 'ar', executionId: id });
    let delivered = ''; let savedReference: unknown;
    const status = await consumeCanonicalChatStream(guarded.body!, (delta) => { delivered += delta; }, undefined,
      undefined, undefined, undefined, (value) => { savedReference = value; });
    assert.equal(status, turn < 3 ? 'unverified' : 'completed');
    assert.doesNotMatch(delivered, /مرجع غير معروف|\[\[source:/);
    if (turn === 3) assert.match(delivered, /7\.1\.0.*https:\/\/acme.com\/fr\/download\/lts/);
    else assert.equal(search.contextForPersistence(), null);
    assert.deepEqual(savedReference, { type: 'vantra-search-context', executionId: id });
    rows.set(id, { user_id: owner, state: turn < 3 ? 'failed' : 'completed', modality: 'chat',
      execution_metadata: { ...search.snapshot(), searchSubjectContext: search.subjectForPersistence(),
        searchTurnContext: search.contextForPersistence() } });
    messages.push({ id: `u${turn}`, role: 'user', content: 'هل أنت متأكد؟' },
      { id: `a${turn}`, role: 'assistant', content: delivered, annotations: [savedReference] });
    previousId = id;
  }
  assert.equal(searchCount, 3, 'one new retrieval per turn, never reuse failed evidence');
  assert.ok(await loadSearchTurnContext(owner, previousId, read));
});
