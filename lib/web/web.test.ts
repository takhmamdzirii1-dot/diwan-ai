import assert from 'node:assert/strict';
import test from 'node:test';
import { selectArtifactTools, selectWebContextTool } from '@/lib/artifacts/tool-registry';
import { optionalWebContext, searchContextForRequest, webContextForRequest } from './context.server';
import { BraveWebSearch, orchestrateWebSearch, SearchProviderError, searchWeb, TavilyWebSearch,
  type WebSearchProvider } from './search.server';
import { budgetWarning, type SearchHealthStore } from './search-health.server';
import { decideWebSearch, decideWebSearchWithHistory } from './selection';
import { readPublicWebPage, resolvePublicWebUrl } from './url-reader.server';
import { answerUsesOnlySearchSources, groundedSearchSummary, guardSearchDataStream, searchEvidence, usableSearchSynthesis } from './evidence';

const publicDns = async () => [{ address: '93.184.215.14', family: 4 }];

test('Tool Registry activates web only on an explicit relevant request, without replacing UAR', () => {
  assert.deepEqual(selectWebContextTool('Search the web for launch trends'),
    { kind: 'web_search', query: 'launch trends' });
  assert.deepEqual(selectWebContextTool('اقرأ https://example.org/report'),
    { kind: 'read_url', url: 'https://example.org/report' });
  assert.deepEqual(selectWebContextTool('Create a presentation from https://example.org/report'),
    { kind: 'read_url', url: 'https://example.org/report' });
  assert.deepEqual(selectArtifactTools('Create a presentation from https://example.org/report').names,
    ['create_presentation']);
  assert.equal(selectWebContextTool('What happened today?'), null);
  assert.equal(selectWebContextTool('Here is https://example.org/report'), null);
  assert.equal(selectWebContextTool('Do not read https://example.org/report'), null);
  assert.equal(selectWebContextTool('Search the web for API_KEY=private-value'), null);
});

test('search decision keeps ordinary Chat at zero search calls and routes current/URL requests', () => {
  for (const text of ['Write a poem about the ocean', 'Explain how recursion works',
    'What is photosynthesis?', 'Summarize these notes', 'Calculate 2 + 2'])
    assert.deepEqual(decideWebSearch(text), { path: 'none' });
  assert.deepEqual(decideWebSearch('Search the web for launch trends'),
    { path: 'required', tool: { kind: 'web_search', query: 'launch trends' } });
  assert.deepEqual(decideWebSearch('What happened today?'),
    { path: 'required', tool: { kind: 'web_search', query: 'What happened today?' } });
  assert.deepEqual(decideWebSearch('اقرأ https://example.org/report'),
    { path: 'required', tool: { kind: 'read_url', url: 'https://example.org/report' } });
  assert.deepEqual(decideWebSearch('Which laptop is best for travel?'), { path: 'optional' });
  assert.deepEqual(decideWebSearch('ما هو أحدث إصدار من Node.js الآن؟'),
    { path: 'required', tool: { kind: 'web_search', query: 'ما هو أحدث إصدار من Node.js الآن؟' } });
  assert.deepEqual(decideWebSearch('Explain how Node.js works'), { path: 'none' });
  assert.deepEqual(decideWebSearch('ابحث لي عن آخر أخبار OpenAI اليوم'),
    { path: 'required', tool: { kind: 'web_search', query: 'آخر أخبار OpenAI اليوم' } });
});

test('search evidence preserves exact source URL/date and never promotes older results to today', async () => {
  const hits = [{ title: 'Older update', url: 'https://example.org/update', description: 'A verified excerpt.',
    publishedAt: '2026-09-27', source: 'example.org', provider: 'brave' }];
  const now = new Date('2026-09-28T12:00:00Z');
  const evidence = searchEvidence(hits, 'ابحث عن آخر أخبار اليوم', now);
  assert.equal(evidence.publishedToday, false);
  assert.match(evidence.text, /No retrieved source has a verified publication date of 2026-09-28/);
  assert.match(evidence.text, /Published: 2026-09-27/);
  const summary = groundedSearchSummary(hits, 'news today', now);
  assert.match(summary, /could not verify the current fact/);
  assert.doesNotMatch(summary, /verified as published today|Brave|Tavily|^- /m);
  assert.equal(answerUsesOnlySearchSources('Today according to [Made up](https://fake.example/)', hits, 'news today', now), false);
  const response = new Response(`0:${JSON.stringify('Today according to a made-up source.')}\ne:{"finishReason":"stop"}\n`,
    { headers: { 'X-Vercel-AI-Data-Stream': 'v1' } });
  const guarded = await guardSearchDataStream(response, hits, 'news today', now);
  assert.match(await guarded.text(), /could not verify the current fact/);
});

