import assert from 'node:assert/strict';
import test from 'node:test';
import { selectArtifactTools, selectWebContextTool } from '@/lib/artifacts/tool-registry';
import { optionalWebContext, searchContextForRequest, webContextForRequest } from './context.server';
import { BraveWebSearch, orchestrateWebSearch, SearchProviderError, searchWeb, TavilyWebSearch,
  type WebSearchProvider } from './search.server';
import { budgetWarning, type SearchHealthStore } from './search-health.server';
import { decideWebSearch, decideWebSearchWithHistory } from './selection';
import { pinnedAddressLookup, readPublicWebPage, resolvePublicWebUrl } from './url-reader.server';
import { answerUsesOnlySearchSources, assessFreshEvidenceBundle, evidenceScore, groundedSearchSummary, guardSearchDataStream,
  searchEvidence, usableSearchSynthesis } from './evidence';

const publicDns = async () => [{ address: '93.184.215.14', family: 4 }];

test('pinned URL Reader DNS responds in both Node lookup shapes without changing the validated IP', () => {
  const lookup = pinnedAddressLookup('93.184.215.14', 4);
  lookup('example.org', { all: true }, (error, address) => {
    assert.equal(error, null);
    assert.deepEqual(address, [{ address: '93.184.215.14', family: 4 }]);
  });
  lookup('example.org', { all: false }, (error, address, family) => {
    assert.equal(error, null);
    assert.equal(address, '93.184.215.14');
    assert.equal(family, 4);
  });
});

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
        description: 'Old search excerpt: Current 20.20.0.' },
    ] }),
    read: async (url) => { readUrls.push(url); return { sourceId: url, name: 'Official downloads',
      mimeType: 'text/markdown', text: url.includes('/blog/')
        ? 'Node.js release notes: Current 20.20.0.' : 'Node.js downloads: Current 26.1.0. LTS 24.4.0.' }; },
  });
  assert.deepEqual(readUrls, ['https://nodejs.org/en/download', 'https://nodejs.org/en/blog/release/v20']);
  assert.equal(result.hits.length, 1);
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

test('official search evidence survives URL Reader failure and outranks stale secondary evidence', async () => {
  const request = 'ما هو أحدث إصدار من Node.js الآن؟';
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:test', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Old version checker', url: 'https://versions.example/node', description: 'Current 20.20.0.' },
      { title: 'Node.js downloads', url: 'https://nodejs.org/en/download',
        description: 'Current 26.1.0; LTS 24.4.0.' },
    ] }),
    read: async () => { throw new Error('URL_CONTENT_UNSUPPORTED'); },
  });
  assert.deepEqual(result.diagnosticStages, ['primary_candidate_found', 'primary_url_read_failed',
    'official_search_result_evidence_used']);
  assert.equal(result.hits[0].evidenceLevel, 'primary_search');
  assert.match(result.context, /Official search-result evidence.*Current 26\.1\.0/s);
  assert.doesNotMatch(result.context, /20\.20\.0/);
  const answer = groundedSearchSummary(result.hits, request, new Date('2026-09-28T12:00:00Z'), 'ar');
  assert.match(answer, /26\.1\.0.*24\.4\.0/);
  assert.match(answer, /https:\/\/nodejs\.org\/en\/download/);
  assert.doesNotMatch(answer, /20\.20\.0/);
});

test('exact official Brave evidence does not spend a Tavily fallback request', async () => {
  let fallbackCalls = 0;
  const request = 'latest Acme version now';
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:brave', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Acme downloads', url: 'https://acme.com/downloads', description: 'Current 8.2.0.' },
    ] }),
    fallback: async () => { fallbackCalls++; throw new Error('should not search'); },
    read: async () => { throw new Error('URL_TOO_LARGE'); },
  });
  assert.equal(fallbackCalls, 0);
  assert.equal(result.hits[0].evidenceId, 'S1');
  assert.equal(result.telemetry.finalEvidenceQuality, 'primary_exact');
  assert.equal(result.telemetry.fallbackUsed, false);
});

test('localized official current indexes remain exact primary evidence without publication dates', () => {
  const request = 'latest Example version now';
  for (const locale of ['en', 'fr']) {
    const result = assessFreshEvidenceBundle([{ title: 'Example current downloads',
      url: `https://example.com/${locale}/download/current`, description: 'Current 26.10.0.' }],
    request, '2026-09-29');
    assert.equal(result.kind, 'primary_exact');
    assert.equal(result.factKey, 'version:current:26.10.0');
    assert.equal(result.hits[0].url, `https://example.com/${locale}/download/current`);
  }
  for (const path of ['/en/releases', '/docs/versions', '/en/status']) {
    const result = assessFreshEvidenceBundle([{ title: 'Example current releases',
      url: `https://example.com${path}`, description: 'Current 26.10.0.' }], request, '2026-09-29');
    assert.equal(result.kind, 'primary_exact');
  }
});

