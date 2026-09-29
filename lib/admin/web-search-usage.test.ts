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

test('Jobs distinguish completed inference from rejected search synthesis and retain legacy unknowns', () => {
  const parsed = webSearchUsageForJob({ webSearchTriggered: true, webSearchDecision: 'required',
    webSearchToolExposed: true, webSearchToolCalled: false, webSearchEvidenceSufficient: true,
    synthesisAccepted: false, synthesisRejectionReason: 'unsupported_url' });
  assert.equal(parsed?.decision, 'required');
  assert.equal(parsed?.toolCalled, false);
  assert.equal(parsed?.evidenceSufficient, true);
  assert.equal(parsed?.synthesisAccepted, false);
  assert.equal(parsed?.synthesisRejectionReason, 'unsupported_url');
  const legacy = webSearchUsageForJob({ webSearchTriggered: true });
  assert.equal(legacy?.synthesisAccepted, null);
  assert.equal(legacy?.toolExposed, null);
});