test('search-answer stream uses retrieved evidence even if model prose names an unreturned source', async () => {
  const hits = [{ title: 'Official notes', url: 'https://example.org/release', description: 'Version 1.2.',
    publishedAt: '2026-09-27', source: 'example.org' }];
  const now = new Date('2026-09-28T12:00:00Z');
  const valid = `See [Official notes](https://example.org/release) for version 1.2.`;
  assert.equal(answerUsesOnlySearchSources(valid, hits, 'latest release', now), true);
  assert.equal(answerUsesOnlySearchSources('See [Fake](https://fake.example/release).', hits, 'latest release', now), false);
  assert.equal(answerUsesOnlySearchSources('According to an unlinked mystery source...', hits, 'latest release', now), false);
  const response = new Response(`0:${JSON.stringify(`${valid} According to an unreturned source, version 9 is out.`)}\nd:{"finishReason":"stop"}\n`);
  const guarded = await (await guardSearchDataStream(response, hits, 'latest release', now)).text();
  assert.match(guarded, /could not verify the current fact/);
  assert.doesNotMatch(guarded, /unreturned source|version 9/);
  const empty = await (await guardSearchDataStream(new Response(`0:${JSON.stringify('Made-up news')}\n`), [], 'news today', now)).text();
  assert.match(empty, /could not verify the current fact/);
  assert.doesNotMatch(empty, /Made-up news/);
});