test('Arabic latest-version request accepts an undated localized official result after URL read failure', async () => {
  const request = 'ما هو أحدث إصدار من Node.js الآن؟';
  let fallbackCalls = 0;
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:brave', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Node.js current downloads', url: 'https://nodejs.org/en/download/current',
        description: 'Current 26.10.0; LTS 24.21.0.' },
    ] }),
    fallback: async () => { fallbackCalls++; throw new Error('not needed'); },
    read: async () => { throw new Error('URL_TOO_LARGE'); },
  });
  assert.equal(fallbackCalls, 0);
  assert.equal(result.telemetry.finalEvidenceQuality, 'primary_exact');
  assert.match(groundedSearchSummary(result.hits, request, new Date(), 'ar'), /26\.10\.0.*24\.21\.0/);
});

test('prefixed evergreen paths exclude historical release articles', () => {
  const request = 'latest Example version now';
  const old = { title: 'Example 26.8.2 (Current)',
    url: 'https://example.com/en/blog/release/v26.8.2',
    description: '26.8.2 (Current).', publishedAt: '2026-09-09', verifiedPage: true };
  const oldOnly = assessFreshEvidenceBundle([old], request, '2026-09-29');
  assert.equal(oldOnly.kind, 'insufficient');
  const live = { title: 'Example current downloads', url: 'https://example.com/en/download/current',
    description: 'Current 26.10.0.' };
  const combined = assessFreshEvidenceBundle([old, live], request, '2026-09-29');
  assert.equal(combined.factKey, 'version:current:26.10.0');
  assert.deepEqual(combined.hits.map((hit) => hit.url), [live.url]);
  const archive = { ...live, url: 'https://example.com/archive/releases/old-version-article' };
  assert.equal(evidenceScore(archive, request, '2026-09-29'),
    evidenceScore({ ...archive, url: 'https://example.com/archive/old-version-article' }, request, '2026-09-29'));
});

test('a read old official release note cannot outrank a newer official current index', async () => {
  const request = 'latest Acme version now';
  const old = { title: 'Acme 26.8.2 (Current)', url: 'https://acme.com/blog/release/v26.8.2',
    description: 'Acme 26.8.2 (Current) was released.', publishedAt: '2026-09-09' };
  const current = { title: 'Acme downloads', url: 'https://acme.com/download',
    description: 'Current 26.10.0; LTS 24.21.0.', publishedAt: '2026-09-22' };
  const result = assessFreshEvidenceBundle([
    { ...old, verifiedPage: true, evidenceLevel: 'primary_page' }, current,
  ], request, '2026-09-29');
  assert.equal(result.kind, 'primary_exact');
  assert.equal(result.factKey, 'version:current:26.10.0');
  assert.deepEqual(result.hits.map((hit) => hit.url), [current.url]);
  const answer = groundedSearchSummary(result.hits, request, new Date('2026-09-29T12:00:00Z'));
  assert.match(answer, /26\.10\.0.*24\.21\.0/);
  assert.doesNotMatch(answer, /26\.8\.2/);
});

test('a stale official release note triggers one evidence fallback, then newer official wins', async () => {
  const request = 'latest Acme version now';
  const today = new Date();
  const oldDate = new Date(today.getTime() - 20 * 86_400_000).toISOString().slice(0, 10);
  const newDate = new Date(today.getTime() - 2 * 86_400_000).toISOString().slice(0, 10);
  let fallbackCalls = 0;
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:brave', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Acme 26.8.2 (Current)', url: 'https://acme.com/blog/release/v26.8.2',
        description: 'Acme 26.8.2 (Current) was released.', publishedAt: oldDate },
    ] }),
    fallback: async () => { fallbackCalls++; return { sourceId: 'search:tavily', name: 'Results',
      mimeType: 'text/markdown', text: '', hits: [
        { title: 'Acme downloads', url: 'https://acme.com/download',
          description: 'Current 26.10.0; LTS 24.21.0.', publishedAt: newDate },
      ] }; },
    read: async (url) => {
      if (url.includes('/download')) throw new Error('URL_TOO_LARGE');
      return { sourceId: url, name: 'Acme release', mimeType: 'text/markdown',
        text: 'Acme 26.8.2 (Current) was released.' };
    },
  });
  assert.equal(fallbackCalls, 1);
  assert.equal(result.telemetry.evidenceQuality, 'insufficient');
  assert.equal(result.telemetry.finalEvidenceQuality, 'primary_exact');
  assert.deepEqual(result.hits.map((hit) => hit.url), ['https://acme.com/download']);
  assert.match(result.context, /26\.10\.0/);
  assert.doesNotMatch(result.context, /26\.8\.2/);
});

