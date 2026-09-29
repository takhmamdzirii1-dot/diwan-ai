import 'server-only';
import { attachConversationFile, attachmentRequestContext } from '@/lib/chat/conversation-attachments';
import { boundedConnectedContent, connectedResourceAttachment } from '@/lib/connected-apps/core';
import type { WebContextTool } from './selection';
import { readPublicWebPage } from './url-reader.server';
import { searchWeb, type SearchExecution, type WebSearchHit } from './search.server';
import { assessFreshEvidenceBundle, assessNarrativeEvidenceBundle, dedupeSearchHits, evidenceModeForRequest,
  canonicalSearchUrl, freshFactKey, likelyPrimarySource, needsFreshEvidence, primaryEvidenceDiagnostics, rankedEvidence, relevantWebHit,
  requestedNewsCount, searchEvidence, supportsPrimaryPage, type EvidenceMode } from './evidence';

type WebResource = Awaited<ReturnType<typeof readPublicWebPage>>;
export async function webContextForRequest(tool: WebContextTool, request: string,
  operations: { read: typeof readPublicWebPage; search: (query: string) => Promise<WebResource> }
    = { read: readPublicWebPage, search: searchWeb }): Promise<string> {
  const resource = tool.kind === 'read_url' ? await operations.read(tool.url) : await operations.search(tool.query);
  const excerpt = boundedConnectedContent(resource, request, 8_000);
  if (!excerpt) throw new Error('WEB_CONTENT_UNAVAILABLE');
  const draft = connectedResourceAttachment({ ...resource, text: excerpt },
    tool.kind === 'read_url' ? 'web_url' : 'web_search', 'public-web');
  const context = attachmentRequestContext(attachConversationFile([], draft, 'web-request')).documentContext;
  if (!context) throw new Error('WEB_CONTENT_UNAVAILABLE');
  return context;
}

/** Compatibility wrapper; optional and required search use the same evidence resolver. */
export async function optionalWebContext(query: string, request: string,
  search: (query: string) => ReturnType<typeof searchWeb> = searchWeb,
  onExecution?: (execution: SearchExecution) => void) {
  try {
    const result = await searchContextForRequest(query, request, { read: readPublicWebPage,
      search: search === searchWeb && onExecution
        ? (value) => searchWeb(value, undefined, { onExecution }) : search });
    return { status: result.hits.length ? 'ok' as const : 'unavailable' as const, context: result.context };
  }
  catch { return { status: 'unavailable' as const, context: '' }; }
}

/** One tool invocation per user turn, including failures and parallel tool calls. */
export function oncePerTurnOptionalWebSearch(request: string,
  run: (query: string, request: string) => ReturnType<typeof optionalWebContext> = optionalWebContext) {
  let attempted = false;
  return (query: string) => {
    if (attempted) return Promise.resolve({ status: 'unavailable' as const, context: '' });
    attempted = true;
    return run(query, request);
  };
}

// The injected fallback sentinel is intentionally never invoked: technical
// fallback belongs exclusively to searchWeb's provider orchestrator.
type SearchOperations = { search: typeof searchWeb; read: typeof readPublicWebPage;
  fallback?: typeof searchWeb };

function refinedRetrievalQuery(request: string) {
  const intent = /\b(?:version|release)\b|(?:إصدار|اصدار|نسخة)/iu.test(request)
    ? 'latest current release official'
    : /\b(?:price|cost)\b|(?:سعر|الأسعار|الاسعار)/iu.test(request)
      ? 'current official price' : /\b(?:availability|stock|status)\b|(?:متاح|متوفر|الحالة)/iu.test(request)
        ? 'current official availability' : null;
  if (!intent) return request;
  const ignored = new Set<string>(['latest', 'current', 'version', 'release', 'official', 'price', 'cost',
    'availability', 'stock', 'status', 'what', 'which', 'now', 'today', 'the', 'is']);
  const matches: string[] = request.match(/[A-Za-z][A-Za-z0-9.+-]*/g) ?? [];
  const entities = matches
    .filter((word) => !ignored.has(word.toLowerCase()));
  return entities.length === 1 ? `${entities[0]} ${intent}` : request;
}