test('search answers prefer a relevant primary source, cite at most three, and list only on request', () => {
  const now = new Date('2026-09-28T12:00:00Z');
  const hits = [
    { title: 'Third-party guess', url: 'https://example.net/node', description: 'Node.js might be version 19.', publishedAt: '2026-09-27' },
    { title: 'Node.js release notes', url: 'https://nodejs.org/en/blog/release', description: 'Node.js Current 26.1.0; LTS 24.4.0.', publishedAt: '2026-09-26', verifiedPage: true },
    { title: 'Another story', url: 'https://other.example/story', description: 'Some unrelated release.', publishedAt: '2026-09-25' },
    { title: 'Fourth story', url: 'https://fourth.example/story', description: 'Yet another release.', publishedAt: '2026-09-24' },
  ];
  const answer = groundedSearchSummary(hits, 'latest Node.js version now', now);
  assert.match(answer, /Current release is 26\.1\.0.*LTS release is 24\.4\.0/);
  assert.match(answer, /https:\/\/nodejs\.org/);
  assert.doesNotMatch(answer, /Node\.js might|Node\.js 26\.1\.0 is available/);
  assert.equal((answer.match(/\]\(https:\/\//g) ?? []).length, 1);
  assert.doesNotMatch(answer, /^- /m);
  const raw = groundedSearchSummary(hits, 'show the raw search results for Node.js', now);
  assert.match(raw, /^- /m);
  assert.equal((raw.match(/\]\(https:\/\//g) ?? []).length, 3);
  assert.equal(usableSearchSynthesis('Version 19 is reported. [Third-party guess](https://example.net/node)',
    hits, 'latest Node.js version now', now, 'en'), false);
});

test('today answers use only verified today-dated evidence when it exists', () => {
  const now = new Date('2026-09-28T12:00:00Z');
  const hits = [
    { title: 'Older story', url: 'https://example.org/old', description: 'An older fact.', publishedAt: '2026-09-27' },
    { title: 'Today story', url: 'https://example.org/today', description: 'A confirmed update today.', publishedAt: '2026-09-28', verifiedPage: true },
  ];
  const answer = groundedSearchSummary(hits, 'OpenAI news today', now);
  assert.match(answer, /https:\/\/example\.org\/today/);
  assert.doesNotMatch(answer, /An older fact|\/old/);
});

test('same-call search synthesis answers in resolved Arabic and French without copying English snippets', async () => {
  const now = new Date('2026-09-28T12:00:00Z');
  const hits = [{ title: 'Node.js release notes', url: 'https://nodejs.org/en/blog/release',
    description: 'Node.js 26.1.0 is available. The release includes fixes.', publishedAt: '2026-09-28', verifiedPage: true }];
  const citation = '[Node.js release notes](https://nodejs.org/en/blog/release)';
  const arabic = `الإصدار الأحدث الموثّق هو Node.js 26.1.0. ${citation}`;
  const french = `La version publiée est Node.js 26.1.0. ${citation}`;
  for (const [request, language, answer] of [
    ['ما هو latest version of Node.js الآن؟', 'ar', arabic],
    ['Quelle est la dernière version de Node.js ?', 'fr', french],
  ] as const) {
    assert.equal(usableSearchSynthesis(answer, hits, request, now, language), true);
    const stream = new Response(`0:${JSON.stringify(answer)}\nd:{"finishReason":"stop"}\n`);
    const result = await (await guardSearchDataStream(stream, hits, request, now, language)).text();
    assert.match(result, /26\.1\.0/);
    assert.doesNotMatch(result, /The release includes fixes/);
  }
  assert.equal(usableSearchSynthesis(`Node.js 26.1.0 is available. ${citation}`, hits,
    'ما هو أحدث إصدار من Node.js؟', now, 'ar'), false);
});

test('explicit English override and unsupported claims fail safely without another model call', async () => {
  const now = new Date('2026-09-28T12:00:00Z');
  const hits = [{ title: 'Node.js release notes', url: 'https://nodejs.org/en/blog/release',
    description: 'Node.js Current 26.1.0 is available.', publishedAt: '2026-09-28', verifiedPage: true }];
  const request = 'ما هو أحدث إصدار من Node.js؟ Answer in English.';
  const valid = 'The release note identifies version 26.1.0. [Node.js release notes](https://nodejs.org/en/blog/release)';
  assert.equal(usableSearchSynthesis(valid, hits, request, now, 'en'), true);
  assert.equal(usableSearchSynthesis('Node.js Current 26.1.0 is available. [Node.js release notes](https://nodejs.org/en/blog/release)',
    hits, request, now, 'en'), false);
  const invented = 'The latest is version 99.0.0. [Node.js release notes](https://nodejs.org/en/blog/release)';
  assert.equal(usableSearchSynthesis(invented, hits, request, now, 'en'), false);
  const result = await (await guardSearchDataStream(new Response(`0:${JSON.stringify(invented)}\n`), hits,
    request, now, 'en')).text();
  assert.match(result, /Current release is 26\.1\.0/);
  assert.doesNotMatch(result, /99\.0\.0/);
});

test('English question stays English when a retrieved source is Arabic', async () => {
  const now = new Date('2026-09-28T12:00:00Z');
  const hits = [{ title: 'إعلان رسمي', url: 'https://example.org/release',
    description: 'صدر الإصدار 26.1.0 اليوم.', publishedAt: '2026-09-28', verifiedPage: true }];
  const answer = 'The announcement reports version 26.1.0. [إعلان رسمي](https://example.org/release)';
  assert.equal(usableSearchSynthesis(answer, hits, 'What is the latest version now?', now, 'en'), true);
  const guarded = await (await guardSearchDataStream(new Response(`0:${JSON.stringify(answer)}\n`), hits,
    'What is the latest version now?', now, 'en')).text();
  assert.match(guarded, /The announcement reports version 26\.1\.0/);
});

test('fresh facts verify a primary page and discard a conflicting secondary snippet', async () => {
  const request = 'ما هو أحدث إصدار من Node.js الآن؟';
  const now = new Date('2026-09-28T12:00:00Z');
  const readUrls: string[] = [];
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:test', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Version checker: Node.js 20.20.0', url: 'https://versions.example/node',
        description: 'The current version is 20.20.0.' },
      { title: 'Older official release', url: 'https://nodejs.org/en/blog/release/v20',
        description: 'Node.js 20.20.0 release notes.', publishedAt: '2026-09-27' },
      { title: 'Node.js downloads', url: 'https://nodejs.org/en/download',
        description: 'Search excerpt is not verification.' },
    ] }),
    read: async (url) => { readUrls.push(url); return { sourceId: url, name: 'Official downloads',
      mimeType: 'text/markdown', text: url.includes('/blog/')
        ? 'Node.js release notes: Current 20.20.0.' : 'Node.js downloads: Current 26.1.0. LTS 24.4.0.' }; },
  });
  assert.deepEqual(readUrls, ['https://nodejs.org/en/download', 'https://nodejs.org/en/blog/release/v20']);
  assert.equal(result.hits.length, 2);
  assert.equal(result.hits[0].url, 'https://nodejs.org/en/download');
  assert.equal(result.hits[0].verifiedPage, true);
  assert.match(result.context, /Current 26\.1\.0/);
  assert.doesNotMatch(result.context, /Version checker/);
  const fallback = groundedSearchSummary(result.hits, request, now, 'ar');
  assert.match(fallback, /26\.1\.0.*24\.4\.0/);
  assert.doesNotMatch(fallback, /20\.20\.0/);
  const stale = 'الإصدار الأحدث هو 20.20.0. [Older official release](https://nodejs.org/en/blog/release/v20)';
  assert.equal(usableSearchSynthesis(stale, result.hits, request, now, 'ar'), false);
  const guarded = await (await guardSearchDataStream(new Response(`0:${JSON.stringify(stale)}\n`),
    result.hits, request, now, 'ar')).text();
  assert.match(guarded, /26\.1\.0/);
  assert.doesNotMatch(guarded, /20\.20\.0/);
});