test('newer dated primary release beats older read release, but weak conflicts remain insufficient', () => {
  const request = 'latest Acme version now';
  const old = { title: 'Acme 26.8.2 (Current)', url: 'https://acme.com/blog/release/v26.8.2',
    description: 'Current 26.8.2.', publishedAt: '2026-09-09', verifiedPage: true };
  const newer = { title: 'Acme 26.10.0 (Current)', url: 'https://acme.com/blog/release/v26.10.0',
    description: 'Current 26.10.0.', publishedAt: '2026-09-27' };
  const strong = assessFreshEvidenceBundle([old, newer], request, '2026-09-29');
  assert.equal(strong.factKey, 'version:current:26.10.0');
  assert.deepEqual(strong.hits.map((hit) => hit.url), [newer.url]);
  const weak = assessFreshEvidenceBundle([old, { title: 'Acme rumor', url: 'https://rumor.example/acme',
    description: 'Current 26.10.0.' }], request, '2026-09-29');
  assert.equal(weak.kind, 'insufficient');
  assert.deepEqual(weak.hits, []);
  const corroborated = assessFreshEvidenceBundle([old,
    { title: 'Acme release report', url: 'https://first.example/acme', description: 'Current 26.10.0.' },
    { title: 'Independent Acme report', url: 'https://second.test/acme', description: 'Current 26.10.0.' },
  ], request, '2026-09-29');
  assert.equal(corroborated.kind, 'corroborated_exact');
  assert.equal(corroborated.factKey, 'version:current:26.10.0');
  assert.doesNotMatch(JSON.stringify(corroborated.hits), /26\.8\.2/);
});

test('weak Brave evidence triggers one Tavily request and merged independent corroboration', async () => {
  const calls: string[] = [];
  const request = 'latest Acme version now';
  const result = await searchContextForRequest(request, request, {
    search: async () => { calls.push('brave'); return { sourceId: 'search:brave', name: 'Results',
      mimeType: 'text/markdown', text: '', hits: [
        { title: 'Acme report', url: 'https://first.example/release', description: 'Acme Current 8.2.0.' },
      ] }; },
    fallback: async () => { calls.push('tavily'); return { sourceId: 'search:tavily', name: 'Results',
      mimeType: 'text/markdown', text: '', hits: [
        { title: 'Acme independent report', url: 'https://second.test/release', description: 'Acme Current 8.2.0.' },
        { title: 'Duplicate URL', url: 'https://first.example/release', description: 'Acme Current 8.2.0.' },
      ] }; },
    read: async () => { throw new Error('unexpected read'); },
  });
  assert.deepEqual(calls, ['brave', 'tavily']);
  assert.equal(result.hits.length, 2);
  assert.equal(result.telemetry.fallbackResultCount, 2);
  assert.equal(result.telemetry.finalEvidenceQuality, 'corroborated_exact');
  assert.match(groundedSearchSummary(result.hits, request), /Two independent sources/);
});

test('Tavily official evidence outranks a conflicting stale Brave snippet', async () => {
  const request = 'latest Acme version now';
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:brave', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Old checker', url: 'https://versions.example/acme',
        description: 'Acme Current 7.0.0.', publishedAt: '2025-01-01' },
    ] }),
    fallback: async () => ({ sourceId: 'search:tavily', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Acme downloads', url: 'https://acme.com/downloads', description: 'Current 8.2.0.' },
    ] }),
    read: async () => { throw new Error('URL_TOO_LARGE'); },
  });
  assert.equal(result.telemetry.fallbackUsed, true);
  assert.equal(result.hits[0].url, 'https://acme.com/downloads');
  assert.doesNotMatch(result.context, /7\.0\.0/);
  assert.match(groundedSearchSummary(result.hits, request), /8\.2\.0/);
});

