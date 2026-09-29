import 'server-only';
import { attachConversationFile, attachmentRequestContext } from '@/lib/chat/conversation-attachments';
import { boundedConnectedContent, connectedResourceAttachment } from '@/lib/connected-apps/core';
import type { WebContextTool } from './selection';
import { readPublicWebPage } from './url-reader.server';
import { configuredWebSearchProviders, searchWeb, type WebSearchHit } from './search.server';
import { assessFreshEvidenceBundle, assessNarrativeEvidenceBundle, dedupeSearchHits, evidenceModeForRequest,
  freshFactKey, likelyPrimarySource, needsFreshEvidence, rankedEvidence, relevantWebHit,
  searchEvidence, supportsPrimaryPage, type EvidenceMode } from './evidence';

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

/** Optional model-invoked search must not turn a normal Chat into a hard failure. */
export async function optionalWebContext(query: string, request: string,
  search: (query: string) => Promise<WebResource> = searchWeb) {
  try { return { status: 'ok' as const, context: await webContextForRequest(
    { kind: 'web_search', query }, request, { read: readPublicWebPage, search }) }; }
  catch { return { status: 'unavailable' as const, context: '' }; }
}

type SearchOperations = { search: typeof searchWeb; read: typeof readPublicWebPage;
  fallback?: typeof searchWeb };

function refinedRetrievalQuery(request: string) {
  const intent = /\b(?:version|release)\b|(?:إصدار|اصدار|نسخة)/iu.test(request)
    ? 'latest current release official'
    : /\b(?:price|cost)\b|(?:سعر|الأسعار|الاسعار)/iu.test(request)
      ? 'current official price' : /\b(?:availability|stock|status)\b|(?:متاح|متوفر|الحالة)/iu.test(request)
        ? 'current official availability' : null;
  if (!intent) return request;
  const ignored = new Set(['latest', 'current', 'version', 'release', 'official', 'price', 'cost',
    'availability', 'stock', 'status', 'what', 'which', 'now', 'today', 'the', 'is']);
  const entities = (request.match(/[A-Za-z][A-Za-z0-9.+-]*/g) ?? [])
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
    : assessNarrativeEvidenceBundle([...pages, ...hits], request, today, 'fresh_news');
  diagnosticStages.push(assessment.kind === 'primary_exact'
    ? assessment.hits.some((hit) => hit.verifiedPage) ? 'primary_page_evidence_used'
      : 'official_search_result_evidence_used'
    : assessment.kind === 'primary_supported_bundle' ? 'primary_supported_bundle_used'
      : assessment.kind === 'corroborated_exact' ? 'corroborated_secondary_evidence_used'
        : assessment.kind === 'independent_news_sources' ? 'independent_news_sources_used'
        : 'insufficient_evidence');
  return { hits: assessment.hits, kind: assessment.kind,
    reason: 'reason' in assessment ? assessment.reason : assessment.kind, diagnosticStages };
}

