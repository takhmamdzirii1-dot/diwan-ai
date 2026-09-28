import assert from 'node:assert/strict';
import test from 'node:test';
import { selectArtifactTools, selectWebContextTool } from '@/lib/artifacts/tool-registry';
import { optionalWebContext, webContextForRequest } from './context.server';
import { BraveWebSearch, orchestrateWebSearch, SearchProviderError, searchWeb, TavilyWebSearch,
  type WebSearchProvider } from './search.server';
import { budgetWarning, type SearchHealthStore } from './search-health.server';
import { decideWebSearch } from './selection';
import { readPublicWebPage, resolvePublicWebUrl } from './url-reader.server';

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