test('official current major plus independent exact releases forms a grounded bundle after URL_TOO_LARGE', async () => {
  const request = 'latest Acme version now';
  const calls: string[] = [];
  const result = await searchContextForRequest(request, request, {
    search: async () => { calls.push('brave'); return { sourceId: 'search:brave', name: 'Results',
      mimeType: 'text/markdown', text: '', hits: [
        { title: 'Acme downloads', url: 'https://acme.com/downloads',
          description: 'Acme v26 is the Current major release.' },
        { title: 'Acme update', url: 'https://first.example/acme',
          description: 'The latest Current release is 26.10.0.' },
      ] }; },
    fallback: async (query) => { calls.push('tavily'); assert.equal(query, 'Acme latest current release official');
      return { sourceId: 'search:tavily', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
        { title: 'Acme status', url: 'https://acme.com/status',
          description: 'Current major series is v26.' },
        { title: 'Independent Acme release check', url: 'https://second.test/acme',
          description: 'Latest Current release: 26.10.0.' },
      ] }; },
    read: async () => { throw new Error('URL_TOO_LARGE'); },
  });
  assert.deepEqual(calls, ['brave', 'tavily']);
  assert.equal(result.telemetry.finalEvidenceQuality, 'primary_supported_bundle');
  assert.equal(result.hits.length, 3);
  assert.equal(result.hits.filter((hit) => hit.evidenceLevel === 'primary_bundle').length, 2);
  assert.match(result.context, /26\.10\.0/);
  const answer = groundedSearchSummary(result.hits, request, new Date(), 'en');
  assert.match(answer, /26\.10\.0/);
  assert.doesNotMatch(answer, /could not verify/i);
  assert.equal((answer.match(/\]\(https:\/\//g) ?? []).length, 3);
  const sourced = 'The Current release appears to be 26.10.0; the official site confirms the current series. '
    + '[Acme downloads](https://acme.com/downloads) [Acme update](https://first.example/acme) '
    + '[Independent Acme release check](https://second.test/acme)';
  assert.equal(usableSearchSynthesis(sourced, result.hits, request, new Date(), 'en'), true);
  assert.equal(usableSearchSynthesis('The Current release appears to be 99.0.0. '
    + '[Acme downloads](https://acme.com/downloads) [Acme update](https://first.example/acme) '
    + '[Independent Acme release check](https://second.test/acme)', result.hits, request, new Date(), 'en'), false);
  const fabricated = 'The Current release is 99.0.0. [Acme downloads](https://acme.com/downloads)';
  const guarded = await (await guardSearchDataStream(new Response(`0:${JSON.stringify(fabricated)}\n`),
    result.hits, request, new Date(), 'en')).text();
  assert.match(guarded, /26\.10\.0/);
  assert.doesNotMatch(guarded, /99\.0\.0/);
  const arabic = groundedSearchSummary(result.hits, 'ما هو أحدث إصدار من Acme الآن؟', new Date(), 'ar');
  assert.match(arabic, /26\.10\.0/);
  assert.match(arabic, /[\u0600-\u06ff]/u);
});

test('Arabic fresh request may refine retrieval while keeping the answer Arabic', async () => {
  const request = 'ما هو أحدث إصدار من Acme الآن؟';
  let primary = '';
  let refined = '';
  const result = await searchContextForRequest(request, request, {
    search: async (query) => { primary = query; return { sourceId: 'search:brave', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Acme downloads', url: 'https://acme.com/downloads', description: 'Acme v26 is Current.' },
      { title: 'Release report', url: 'https://first.example/acme', description: 'Latest Current 26.10.0.' },
    ] }; },
    fallback: async (query) => { refined = query; return { sourceId: 'search:tavily', name: 'Results',
      mimeType: 'text/markdown', text: '', hits: [
        { title: 'Independent report', url: 'https://second.test/acme', description: 'Current 26.10.0.' },
      ] }; },
    read: async () => { throw new Error('URL_TOO_LARGE'); },
  });
  assert.equal(primary, 'Acme latest current release official');
  assert.equal(refined, 'Acme latest current release official');
  assert.equal(result.telemetry.finalEvidenceQuality, 'primary_supported_bundle');
  const answer = groundedSearchSummary(result.hits, request, new Date(), 'ar');
  assert.match(answer, /[\u0600-\u06ff]/u);
  assert.match(answer, /26\.10\.0/);
});

test('Arabic and English current-version questions use one normalized primary retrieval query', async () => {
  for (const request of ['ما هو أحدث إصدار من Node.js الآن؟', 'What is the latest Node.js version now?']) {
    const calls: string[] = [];
    const result = await searchContextForRequest(request, request, {
      search: async (query) => { calls.push(query); return { sourceId: 'search:brave', name: 'Results',
        mimeType: 'text/markdown', text: '', hits: [
          { title: 'Node.js downloads', url: 'https://nodejs.org/en/download/current',
            description: 'Get Node.js v26.10.0 Current; LTS 24.21.0.' },
        ] }; },
      fallback: async (query) => { calls.push(`fallback:${query}`); throw new Error('not needed'); },
      read: async () => { throw new Error('URL_TOO_LARGE'); },
    });
    assert.deepEqual(calls, ['Node.js latest current release official']);
    assert.equal(result.telemetry.finalEvidenceQuality, 'primary_exact');
    assert.equal(result.telemetry.fallbackUsed, false);
    assert.match(result.context, /26\.10\.0/);
    const language = request.startsWith('ما') ? 'ar' : 'en';
    const answer = groundedSearchSummary(result.hits, request, new Date(), language);
    assert.match(answer, /26\.10\.0/);
    if (language === 'ar') assert.match(answer, /[\u0600-\u06ff]/u);
  }
});

test('timeless or uncertain multi-entity requests keep their original retrieval query', async () => {
  for (const [query, request] of [
    ['اشرح Node.js', 'اشرح Node.js'],
    ['Compare Node.js and Deno latest versions now', 'Compare Node.js and Deno latest versions now'],
  ]) {
    let searched = '';
    await searchContextForRequest(query, request, {
      search: async (value) => { searched = value; return { sourceId: 'search:brave', name: 'Results',
        mimeType: 'text/markdown', text: '', hits: [] }; },
      read: async () => { throw new Error('unexpected read'); },
    });
    assert.equal(searched, query);
  }
});

test('fresh price and availability requests reuse deterministic intent for primary retrieval', async () => {
  for (const [request, expected] of [
    ['What is the current Acme price now?', 'Acme current official price'],
    ['What is the current Acme availability?', 'Acme current official availability'],
  ]) {
    let searched = '';
    await searchContextForRequest(request, request, {
      search: async (query) => { searched = query; return { sourceId: 'search:brave', name: 'Results',
        mimeType: 'text/markdown', text: '', hits: [] }; },
      read: async () => { throw new Error('unexpected read'); },
    });
    assert.equal(searched, expected);
  }
});

test('today-dated official news is usable without an artificial version or price claim', async () => {
  const request = 'latest Acme news today';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric',
    month: '2-digit', day: '2-digit' }).format(new Date());
  let fallbackCalls = 0;
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:brave', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Acme announces new release', url: 'https://acme.com/news/release', publishedAt: today,
        description: 'Acme announced a new release today with updated features for customers.' },
    ] }),
    fallback: async () => { fallbackCalls++; throw new Error('not needed'); },
    read: async () => { throw new Error('URL_TOO_LARGE'); },
  });
  assert.equal(fallbackCalls, 0);
  assert.equal(result.hits[0].evidenceLevel, 'primary_search');
  assert.equal(result.evidence.publishedToday, true);
});