export async function searchContextForRequest(query: string, request: string,
  operations?: SearchOperations) {
  const active = operations ?? { search: searchWeb, read: readPublicWebPage,
    fallback: ((fallbackQuery: string) => searchWeb(fallbackQuery, undefined, {
      providers: configuredWebSearchProviders().filter((provider) => provider.id === 'tavily'),
    })) as typeof searchWeb };
  const fresh = needsFreshEvidence(request);
  const retrievalQuery = fresh ? refinedRetrievalQuery(query) : query;
  const resource = await active.search(retrievalQuery);
  const readCache = new Map<string, ReturnType<typeof readPublicWebPage>>();
  const readOnce: typeof readPublicWebPage = (url, options) => {
    if (options) return active.read(url, options);
    let result = readCache.get(url);
    if (!result) { result = active.read(url); readCache.set(url, result); }
    return result;
  };
  let candidates = dedupeSearchHits(resource.hits);
  let hits = candidates;
  let diagnosticStages: string[] = [];
  let assessmentKind: string | null = null;
  let assessmentReason: string | null = null;
  const technicalFallback = resource.execution?.fallbackUsed ?? false;
  let fallbackUsed = technicalFallback;
  let fallbackResultCount = technicalFallback ? resource.hits.length : 0;
  const evidenceMode: EvidenceMode = fresh ? evidenceModeForRequest(request) : 'general_web';
  if (fresh) {
    ({ hits, kind: assessmentKind, reason: assessmentReason, diagnosticStages } = await assessFreshHits(
      candidates, request, readOnce, evidenceMode));
  } else {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric',
      month: '2-digit', day: '2-digit' }).format(new Date());
    const assessment = assessNarrativeEvidenceBundle(candidates, request, today, 'general_web');
    hits = assessment.hits; assessmentKind = assessment.kind; assessmentReason = assessment.reason;
  }
  const initialQuality = assessmentKind ?? (!hits.length ? 'insufficient' : hits[0].evidenceLevel === 'primary_page'
    ? 'primary_page' : hits[0].evidenceLevel === 'primary_search' ? 'official_search'
      : hits[0].evidenceLevel === 'corroborated' ? 'corroborated' : 'search_results');
  // A successful Brave transport is not a successful evidence search. One Tavily attempt
  // is allowed only if Brave evidence is insufficient and Tavily was not already used.
  if (!hits.length && active.fallback && resource.execution?.providerUsed !== 'tavily' && !fallbackUsed) {
    fallbackUsed = true;
    try {
      const fallback = await active.fallback(retrievalQuery);
      fallbackResultCount = fallback.hits.length;
      candidates = dedupeSearchHits([...candidates, ...fallback.hits]);
      if (fresh) {
        const second = await assessFreshHits(candidates, request, readOnce, evidenceMode);
        hits = second.hits; assessmentKind = second.kind; assessmentReason = second.reason;
        diagnosticStages.push(...second.diagnosticStages);
      } else {
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric',
          month: '2-digit', day: '2-digit' }).format(new Date());
        const second = assessNarrativeEvidenceBundle(candidates, request, today, 'general_web');
        hits = second.hits; assessmentKind = second.kind; assessmentReason = second.reason;
      }
    } catch { diagnosticStages.push('fallback_unavailable'); }
  }
  hits = hits.map((hit, index) => ({ ...hit, evidenceId: `S${index + 1}` }));
  const quality = assessmentKind ?? (!hits.length ? 'insufficient' : hits[0].evidenceLevel === 'primary_page'
    ? 'primary_page' : hits[0].evidenceLevel === 'primary_search' ? 'official_search'
      : hits[0].evidenceLevel === 'corroborated' ? 'corroborated' : 'search_results');
  const exactFactGroupCount = new Set(candidates.map((hit) => freshFactKey(`${hit.title} ${hit.description}`, request))
    .filter(Boolean)).size;
  const relevantCandidateCount = candidates.filter((hit) => relevantWebHit(hit, request)).length;
  const independentDomainCount = new Set(candidates.map((hit) => new URL(hit.url).hostname.replace(/^www\./, '')
    .split('.').slice(-2).join('.'))).size;
  const reason = quality === 'insufficient' && evidenceMode === 'structured_fact'
    ? exactFactGroupCount > 1 ? 'unresolved_exact_conflict'
      : relevantCandidateCount ? 'insufficient_source_diversity' : 'no_relevant_sources'
    : assessmentReason ?? quality;
  const telemetry = { searchTriggered: true, evidenceMode, assessmentReason: reason,
    primaryCandidateCount: candidates.filter((hit) => likelyPrimarySource(hit, request)).length,
    exactFactGroupCount, relevantCandidateCount, independentDomainCount,
    selectedEvidenceCount: hits.length,
    primaryProvider: resource.execution?.providerAttempted[0] ?? 'brave',
    primaryResultCount: technicalFallback ? 0 : resource.hits.length,
    evidenceQuality: initialQuality, evidenceSufficient: hits.length > 0,
    fallbackUsed, fallbackProvider: fallbackUsed ? 'tavily' : null, fallbackResultCount,
    officialEvidenceUsed: hits.some((hit) => likelyPrimarySource(hit, request)),
    urlReadOutcome: diagnosticStages.includes('primary_url_read_succeeded') ? 'succeeded'
      : diagnosticStages.includes('primary_url_read_failed') ? 'failed' : 'not_attempted',
    finalEvidenceQuality: quality, citationsCount: null as number | null,
    citationCandidatesCount: Math.min(hits.length, 3) };
  // Metadata only: never log query, URLs, source text, credentials, or user content.
  console.info('WEB_EVIDENCE_EXECUTION', telemetry);
  const evidence = searchEvidence(hits, request);
  const evidenceText = hits.length ? evidence.text : 'No sufficiently supported current fact could be verified. Do not guess a value.';
  const context = await webContextForRequest({ kind: 'web_search', query }, request,
    { read: active.read, search: async () => ({ ...resource, text: evidenceText }) });
  return { context, hits, evidence, diagnosticStages, telemetry };
}
