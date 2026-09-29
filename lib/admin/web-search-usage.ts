import type { AdminJobRow } from './types';

/** Read only the bounded operational fields written by Chat finalization. */
export function webSearchUsageForJob(metadata: Record<string, unknown>): AdminJobRow['webSearch'] {
  if (typeof metadata.webSearchTriggered !== 'boolean') return null;
  const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value)
    && value >= 0 && value <= 10_000 ? value : null;
  const milliseconds = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
    && value >= 0 && value <= 600_000 ? Math.round(value) : null;
  const label = (value: unknown) => typeof value === 'string' && /^[a-z][a-z0-9_\-]{0,39}$/i.test(value)
    ? value : null;
  const flag = (value: unknown) => typeof value === 'boolean' ? value : null;
  const attempts = Array.isArray(metadata.webSearchAttempts) ? metadata.webSearchAttempts.slice(0, 4)
    .flatMap((value): NonNullable<AdminJobRow['webSearch']>['attempts'] => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      const attempt = value as Record<string, unknown>;
      const provider = label(attempt.provider);
      const status = label(attempt.status);
      if (!provider || !status) return [];
      return [{ provider, status, outboundRequestIssued: attempt.outboundRequestIssued === true,
        failureCategory: label(attempt.failureCategory), resultCount: count(attempt.resultCount) ?? 0,
        latencyMs: milliseconds(attempt.latencyMs) ?? 0 }];
    }) : [];
  return {
    decision: label(metadata.webSearchDecision), toolExposed: flag(metadata.webSearchToolExposed),
    toolCalled: flag(metadata.webSearchToolCalled), evidenceSufficient: flag(metadata.webSearchEvidenceSufficient),
    synthesisAccepted: flag(metadata.synthesisAccepted), synthesisRejectionReason: label(metadata.synthesisRejectionReason),
    triggered: metadata.webSearchTriggered,
    apiRequestCount: count(metadata.webSearchApiRequestCount),
    primaryProvider: label(metadata.webSearchPrimaryProvider),
    providerUsed: label(metadata.webSearchProviderUsed),
    fallbackUsed: metadata.webSearchFallbackUsed === true,
    fallbackProvider: label(metadata.webSearchFallbackProvider),
    fallbackReason: label(metadata.webSearchFallbackReason),
    resultCount: count(metadata.webSearchResultCount),
    latencyMs: milliseconds(metadata.webSearchTotalLatencyMs),
    evidenceMode: label(metadata.webSearchEvidenceMode),
    assessmentReason: label(metadata.webSearchAssessmentReason),
    selectedEvidenceCount: count(metadata.webSearchSelectedEvidenceCount),
    urlReadCount: count(metadata.webUrlReadCount) ?? 0,
    urlReadOutcome: label(metadata.webUrlReadOutcome), attempts,
  };
}