test('Arabic fresh news accepts independent relevant sources without an official-domain match', async () => {
  const request = 'ما آخر أخبار شركة Acme؟';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric',
    month: '2-digit', day: '2-digit' }).format(new Date());
  let fallbackCalls = 0;
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:brave', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Acme announces a new office', url: 'https://first.example/acme-office', publishedAt: today,
        description: 'Acme announced a new office and outlined its expansion this week.' },
      { title: 'Acme expands operations', url: 'https://second.test/acme-growth', publishedAt: today,
        description: 'Acme expanded its operations, with the new office opening this week.' },
    ] }),
    fallback: async () => { fallbackCalls++; throw new Error('not needed'); },
    read: async () => { throw new Error('no primary page'); },
  });
  assert.equal(fallbackCalls, 0);
  assert.equal(result.telemetry.evidenceMode, 'fresh_news');
  assert.equal(result.telemetry.assessmentReason, 'independent_news_sources');
  assert.equal(result.telemetry.primaryCandidateCount, 0);
  assert.equal(result.telemetry.independentDomainCount, 2);
  assert.equal(result.telemetry.selectedEvidenceCount, 2);
  assert.match(result.context, /Acme announced/);
  const answer = 'أعلنت Acme عن مكتب جديد هذا الأسبوع. '
    + '[Acme announces a new office](https://first.example/acme-office) '
    + '[Acme expands operations](https://second.test/acme-growth)';
  assert.equal(usableSearchSynthesis(answer, result.hits, request, new Date(), 'ar'), true);
  assert.doesNotMatch(groundedSearchSummary(result.hits, request, new Date(), 'ar'), /لم أتمكن من التحقق/);
});

test('localized Arabic company news does not require transliteration to an official Latin domain', async () => {
  const request = 'ما آخر أخبار شركة قوقل؟';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric',
    month: '2-digit', day: '2-digit' }).format(new Date());
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:brave', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'قوقل تعلن تحديثًا للخدمة', url: 'https://first.example/story', publishedAt: today,
        description: 'أعلنت قوقل تحديثًا جديدًا للخدمة في بيان هذا الأسبوع.' },
      { title: 'تغطية تحديث قوقل الأخير', url: 'https://second.test/story', publishedAt: today,
        description: 'تناولت التغطية تحديث قوقل الأخير وتأثيره على المستخدمين.' },
    ] }),
    read: async () => { throw new Error('no primary page'); },
  });
  assert.equal(result.telemetry.evidenceMode, 'fresh_news');
  assert.equal(result.telemetry.officialEvidenceUsed, false);
  assert.equal(result.hits.length, 2);
});