async function assessFreshHits(hits: WebSearchHit[], request: string, read: typeof readPublicWebPage,
  mode: EvidenceMode) {
  hits = dedupeSearchHits(hits);
  const diagnosticStages: string[] = [];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric',
    month: '2-digit', day: '2-digit' }).format(new Date());
  const primary = hits.filter((candidate) => likelyPrimarySource(candidate, request));
  diagnosticStages.push(primary.length ? 'primary_candidate_found' : 'no_primary_candidate_found');
  const pages: WebSearchHit[] = [];
  for (const hit of rankedEvidence(primary, request, today).slice(0, 2)) {
    try {
      const page = await read(hit.url);
      if (new URL(page.sourceId).hostname !== new URL(hit.url).hostname) {
        diagnosticStages.push('primary_url_read_failed'); continue;
      }
      diagnosticStages.push('primary_url_read_succeeded');
      const excerpt = boundedConnectedContent(page, request, 2_000);
      if (excerpt && excerpt.length >= 24) {
        const candidate = { ...hit, description: excerpt.slice(0, 500), verifiedPage: true,
          evidenceLevel: 'primary_page' as const };
        if (supportsPrimaryPage(candidate, request, today)) pages.push(candidate);
      }
    } catch { diagnosticStages.push('primary_url_read_failed'); }
  }
  // Keep search snippets alongside successful reads: a page may establish only
  // Current major while independent snippets establish the exact release.
  const assessment = mode === 'structured_fact'
    ? assessFreshEvidenceBundle([...pages, ...hits], request, today)
    : assessNarrativeEvidenceBundle([...pages, ...hits], request, today, mode);
  diagnosticStages.push(assessment.kind === 'primary_exact'
    ? assessment.hits.some((hit) => hit.verifiedPage) ? 'primary_page_evidence_used'
      : 'official_search_result_evidence_used'
    : assessment.kind === 'primary_supported_bundle' ? 'primary_supported_bundle_used'
      : assessment.kind === 'corroborated_exact' ? 'corroborated_secondary_evidence_used'
        : assessment.kind === 'independent_news_sources' ? 'independent_news_sources_used'
        : 'insufficient_evidence');
  return { hits: assessment.hits, kind: assessment.kind,
    safeNarrativeCandidateCount: 'safeCandidateCount' in assessment ? assessment.safeCandidateCount : null,
    primaryDiagnostics: primaryEvidenceDiagnostics([...pages, ...hits], request),
    reason: 'reason' in assessment ? assessment.reason : assessment.kind, diagnosticStages };
}

