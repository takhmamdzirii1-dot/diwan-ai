import 'server-only';
import { attachConversationFile, attachmentRequestContext } from '@/lib/chat/conversation-attachments';
import { boundedConnectedContent, connectedResourceAttachment } from '@/lib/connected-apps/core';
import type { WebContextTool } from './selection';
import { currentInformationPolicy } from './selection';
import { readPublicWebPage } from './url-reader.server';
import { searchWeb, type SearchExecution, type WebSearchHit } from './search.server';
import { explicitAnnouncement, newsArticleCandidate, datedNewsRequest } from './news-evidence';
import { driverRequestScope } from './driver-scope';
import { assessFreshEvidenceBundle, assessNarrativeEvidenceBundle, dedupeSearchHits, evidenceModeForRequest,
  canonicalSearchUrl, freshFactKey, likelyPrimarySource, needsFreshEvidence, primaryEvidenceDiagnostics, primaryReadPriority, rankedEvidence, relevantWebHit,
  requestedNewsCount, requestedVersionChannel, searchEvidence, supportsPrimaryPage, narrativeDateRange, type EvidenceMode } from './evidence';

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
  // Driver platform/branch are part of identity, not disposable query filler.
  if (driverRequestScope(request)) return request;
  const policy = currentInformationPolicy(request);
  const fact = policy.exactFact;
  const intent = fact === 'version'
    ? requestedVersionChannel(request) === 'lts' ? 'latest LTS release official' : 'latest current release official'
    : fact === 'price'
      ? 'current official price' : fact === 'availability'
        ? 'current official availability' : policy.fresh && policy.mode === 'general_web'
          && /\bmodels?\b|نماذج|نموذج|\bmodèles?\b/iu.test(request) ? 'latest models official' : null;
  if (!intent) return request;
  const ignored = new Set<string>(['latest', 'current', 'version', 'release', 'official', 'price', 'cost',
    'availability', 'stock', 'status', 'what', 'which', 'now', 'today', 'the', 'is', 'models', 'model',
    'are', 'of', 'modèles', 'derniers', 'lts']);
  const matches: string[] = request.match(/[A-Za-z][A-Za-z0-9.+-]*/g) ?? [];
  const entities = matches
    .filter((word) => !ignored.has(word.toLowerCase()));
  // A single Latin entity span in a non-Latin question is unambiguous even
  // when its ordinary name contains spaces. Multiple separated spans remain raw.
  const spans = request.match(/[A-Za-z][A-Za-z0-9.+-]*(?:\s+[A-Za-z][A-Za-z0-9.+-]*)*/g) ?? [];
  const singleMixedEntity = fact === null && /[\u0600-\u06ff]/u.test(request)
    && spans.length === 1 && entities.length <= 3;
  return entities.length === 1 || singleMixedEntity ? `${entities.join(' ')} ${intent}` : request;
}