test('independent undated news remains usable without inventing publication freshness', async () => {
  const request = 'latest Acme news';
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:brave', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Acme office update', url: 'https://first.example/acme',
        description: 'Acme described its office update and related service changes.' },
      { title: 'Acme service coverage', url: 'https://second.test/acme',
        description: 'Acme service changes were discussed by an independent publisher.' },
    ] }),
    read: async () => { throw new Error('not selected'); },
  });
  assert.equal(result.hits.length, 2);
  assert.equal(result.telemetry.assessmentReason, 'independent_news_sources');
  assert.match(result.evidence.text, /Publication dates are unavailable/);
  assert.ok(result.hits.every((hit) => !hit.publishedAt));
});

test('narrative news does not promote contradictory exact version claims', async () => {
  const request = 'latest news about Acme version releases';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric',
    month: '2-digit', day: '2-digit' }).format(new Date());
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:brave', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Acme current release report', url: 'https://first.example/acme', publishedAt: today,
        description: 'Acme Current version is 26.8.2 in this report.' },
      { title: 'Acme current release update', url: 'https://second.test/acme', publishedAt: today,
        description: 'Acme Current version is 26.10.0 in this update.' },
    ] }),
    read: async () => { throw new Error('not selected'); },
  });
  assert.equal(result.telemetry.evidenceMode, 'fresh_news');
  assert.equal(result.telemetry.assessmentReason, 'unresolved_exact_conflict');
  assert.equal(result.hits.length, 0);
});

test('weak news evidence uses at most one Tavily evidence fallback', async () => {
  const request = 'latest Acme news';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric',
    month: '2-digit', day: '2-digit' }).format(new Date());
  const calls: string[] = [];
  const result = await searchContextForRequest(request, request, {
    search: async () => { calls.push('brave'); return { sourceId: 'search:brave', name: 'Results',
      mimeType: 'text/markdown', text: '', hits: [
        { title: 'Acme announces expansion', url: 'https://first.example/acme', publishedAt: today,
          description: 'Acme announced an expansion to its service this week.' },
      ] }; },
    fallback: async () => { calls.push('tavily'); return { sourceId: 'search:tavily', name: 'Results',
      mimeType: 'text/markdown', text: '', hits: [
        { title: 'Acme expansion coverage', url: 'https://second.test/acme', publishedAt: today,
          description: 'Acme expansion plans were covered in a separate report this week.' },
      ] }; },
    read: async () => { throw new Error('not selected'); },
  });
  assert.deepEqual(calls, ['brave', 'tavily']);
  assert.equal(result.telemetry.evidenceQuality, 'insufficient');
  assert.equal(result.telemetry.assessmentReason, 'independent_news_sources');
  assert.equal(result.hits.length, 2);
});

test('eight weak Brave hits do not discard later Tavily evidence before assessment', async () => {
  const request = 'latest Acme news';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric',
    month: '2-digit', day: '2-digit' }).format(new Date());
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:brave', name: 'Results', mimeType: 'text/markdown', text: '',
      hits: Array.from({ length: 8 }, (_, index) => ({ title: `Unrelated topic ${index}`,
        url: `https://unrelated${index}.example/story`, description: 'A long unrelated story about another subject.' })) }),
    fallback: async () => ({ sourceId: 'search:tavily', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Acme announces expansion', url: 'https://first.example/acme', publishedAt: today,
        description: 'Acme announced its expansion this week to a new location.' },
      { title: 'Acme growth coverage', url: 'https://second.test/acme', publishedAt: today,
        description: 'Acme expansion was covered by an independent publisher.' },
    ] }),
    read: async () => { throw new Error('not selected'); },
  });
  assert.equal(result.hits.length, 2);
  assert.equal(result.telemetry.fallbackUsed, true);
  assert.equal(result.telemetry.relevantCandidateCount, 2);
});

test('explicit general web search passes relevant independent evidence to synthesis', async () => {
  const request = 'Search the web for Acme company history';
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:brave', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'History of Acme', url: 'https://first.example/history',
        description: 'Acme began as a small manufacturing business and later expanded.' },
      { title: 'Acme company background', url: 'https://second.test/background',
        description: 'The history of Acme includes its original factory and later growth.' },
    ] }),
    read: async () => { throw new Error('not selected'); },
  });
  assert.equal(result.telemetry.evidenceMode, 'general_web');
  assert.equal(result.telemetry.assessmentReason, 'general_search_evidence');
  assert.equal(result.hits.length, 2);
  assert.match(result.context, /Acme began/);
});