test('fresh facts remain uncertain when primary read fails or no primary result exists', async () => {
  const request = 'latest Node.js version now';
  let reads = 0;
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:test', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Old version checker', url: 'https://versions.example/node', description: 'Node.js 20.20.0' },
      { title: 'Node.js downloads', url: 'https://nodejs.org/en/download', description: 'Node.js 26.1.0' },
    ] }),
    read: async () => { reads++; throw new Error('URL_UNAVAILABLE'); },
  });
  assert.equal(reads, 1);
  assert.deepEqual(result.hits, []);
  assert.match(groundedSearchSummary(result.hits, request), /could not verify the current fact/);
  assert.doesNotMatch(result.context, /20\.20\.0|26\.1\.0/);
});

test('confirmation follow-up re-verifies only the preceding answered fresh claim', () => {
  const fresh = 'ما هو أحدث إصدار من Node.js الآن؟';
  const history = [{ role: 'user', content: fresh },
    { role: 'assistant', content: 'الإصدار الأحدث 20.20.0.' }];
  assert.deepEqual(decideWebSearchWithHistory('هل أنت متأكد؟', history), {
    decision: { path: 'required', tool: { kind: 'web_search', query: fresh } }, evidenceRequest: fresh,
  });
  assert.deepEqual(decideWebSearchWithHistory('are you sure?', [
    { role: 'user', content: 'Explain recursion' }, { role: 'assistant', content: 'It calls itself.' },
  ]), { decision: { path: 'none' }, evidenceRequest: 'are you sure?' });
  assert.deepEqual(decideWebSearchWithHistory('هل أنت متأكد؟', [{ role: 'user', content: fresh }]),
    { decision: { path: 'none' }, evidenceRequest: 'هل أنت متأكد؟' });
});

test('Brave and Tavily preserve publication dates when returned, without inventing missing dates', async () => {
  const brave = new BraveWebSearch('test', async () => Response.json({ web: { results: [
    { title: 'A', url: 'https://example.org/a', description: 'A', page_age: '2026-09-27T10:00:00Z' }] } }));
  const tavily = new TavilyWebSearch('test', async () => Response.json({ results: [
    { title: 'B', url: 'https://example.org/b', content: 'B', published_date: '2026-09-26' },
    { title: 'Undated', url: 'https://example.org/c', content: 'C' }] }));
  assert.equal((await brave.search('query', 5))[0].publishedAt, '2026-09-27');
  assert.deepEqual((await tavily.search('query', 5)).map((item) => item.publishedAt), ['2026-09-26', null]);
});