async function assessFreshHits(hits: WebSearchHit[], request: string, read: typeof readPublicWebPage,
  mode: EvidenceMode) {
  hits = dedupeSearchHits(hits).map((hit) => {
    if (mode !== 'fresh_news') return hit;
    const announcement = newsArticleCandidate(hit) ? explicitAnnouncement(hit.description) : null;
    return { ...hit, pagePublishedAt: hit.publishedAt,
      announcementDate: announcement?.date ?? null, articleEvidence: !!announcement };
  });
  const diagnosticStages: string[] = [];
  const readFailures: string[] = [];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric',
    month: '2-digit', day: '2-digit' }).format(new Date());
  const primary = hits.filter((candidate) => likelyPrimarySource(candidate, request));
  diagnosticStages.push(primary.length ? 'primary_candidate_found' : 'no_primary_candidate_found');
  const pages: WebSearchHit[] = [];
  const newsWindow = narrativeDateRange(request, today);
  const recentArticle = (hit: WebSearchHit) => newsArticleCandidate(hit) && (!hit.publishedAt
    || Date.parse(hit.publishedAt) >= newsWindow.start && Date.parse(hit.publishedAt) <= newsWindow.end);
  const readCandidates = mode === 'fresh_news'
    ? hits.filter((hit) => !newsArticleCandidate(hit) || recentArticle(hit))
      .sort((a, b) => Number(recentArticle(b)) - Number(recentArticle(a))
      || Number(likelyPrimarySource(b, request)) - Number(likelyPrimarySource(a, request)))
    : [...primary].sort((a, b) => primaryReadPriority(b, request) - primaryReadPriority(a, request));
  for (let readIndex = 0; readIndex < Math.min(2, readCandidates.length); readIndex++) {
    const hit = readCandidates[readIndex];
    const stage = mode === 'fresh_news' && newsArticleCandidate(hit) ? 'article' : 'primary';
    try {
      const page = await read(hit.url);
      if (new URL(page.sourceId).hostname !== new URL(hit.url).hostname) {
        diagnosticStages.push(`${stage}_url_read_failed`); continue;
      }
      diagnosticStages.push(`${stage}_url_read_succeeded`);
      if (readIndex === 0 && mode === 'fresh_news' && !newsArticleCandidate(hit)) {
        const linkedArticles = (page.articleLinks ?? []).filter((link) => {
          try { return new URL(link.url).origin === new URL(hit.url).origin; } catch { return false; }
        }).map((link): WebSearchHit => ({ ...hit, title: link.title, url: link.url, description: '', publishedAt: null }))
          .filter((article) => newsArticleCandidate(article) && relevantWebHit(article, request));
        if (linkedArticles[0]) readCandidates.splice(1, 0, linkedArticles[0]);
      }
      // A search-returned official index can lead to its actual live download
      // page. Use the remaining read slot, never guess URLs or add search calls.
      if (readIndex === 0 && mode === 'structured_fact' && currentInformationPolicy(request).exactFact === 'version'
        && likelyPrimarySource(hit, request)) {
        const navigation = (page.navigationLinks ?? []).filter((link) => {
          try { return new URL(link.url).origin === new URL(hit.url).origin && link.url !== hit.url; }
          catch { return false; }
        }).map((link): WebSearchHit => ({ title: link.title || hit.title, url: link.url, description: '' }))
          .sort((a, b) => primaryReadPriority(b, request) - primaryReadPriority(a, request));
        if (navigation[0] && primaryReadPriority(navigation[0], request) > primaryReadPriority(readCandidates[1] ?? hit, request))
          readCandidates.splice(1, 0, navigation[0]);
      }
      const excerpt = boundedConnectedContent(page, request, 2_000);
      if (excerpt && excerpt.length >= 24) {
        const announcement = stage === 'article' ? explicitAnnouncement(page.text) : null;
        const candidate: WebSearchHit = { ...hit,
          description: [announcement?.text, excerpt].filter(Boolean).join('\n').slice(0, 2_000), verifiedPage: true,
          contentComplete: page.contentComplete, fetchedAt: page.fetchedAt,
          ...(mode === 'fresh_news' ? { pagePublishedAt: page.pagePublishedAt ?? hit.publishedAt,
            pageUpdatedAt: page.pageUpdatedAt ?? null, announcementDate: announcement?.date ?? hit.announcementDate,
            articleEvidence: stage === 'article' } : {}),
          evidenceLevel: likelyPrimarySource(hit, request) ? 'primary_page' : 'secondary_page' };
        if (mode === 'fresh_news' || supportsPrimaryPage(candidate, request, today)) pages.push(candidate);
      }
    } catch (cause) {
      diagnosticStages.push(`${stage}_url_read_failed`);
      const code = cause instanceof Error ? cause.message : '';
      readFailures.push(['URL_UNSAFE', 'URL_TOO_LARGE', 'URL_UNAVAILABLE', 'URL_CONTENT_UNSUPPORTED'].includes(code)
        ? code : 'URL_READ_FAILED');
    }
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
        : assessment.kind === 'dated_article_evidence' ? 'dated_article_evidence_used'
        : assessment.kind === 'independent_news_sources' ? 'independent_news_sources_used'
        : 'insufficient_evidence');
  return { hits: assessment.hits, kind: assessment.kind,
    safeNarrativeCandidateCount: 'safeCandidateCount' in assessment ? assessment.safeCandidateCount : null,
    primaryDiagnostics: primaryEvidenceDiagnostics([...pages, ...hits], request),
    reason: 'reason' in assessment ? assessment.reason : assessment.kind, diagnosticStages, readFailures };
}

export async function searchContextForRequest(query: string, request: string,
  operations?: SearchOperations, seenSourceUrls: readonly string[] = []) {
  const active = operations ?? { search: searchWeb, read: readPublicWebPage };
  const fresh = needsFreshEvidence(request);
  const retrievalQuery = fresh ? refinedRetrievalQuery(query) : query;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric',
    month: '2-digit', day: '2-digit' }).format(new Date());
  const window = narrativeDateRange(request, today);
  const datedNews = fresh && evidenceModeForRequest(request) === 'fresh_news' && datedNewsRequest(request);
  const resource = await active.search(retrievalQuery, undefined, datedNews ? {
    publishedRange: { start: new Date(window.start).toISOString().slice(0, 10), end: new Date(window.end).toISOString().slice(0, 10) },
  } : undefined);
  const readCache = new Map<string, ReturnType<typeof readPublicWebPage>>();
  let urlReadCount = 0;
  const readOnce: typeof readPublicWebPage = (url, options) => {
    let result = readCache.get(url);
    if (!result) {
      if (urlReadCount >= 2) return Promise.reject(new Error('URL_READ_BUDGET_EXHAUSTED'));
      urlReadCount++; result = active.read(url, options); readCache.set(url, result);
    }
    return result;
  };
  const candidates = dedupeSearchHits(resource.hits);
  let hits = candidates;
  let diagnosticStages: string[] = [];
  let readFailures: string[] = [];
  let assessmentKind: string | null = null;
  let assessmentReason: string | null = null;
  let safeNarrativeCandidateCount: number | null = null;
  let primaryDiagnostics = primaryEvidenceDiagnostics(candidates, request);
  const technicalFallback = resource.execution?.fallbackUsed ?? false;
  const evidenceMode: EvidenceMode = fresh ? evidenceModeForRequest(request) : 'general_web';
  if (fresh) {
    ({ hits, kind: assessmentKind, reason: assessmentReason, diagnosticStages, readFailures, safeNarrativeCandidateCount,
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
    webUrlReadFailures: readFailures,
    webUrlIncompleteEvidenceCount: hits.filter((hit) => hit.contentComplete === false).length,
    officialEvidenceUsed: hits.some((hit) => likelyPrimarySource(hit, request)),
    urlReadOutcome: diagnosticStages.some((stage) => stage.endsWith('_url_read_succeeded')) ? 'succeeded'
      : diagnosticStages.some((stage) => stage.endsWith('_url_read_failed')) ? 'failed' : 'not_attempted',
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