test('current-major primary plus newer agreeing exact sources ignores one undated stale snippet', () => {
  const request = 'latest Node.js version now';
  const result = assessFreshEvidenceBundle([
    { title: 'Node.js downloads', url: 'https://nodejs.org/en/downloads',
      description: 'Node.js v26 is the Current major release.' },
    { title: 'Node.js current update', url: 'https://first.example/current', publishedAt: '2026-09-27',
      description: 'Current Node.js release is 26.10.0.' },
    { title: 'Node.js current tracker', url: 'https://second.test/current', publishedAt: '2026-09-27',
      description: 'The latest Current Node.js release is 26.10.0.' },
    { title: 'Old Node.js snippet', url: 'https://old.example/archive',
      description: 'Current Node.js release is 26.8.2.' },
  ], request, '2026-09-29');
  assert.equal(result.kind, 'primary_supported_bundle');
  assert.equal(result.factKey, 'version:current:26.10.0');
  assert.doesNotMatch(JSON.stringify(result.hits), /26\.8\.2/);
  const conflicting = assessFreshEvidenceBundle([
    { title: 'Node.js downloads', url: 'https://nodejs.org/en/downloads',
      description: 'Node.js v26 is the Current major release.' },
    { title: 'Node.js current update', url: 'https://first.example/current', publishedAt: '2026-09-27',
      description: 'Current Node.js release is 26.10.0.' },
    { title: 'Node.js current tracker', url: 'https://second.test/current', publishedAt: '2026-09-27',
      description: 'Current Node.js release is 26.10.0.' },
    { title: 'Conflicting Node.js result', url: 'https://third.net/current', publishedAt: '2026-09-28',
      description: 'Current Node.js release is 26.11.0.' },
  ], request, '2026-09-29');
  assert.equal(conflicting.kind, 'insufficient');
});

test('Brave and Tavily insufficient evidence remains uncertain after exactly one fallback', async () => {
  let fallbackCalls = 0;
  const request = 'latest Acme version now';
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:brave', name: 'Results', mimeType: 'text/markdown', text: '',
      hits: [{ title: 'Speculation', url: 'https://first.example/story', description: 'Maybe 8.2.0.' }] }),
    fallback: async () => { fallbackCalls++; return { sourceId: 'search:tavily', name: 'Results',
      mimeType: 'text/markdown', text: '', hits: [
        { title: 'Another guess', url: 'https://second.test/story', description: 'No current release number.' },
      ] }; },
    read: async () => { throw new Error('unexpected read'); },
  });
  assert.equal(fallbackCalls, 1);
  assert.equal(result.hits.length, 0);
  assert.equal(result.telemetry.finalEvidenceQuality, 'insufficient');
  assert.match(groundedSearchSummary(result.hits, request), /could not verify/);
});

test('fresh answer numbers must belong to a cited retrieved source, not merely another hit', () => {
  const hits = [
    { title: 'Acme downloads', url: 'https://acme.com/downloads', description: 'Current 8.2.0.',
      evidenceLevel: 'primary_search' as const, evidenceId: 'S1' },
    { title: 'Other product', url: 'https://other.example/release', description: 'Current 99.0.0.',
      evidenceLevel: 'corroborated' as const, evidenceId: 'S2' },
  ];
  const request = 'latest Acme version now';
  assert.equal(usableSearchSynthesis('Current is 8.2.0. [Acme downloads](https://acme.com/downloads)',
    hits, request, new Date(), 'en'), true);
  assert.equal(usableSearchSynthesis('Current is 99.0.0. [Acme downloads](https://acme.com/downloads)',
    hits, request, new Date(), 'en'), false);
  assert.equal(usableSearchSynthesis('Current is 99.0.0. [Other product](https://other.example/release)',
    hits, request, new Date(), 'en'), false);
});

test('official search fallback is generic for current prices, not tied to a product name', async () => {
  const request = 'What is the current Acme price now?';
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:test', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Acme pricing', url: 'https://acme.com/pricing', description: 'Current price: $99.' },
    ] }),
    read: async () => { throw new Error('URL_TOO_LARGE'); },
  });
  assert.equal(result.hits[0].evidenceLevel, 'primary_search');
  assert.match(groundedSearchSummary(result.hits, request), /99 \$.*https:\/\/acme\.com\/pricing/);
});