function health() {
  const blocked = new Map<string, number>(); const counts = new Map<string, number>();
  const store: SearchHealthStore = {
    async claim(id, budget) {
      if ((blocked.get(id) ?? 0) > Date.now()) return 'cooldown';
      if (budget !== null && (counts.get(id) ?? 0) >= budget) return 'budget';
      counts.set(id, (counts.get(id) ?? 0) + 1); return 'ok';
    },
    async record(id, result) {
      if (result.success) blocked.delete(id);
      else if (result.cooldownSeconds) blocked.set(id, Date.now() + result.cooldownSeconds * 1000);
    },
  };
  return { store, blocked, counts };
}

test('ordered chain uses one request on success and one sequential fallback on eligible failures', async () => {
  for (const category of ['quota_exhausted', 'rate_limited', 'unavailable'] as const) {
    const called: string[] = []; const state = health();
    const first: WebSearchProvider = { id: 'brave', async search() { called.push('brave');
      throw new SearchProviderError(category); } };
    const second: WebSearchProvider = { id: 'tavily', async search() { called.push('tavily');
      return [{ title: 'Result', url: 'https://example.org/', description: 'Relevant' }]; } };
    const hits = await orchestrateWebSearch('current release', { providers: [first, second], health: state.store });
    assert.equal(hits.length, 1); assert.deepEqual(called, ['brave', 'tavily']);
    await orchestrateWebSearch('another release', { providers: [first, second], health: state.store });
    assert.deepEqual(called, ['brave', 'tavily', 'tavily'], 'cooldown skips unhealthy primary');
    state.blocked.set('brave', Date.now() - 1);
    await orchestrateWebSearch('later release', { providers: [first, second], health: state.store });
    assert.deepEqual(called.slice(-2), ['brave', 'tavily'], 'cooldown recovers');
  }
  const called: string[] = []; const state = health();
  const success: WebSearchProvider = { id: 'brave', async search() { called.push('brave');
    return [{ title: 'A', url: 'https://example.org/', description: 'B' }]; } };
  await orchestrateWebSearch('current release', { providers: [success, { id: 'tavily', async search() {
    called.push('tavily'); return []; } }], health: state.store });
  assert.deepEqual(called, ['brave']);
});

test('all providers unavailable is safe; optional search can continue without claiming live verification', async () => {
  const failed: WebSearchProvider = { id: 'brave', async search() { throw new SearchProviderError('timeout'); } };
  await assert.rejects(orchestrateWebSearch('latest news', { providers: [failed], health: health().store }),
    /WEB_SEARCH_UNAVAILABLE/);
  assert.deepEqual(await optionalWebContext('latest news', 'Which source is best?', async () => {
    throw new Error('WEB_SEARCH_UNAVAILABLE');
  }), { status: 'unavailable', context: '' });
  await assert.rejects(orchestrateWebSearch('query', { providers: [] }), /WEB_SEARCH_UNCONFIGURED/);
  await assert.rejects(orchestrateWebSearch('API_KEY=private-value', { providers: [failed], health: health().store }),
    /WEB_SEARCH_INVALID_QUERY/);
});

test('budget warnings use only configured local request budget, never invented provider remaining quota', async () => {
  assert.equal(budgetWarning(10, null), 'none');
  assert.equal(budgetWarning(79, 100), 'none');
  assert.equal(budgetWarning(80, 100), 'warning');
  assert.equal(budgetWarning(95, 100), 'critical');
  assert.equal(budgetWarning(100, 100), 'exhausted');
  const state = health(); let called = 0;
  await assert.rejects(orchestrateWebSearch('latest release', { providers: [{ id: 'brave', async search() {
    called++; return []; } }], health: state.store, budget: () => 0 }), /WEB_SEARCH_UNAVAILABLE/);
  assert.equal(called, 0);
});

