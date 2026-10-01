import 'server-only';
import { attachConversationFile, attachmentRequestContext } from '@/lib/chat/conversation-attachments';
import { boundedConnectedContent, connectedResourceAttachment } from '@/lib/connected-apps/core';
import { currentInformationPolicy, type WebContextTool } from './selection';
import { readPublicWebPage } from './url-reader.server';
import { searchWeb, type SearchExecution, type WebSearchHit } from './search.server';
import { likelyPrimarySource, requestedNewsCount, primaryEvidenceDiagnostics, relevantWebHit } from './evidence';
import { researchEvidence, researchEvidenceText, researchEventWindow } from './research-evidence';
import { newsArticleCandidate } from './news-evidence';

type WebResource = Awaited<ReturnType<typeof readPublicWebPage>>;
/** Keep contiguous page context, including adjacent tables. Query-language
 * keyword matching must not silently delete evidence written in another language.
 * Reuse the secret guard, then mark a bounded prefix as incomplete.
 */
export function webPageExcerpt(page: WebResource, maxChars = 5_000) {
  const safe = boundedConnectedContent(page, '', Math.max(page.text.length, maxChars));
  return { text: safe?.slice(0, maxChars) ?? null,
    complete: page.contentComplete !== false && !!safe && safe.length <= maxChars };
}
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

/** Compatibility wrapper; optional and required search share the same observations. */
export async function optionalWebContext(query: string, request: string,
  search: (query: string) => ReturnType<typeof searchWeb> = searchWeb,
  onExecution?: (execution: SearchExecution) => void) {
  try {
    const result = await searchContextForRequest(query, request, { read: readPublicWebPage,
      search: search === searchWeb && onExecution
        ? (value) => searchWeb(value, undefined, { onExecution }) : search });
    return { status: result.hits.length ? 'ok' as const : 'unavailable' as const, context: result.context };
  } catch { return { status: 'unavailable' as const, context: '' }; }
}

/** Compatibility caller: duplicate calls share their acquisition rather than retry. */
export function oncePerTurnOptionalWebSearch(request: string,
  run: (query: string, request: string) => ReturnType<typeof optionalWebContext> = optionalWebContext) {
  let pending: ReturnType<typeof optionalWebContext> | null = null;
  return (query: string) => pending ??= run(query, request);
}

// Technical fallback remains exclusively in the provider orchestrator.
type SearchOperations = { search: typeof searchWeb; read: typeof readPublicWebPage;
  fallback?: typeof searchWeb };

export async function searchContextForRequest(query: string, request: string,
  operations?: SearchOperations, seenSourceUrls: readonly string[] = []) {
  const active = operations ?? { search: searchWeb, read: readPublicWebPage };
  const policy = currentInformationPolicy(request);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const window = researchEventWindow(request, now);
  const resource = await active.search(query, undefined, policy.mode === 'fresh_news' && window.strict ? {
    publishedRange: { start: new Date(window.start).toISOString().slice(0, 10),
      end: new Date(window.end).toISOString().slice(0, 10) },
  } : undefined);
  const candidates = researchEvidence(resource.hits, request, seenSourceUrls);
  const pages: WebSearchHit[] = [];
  const readFailures: string[] = [];
  let readCount = 0;
  // Modest initial enrichment, not a per-turn read cap. The answer model can
  // subsequently read another returned page or refine a specific evidence gap.
  const readCandidates = candidates.filter((hit) => likelyPrimarySource(hit, request)
    || hit.publishedAt || newsArticleCandidate(hit) || hit.description.length < 220);
  if (policy.mode === 'fresh_news') readCandidates.sort((a, b) =>
    Number(newsArticleCandidate(b)) - Number(newsArticleCandidate(a)));
  for (const hit of readCandidates.slice(0, 2)) {
    readCount++;
    try {
      const page = await active.read(hit.url);
      const bounded = webPageExcerpt(page);
      const excerpt = bounded.text;
      if (excerpt) pages.push({ ...hit, description: `Read page excerpt:\n${excerpt}\nSearch preview (may be stale or incomplete):\n${hit.description}`,
        verifiedPage: true, contentComplete: bounded.complete, fetchedAt: page.fetchedAt,
        pagePublishedAt: page.pagePublishedAt ?? hit.publishedAt, pageUpdatedAt: page.pageUpdatedAt ?? null });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : '';
      readFailures.push(['URL_UNSAFE', 'URL_TOO_LARGE', 'URL_UNAVAILABLE', 'URL_CONTENT_UNSUPPORTED'].includes(code)
        ? code : 'URL_READ_FAILED');
    }
  }
  const hits = researchEvidence([...pages, ...candidates], request, seenSourceUrls)
    .map((hit, index) => ({ ...hit, evidenceId: `S${index + 1}` }));
  const text = researchEvidenceText(hits, now, request);
  const quality = !hits.length ? 'no_observations' : pages.length ? 'page_and_search_observations' : 'search_observations';
  const technicalFallback = resource.execution?.fallbackUsed ?? false;
  const telemetry = { searchTriggered: true, evidenceMode: policy.mode,
    ...primaryEvidenceDiagnostics(candidates, request),
    relevantCandidateCount: candidates.filter((hit) => relevantWebHit(hit, request)).length,
    independentDomainCount: new Set(candidates.map((hit) => new URL(hit.url).hostname.replace(/^www\./, '')
      .split('.').slice(-2).join('.'))).size,
    assessmentReason: 'model_interpreted_observations', selectionReason: 'authority_hint_with_competing_observations',
    candidateCount: candidates.length, safeNarrativeCandidateCount: candidates.length,
    requestedItemCount: policy.mode === 'fresh_news' ? requestedNewsCount(request) : null,
    selectedEvidenceCount: hits.length,
    primaryCandidateCount: candidates.filter((hit) => likelyPrimarySource(hit, request)).length,
    primaryProvider: resource.execution?.primaryProvider ?? 'brave',
    primaryResultCount: technicalFallback ? 0 : resource.hits.length,
    evidenceQuality: quality, evidenceSufficient: hits.length > 0,
    fallbackUsed: technicalFallback, fallbackProvider: technicalFallback ? resource.execution?.providerUsed ?? null : null,
    fallbackReason: resource.execution?.fallbackReason ?? null,
    fallbackResultCount: technicalFallback ? resource.hits.length : 0,
    webSearchApiRequestCount: resource.execution?.apiRequestCount ?? null,
    webSearchAttempts: resource.execution?.attempts ?? [],
    webSearchProviderUsed: resource.execution?.providerUsed ?? null,
    webSearchResultCount: resource.hits.length, webSearchTotalLatencyMs: resource.execution?.latencyMs ?? null,
    webUrlReadCount: readCount, webUrlReadFailures: readFailures,
    webUrlIncompleteEvidenceCount: hits.filter((hit) => hit.contentComplete === false).length,
    officialEvidenceUsed: hits.some((hit) => likelyPrimarySource(hit, request)),
    urlReadOutcome: pages.length ? 'succeeded' : readCount ? 'failed' : 'not_attempted',
    finalEvidenceQuality: quality, citationsCount: null as number | null, citationCandidatesCount: hits.length };
  // Content-free telemetry. "Sufficient" means observations are available,
  // not that a regex has certified their factual completeness or freshness.
  console.info('WEB_EVIDENCE_EXECUTION', telemetry);
  return { context: text, hits,
    evidence: { text, today, todayRequested: false, publishedToday: false, notice: '' },
    diagnosticStages: [quality], telemetry };
}
