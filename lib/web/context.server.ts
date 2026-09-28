import 'server-only';
import { attachConversationFile, attachmentRequestContext } from '@/lib/chat/conversation-attachments';
import { boundedConnectedContent, connectedResourceAttachment } from '@/lib/connected-apps/core';
import type { WebContextTool } from './selection';
import { readPublicWebPage } from './url-reader.server';
import { searchWeb } from './search.server';
import { freshFactKey, likelyPrimarySource, needsFreshEvidence, rankedEvidence, searchEvidence } from './evidence';

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

export async function searchContextForRequest(query: string, request: string,
  operations: { search: typeof searchWeb; read: typeof readPublicWebPage }
    = { search: searchWeb, read: readPublicWebPage }) {
  const resource = await operations.search(query);
  let hits = resource.hits;
  const diagnosticStages: string[] = [];
  if (needsFreshEvidence(request)) {
    const primaryPages = [] as typeof hits;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric',
      month: '2-digit', day: '2-digit' }).format(new Date());
    const primary = hits.filter((candidate) => likelyPrimarySource(candidate, request));
    diagnosticStages.push(primary.length ? 'primary_candidate_found' : 'no_primary_candidate_found');
    for (const hit of rankedEvidence(primary, request, today).slice(0, 2)) {
      try {
        const page = await operations.read(hit.url);
        if (new URL(page.sourceId).hostname !== new URL(hit.url).hostname) {
          diagnosticStages.push('primary_url_read_failed'); continue;
        }
        diagnosticStages.push('primary_url_read_succeeded');
        const excerpt = boundedConnectedContent(page, request, 2_000);
        if (!excerpt || excerpt.length < 24 || !freshFactKey(excerpt, request)) continue;
        primaryPages.push({ ...hit, description: excerpt.slice(0, 500), verifiedPage: true,
          evidenceLevel: 'primary_page' });
      } catch { diagnosticStages.push('primary_url_read_failed'); }
    }
    if (primaryPages.length) hits = rankedEvidence(primaryPages, request, today);
    else {
      // A failed page extraction does not invalidate a claim-bearing result from its official URL.
      const officialResults = rankedEvidence(primary.filter((hit) =>
        freshFactKey(`${hit.title} ${hit.description}`, request)), request, today);
      if (officialResults.length) {
        hits = officialResults.map((hit) => ({ ...hit, evidenceLevel: 'primary_search' as const }));
        diagnosticStages.push('official_search_result_evidence_used');
      } else {
        const byFact = new Map<string, typeof hits>();
        for (const hit of hits.filter((candidate) => !likelyPrimarySource(candidate, request))) {
          const key = freshFactKey(`${hit.title} ${hit.description}`, request);
          if (key) byFact.set(key, [...(byFact.get(key) ?? []), hit]);
        }
        const matchingGroups = [...byFact.values()].map((group) => {
          const domains = new Set<string>();
          return group.filter((hit) => {
            try {
              const parts = new URL(hit.url).hostname.split('.');
              const domain = parts.slice(-2).join('.');
              if (domains.has(domain)) return false;
              domains.add(domain); return true;
            } catch { return false; }
          });
        }).filter((group) => group.length >= 2);
        const corroborated = matchingGroups.length === 1
          ? rankedEvidence(matchingGroups[0].map((hit) => ({ ...hit,
            evidenceLevel: 'corroborated' as const })), request, today) : [];
        hits = corroborated.length >= 2 ? corroborated : [];
        diagnosticStages.push(hits.length ? 'corroborated_secondary_evidence_used' : 'insufficient_evidence');
      }
    }
    // Stage names only: never log the query, URLs, page text, credentials, or user content.
    console.info('WEB_EVIDENCE_STAGE', { stages: diagnosticStages });
  }
  const evidence = searchEvidence(hits, request);
  const evidenceText = hits.length ? evidence.text : 'No sufficiently supported current fact could be verified. Do not guess a value.';
  const context = await webContextForRequest({ kind: 'web_search', query }, request,
    { read: operations.read, search: async () => ({ ...resource, text: evidenceText }) });
  return { context, hits, evidence, diagnosticStages };
}