test('Tavily and Brave normalize to the same provider-independent result shape', async () => {
  const brave = new BraveWebSearch('test', async () => Response.json({ web: { results: [
    { title: 'Example', url: 'https://example.org/?token=private', description: '<b>Summary</b>' }] } }));
  const tavily = new TavilyWebSearch('test', async (_input, init) => {
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test');
    return Response.json({ results: [{ title: 'Example', url: 'https://example.org/?token=private', content: '<b>Summary</b>' }] });
  });
  assert.deepEqual(await brave.search('query', 5), await tavily.search('query', 5));
});

test('URL reader rejects internal, credentialed, unsafe-query, and DNS-private targets', async () => {
  for (const url of ['http://example.org/file', 'https://localhost/file', 'https://admin:pass@example.org/',
    'https://example.org/?access_token=secret', 'https://127.0.0.1/', 'https://metadata.google.internal/']) {
    await assert.rejects(resolvePublicWebUrl(url, publicDns), /URL_UNSAFE/);
  }
  await assert.rejects(resolvePublicWebUrl('https://example.org/report',
    async () => [{ address: '10.0.0.7', family: 4 }]), /URL_UNSAFE/);
  await assert.rejects(resolvePublicWebUrl('https://example.org/report',
    async () => [{ address: '93.184.215.14', family: 4 }, { address: '169.254.169.254', family: 4 }]), /URL_UNSAFE/);
  const target = await resolvePublicWebUrl('https://example.org/report?id=2#part', publicDns);
  assert.equal(target.address, '93.184.215.14');
  assert.equal(target.url.hash, '');
  assert.equal(target.url.search, '?id=2');
});

test('URL reader validates each redirect and extracts bounded non-script text', async () => {
  const page = await readPublicWebPage('https://example.org/report?view=full', {
    resolver: publicDns,
    load: async (target) => target.url.pathname === '/report'
      ? { status: 302, location: '/article', contentType: '', body: '' }
      : { status: 200, contentType: 'text/html',
        body: '<script>secret script text</script><h1>Quarterly report</h1><p>Revenue increased.</p>' },
  });
  assert.match(page.text, /Quarterly report/);
  assert.match(page.text, /Revenue increased/);
  assert.doesNotMatch(page.text, /secret script text|view=full/);
  await assert.rejects(readPublicWebPage('https://example.org/report', {
    resolver: publicDns,
    load: async () => ({ status: 302, location: 'http://127.0.0.1/private', contentType: '', body: '' }),
  }), /URL_UNSAFE/);
});

test('Brave provider adapter is bounded and keeps its server key out of results', async () => {
  let called = 0;
  const provider = new BraveWebSearch('test-key-not-for-model', async (input, init) => {
    called++;
    assert.match(String(input), /^https:\/\/api\.search\.brave\.com\/res\/v1\/web\/search\?/);
    assert.equal(new URL(String(input)).searchParams.get('count'), '5');
    assert.equal((init?.headers as Record<string, string>)['X-Subscription-Token'], 'test-key-not-for-model');
    return Response.json({ web: { results: [{ title: 'Example result', url: 'https://example.org/a?token=hidden',
      description: '<b>Relevant</b> summary' }] } });
  });
  const result = await searchWeb('launch trends', provider);
  assert.equal(called, 1);
  assert.match(result.text, /Relevant summary/);
  assert.doesNotMatch(result.text, /test-key-not-for-model|token=hidden/);
  await assert.rejects(searchWeb('x', null), /WEB_SEARCH_UNCONFIGURED/);
});

test('web result follows Conversation Resources path and sends only bounded untrusted content', async () => {
  const text = `${'Unrelated paragraph. '.repeat(500)}\n\nLaunch timeline: October.\n\n${'Other topic. '.repeat(500)}`;
  const context = await webContextForRequest({ kind: 'read_url', url: 'https://example.org/report' },
    'Summarize the launch timeline from https://example.org/report', {
      read: async () => ({ sourceId: 'https://example.org/report', name: 'Report',
        mimeType: 'text/markdown', text }),
      search: async () => { throw new Error('not selected'); },
    });
  assert.match(context, /Launch timeline: October/);
  assert.doesNotMatch(context, /Unrelated paragraph|Other topic|public-web|web_url/);
});
