import assert from 'node:assert/strict';
import test from 'node:test';
import { webSearchUsageForJob } from './web-search-usage';

test('Chat Jobs expose only bounded Web Search operational metadata', () => {
  assert.equal(webSearchUsageForJob({}), null);
  assert.deepEqual(webSearchUsageForJob({ webSearchTriggered: false,
    webSearchApiRequestCount: 0, webUrlReadCount: 0 })?.apiRequestCount, 0);
  const parsed = webSearchUsageForJob({
    webSearchTriggered: true, webSearchApiRequestCount: 2,
    webSearchPrimaryProvider: 'brave', webSearchProviderUsed: 'tavily',
    webSearchFallbackUsed: true, webSearchFallbackProvider: 'tavily',
    webSearchFallbackReason: 'timeout', webSearchResultCount: 8,
    webSearchTotalLatencyMs: 3520, webSearchEvidenceMode: 'structured_fact',
    webSearchAssessmentReason: 'latest_primary_index',
    webSearchSelectedEvidenceCount: 2, webUrlReadCount: 1,
    webUrlReadOutcome: 'failed',
    webSearchAttempts: [
      { provider: 'brave', outboundRequestIssued: true, status: 'failed',
        failureCategory: 'timeout', resultCount: 0, latencyMs: 3000 },
      { provider: 'tavily', outboundRequestIssued: true, status: 'success',
        failureCategory: null, resultCount: 8, latencyMs: 520 },
    ],
    searchQuery: 'private user prompt', apiKey: 'secret', resultUrls: ['https://example.test/private'],
  });
  assert.equal(parsed?.apiRequestCount, 2);
  assert.equal(parsed?.fallbackReason, 'timeout');
  assert.equal(parsed?.urlReadCount, 1);
  assert.equal(parsed?.attempts.length, 2);
  assert.doesNotMatch(JSON.stringify(parsed), /private user prompt|secret|example\.test/);
});