export async function searchContextForRequest(query: string, request: string,
  operations?: SearchOperations, seenSourceUrls: readonly string[] = []) {
  const active = operations ?? { search: searchWeb, read: readPublicWebPage };
  const fresh = needsFreshEvidence(request);
  const retrievalQuery = fresh ? refinedRetrievalQuery(query) : query;
  const resource = await active.search(retrievalQuery);
  const readCache = new Map<string, ReturnType<typeof readPublicWebPage>>();
  let urlReadCount = 0;
  const readOnce: typeof readPublicWebPage = (url, options) => {
    if (options) { urlReadCount++; return active.read(url, options); }
    let result = readCache.get(url);
    if (!result) { urlReadCount++; result = active.read(url); readCache.set(url, result); }
    return result;
  };
  const candidates = dedupeSearchHits(resource.hits);
  let hits = candidates;
  let diagnosticStages: string[] = [];
  let assessmentKind: string | null = null;
  let assessmentReason: string | null = null;
  let safeNarrativeCandidateCount: number | null = null;
  let primaryDiagnostics = primaryEvidenceDiagnostics(candidates, request);
  const technicalFallback = resource.execution?.fallbackUsed ?? false;
  const evidenceMode: EvidenceMode = fresh ? evidenceModeForRequest(request) : 'general_web';
  if (fresh) {
    ({ hits, kind: assessmentKind, reason: assessmentReason, diagnosticStages, safeNarrativeCandidateCount,
      primaryDiagnostics } = await assessFreshHits(
      candidates, request, readOnce, evidenceMode));
  } else {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric',
      month: '2-digit', day: '2-digit' }).format(new Date());
    const assessment = assessNarrativeEvidenceBundle(candidates, request, today, 'general_web');
    hits = assessment.hits; assessmentKind = assessment.kind; assessmentReason = assessment.reason;
    safeNarrativeCandidateCount = assessment.safeCandidateCount;
  }
  if (evidenceMode !== 'structured_fact' && seenSourceUrls.length) {
    const seen = new Set(seenSourceUrls.map(canonicalSearchUrl).filter((url): url is string => !!url));
    // Prefer new stories, but retain previously cited evidence if retrieval has no alternatives.
    hits = [...hits].sort((a, b) => (evidenceMode === 'general_web'
      ? Number(likelyPrimarySource(b, request)) - Number(likelyPrimarySource(a, request)) : 0)
      || Number(seen.has(canonicalSearchUrl(a.url) ?? ''))
      - Number(seen.has(canonicalSearchUrl(b.url) ?? '')));
  }
  const initialQuality = assessmentKind ?? (!hits.length ? 'insufficient' : hits[0].evidenceLevel === 'primary_page'
    ? 'primary_page' : hits[0].evidenceLevel === 'primary_search' ? 'official_search'
      : hits[0].evidenceLevel === 'corroborated' ? 'corroborated' : 'search_results');
  hits = hits.map((hit, index) => ({ ...hit, evidenceId: `S${index + 1}` }));
  const quality = assessmentKind ?? (!hits.length ? 'insufficient' : hits[0].evidenceLevel === 'primary_page'
    ? 'primary_page' : hits[0].evidenceLevel === 'primary_search' ? 'official_search'
      : hits[0].evidenceLevel === 'corroborated' ? 'corroborated' : 'search_results');
  const exactFactGroupCount = new Set(candidates.map((hit) => freshFactKey(`${hit.title} ${hit.description}`, request))
    .filter(Boolean)).size;
  const relevantCandidateCount = candidates.filter((hit) => relevantWebHit(hit, request)).length;
  const independentDomainCount = new Set(candidates.map((hit) => new URL(hit.url).hostname.replace(/^www\./, '')
    .split('.').slice(-2).join('.'))).size;
  const reason = assessmentReason ?? (quality === 'insufficient' && evidenceMode === 'structured_fact'
    ? exactFactGroupCount > 1 ? 'unresolved_exact_conflict'
      : relevantCandidateCount ? 'insufficient_source_diversity' : 'no_relevant_sources'
    : quality);
  const telemetry = { searchTriggered: true, evidenceMode, assessmentReason: reason,
    ...primaryDiagnostics, selectionReason: reason,
    candidateCount: candidates.length, safeNarrativeCandidateCount,
    requestedItemCount: evidenceMode === 'fresh_news' ? requestedNewsCount(request) : null,
    primaryCandidateCount: candidates.filter((hit) => likelyPrimarySource(hit, request)).length,
    exactFactGroupCount, relevantCandidateCount, independentDomainCount,
    selectedEvidenceCount: hits.length,
    primaryProvider: resource.execution?.primaryProvider ?? 'brave',
    primaryResultCount: technicalFallback ? 0 : resource.hits.length,
    evidenceQuality: initialQuality, evidenceSufficient: hits.length > 0,
    fallbackUsed: technicalFallback, fallbackProvider: technicalFallback ? resource.execution?.providerUsed ?? null : null,
    fallbackReason: resource.execution?.fallbackReason ?? null,
    fallbackResultCount: technicalFallback ? resource.hits.length : 0,
    webSearchApiRequestCount: resource.execution?.apiRequestCount ?? null,
    webSearchAttempts: resource.execution?.attempts ?? [],
    webSearchProviderUsed: resource.execution?.providerUsed ?? null,
    webSearchResultCount: resource.hits.length,
    webSearchTotalLatencyMs: resource.execution?.latencyMs ?? null,
    webUrlReadCount: urlReadCount,
    officialEvidenceUsed: hits.some((hit) => likelyPrimarySource(hit, request)),
    urlReadOutcome: diagnosticStages.includes('primary_url_read_succeeded') ? 'succeeded'
      : diagnosticStages.includes('primary_url_read_failed') ? 'failed' : 'not_attempted',
    finalEvidenceQuality: quality, citationsCount: null as number | null,
    citationCandidatesCount: Math.min(hits.length, evidenceMode === 'structured_fact' ? 3
      : evidenceMode === 'fresh_news' ? requestedNewsCount(request) ?? 5 : 5) };
  // Metadata only: never log query, URLs, source text, credentials, or user content.
  console.info('WEB_EVIDENCE_EXECUTION', telemetry);
  const evidence = searchEvidence(hits, request);
  const evidenceText = hits.length ? evidence.text : 'No sufficiently supported current fact could be verified. Do not guess a value.';
  const context = await webContextForRequest({ kind: 'web_search', query }, request,
    { read: active.read, search: async () => ({ ...resource, text: evidenceText }) });
  return { context, hits, evidence, diagnosticStages, telemetry };
}