test('two independent agreeing sources give a cautious answer without primary evidence', async () => {
  const request = 'latest Acme version now';
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:test', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Acme release report', url: 'https://first.example/release', description: 'Acme Current 8.2.0.' },
      { title: 'Acme version report', url: 'https://second.test/version', description: 'Acme Current 8.2.0.' },
    ] }),
    read: async () => { throw new Error('unexpected read'); },
  });
  assert.deepEqual(result.diagnosticStages, ['no_primary_candidate_found', 'corroborated_secondary_evidence_used']);
  assert.equal(result.hits.length, 2);
  const answer = groundedSearchSummary(result.hits, request);
  assert.match(answer, /Two independent sources report|Two independent sources agree/);
  assert.match(answer, /8\.2\.0/);
  assert.equal((answer.match(/\]\(https:\/\//g) ?? []).length, 2);
  assert.doesNotMatch(answer, /7\.0\.0/);
  assert.equal(usableSearchSynthesis('Current is 8.2.0. [Acme release report](https://first.example/release)',
    result.hits, request, new Date(), 'en'), false);
});

test('one unsupported source is insufficient and cannot be promoted to a fresh fact', async () => {
  const request = 'latest Acme version now';
  const result = await searchContextForRequest(request, request, {
    search: async () => ({ sourceId: 'search:test', name: 'Results', mimeType: 'text/markdown', text: '', hits: [
      { title: 'Acme guess', url: 'https://guesses.example/version', description: 'Current 8.2.0.' },
    ] }),
    read: async () => { throw new Error('unexpected read'); },
  });
  assert.deepEqual(result.diagnosticStages, ['no_primary_candidate_found', 'insufficient_evidence']);
  assert.deepEqual(result.hits, []);
  assert.match(groundedSearchSummary(result.hits, request), /could not verify/);
});

test('corroboration rejects duplicate domains and conflicting source groups', async () => {
  const request = 'latest Acme version now';
  for (const hits of [
    [
      { title: 'Acme report', url: 'https://one.example.com/a', description: 'Acme Current 8.2.0.' },
      { title: 'Acme mirror', url: 'https://two.example.com/b', description: 'Acme Current 8.2.0.' },
    ],
    [
      { title: 'Acme report A', url: 'https://first.example/a', description: 'Acme Current 8.2.0.' },
      { title: 'Acme report B', url: 'https://second.test/b', description: 'Acme Current 8.2.0.' },
      { title: 'Acme report C', url: 'https://third.net/c', description: 'Acme Current 9.0.0.' },
      { title: 'Acme report D', url: 'https://fourth.org/d', description: 'Acme Current 9.0.0.' },
    ],
  ]) {
    const result = await searchContextForRequest(request, request, {
      search: async () => ({ sourceId: 'search:test', name: 'Results', mimeType: 'text/markdown', text: '', hits }),
      read: async () => { throw new Error('unexpected read'); },
    });
    assert.deepEqual(result.hits, []);
    assert.ok(result.diagnosticStages.includes('insufficient_evidence'));
  }
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

test('Arabic confirmation follow-up re-runs the inherited query through the evidence ladder', async () => {
  const original = 'ما هو أحدث إصدار من Node.js الآن؟';
  const choice = decideWebSearchWithHistory('هل أنت متأكد؟', [
    { role: 'user', content: original }, { role: 'assistant', content: 'الإصدار 20.20.0.' },
  ]);
  assert.equal(choice.decision.path, 'required');
  const result = await searchContextForRequest(choice.evidenceRequest, choice.evidenceRequest, {
    search: async (query) => { assert.equal(query, 'Node.js latest current release official'); return { sourceId: 'search:test',
      name: 'Results', mimeType: 'text/markdown', text: '', hits: [
        { title: 'Node.js downloads', url: 'https://nodejs.org/en/download',
          description: 'Current 26.1.0; LTS 24.4.0.' },
      ] }; },
    read: async () => { throw new Error('URL_UNAVAILABLE'); },
  });
  assert.equal(result.hits[0].evidenceLevel, 'primary_search');
  assert.match(groundedSearchSummary(result.hits, choice.evidenceRequest, new Date(), 'ar'), /26\.1\.0/);
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

test('both search adapters request at most eight results and normalize only eight', async () => {
  const results = Array.from({ length: 9 }, (_, index) => ({ title: `Result ${index}`,
    url: `https://example.org/${index}`, description: 'Relevant bounded search result.' }));
  const brave = new BraveWebSearch('test', async (input) => {
    assert.equal(new URL(String(input)).searchParams.get('count'), '8');
    return Response.json({ web: { results } });
  });
  const tavily = new TavilyWebSearch('test', async (_input, init) => {
    assert.equal(JSON.parse(String(init?.body)).max_results, 8);
    return Response.json({ results: results.map(({ description, ...item }) => ({ ...item, content: description })) });
  });
  assert.equal((await brave.search('query', 8)).length, 8);
  assert.equal((await tavily.search('query', 8)).length, 8);
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
    assert.equal(new URL(String(input)).searchParams.get('count'), '8');
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
