import 'server-only';
import { attachConversationFile, attachmentRequestContext } from '@/lib/chat/conversation-attachments';
import { boundedConnectedContent, connectedResourceAttachment } from '@/lib/connected-apps/core';
import type { WebContextTool } from './selection';
import { readPublicWebPage } from './url-reader.server';
import { searchWeb } from './search.server';
import { likelyPrimarySource, needsFreshEvidence, rankedEvidence, searchEvidence } from './evidence';

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
  if (needsFreshEvidence(request)) {
    // Search snippets are discovery only. An unreadable primary page is not verified evidence.
    const verified = [] as typeof hits;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric',
      month: '2-digit', day: '2-digit' }).format(new Date());
    for (const hit of rankedEvidence(hits.filter((candidate) => likelyPrimarySource(candidate, request)),
      request, today).slice(0, 2)) {
      try {
        const page = await operations.read(hit.url);
        if (new URL(page.sourceId).hostname !== new URL(hit.url).hostname) continue;
        const excerpt = boundedConnectedContent(page, request, 2_000);
        if (!excerpt || excerpt.length < 24) continue;
        verified.push({ ...hit, description: excerpt.slice(0, 500), verifiedPage: true });
      } catch { /* A failed primary read cannot promote its search snippet to a fact. */ }
    }
    hits = rankedEvidence(verified, request, today);
  }
  const evidence = searchEvidence(hits, request);
  const evidenceText = hits.length ? evidence.text : 'No primary page could be verified for this fresh factual request. Do not guess a current value.';
  const context = await webContextForRequest({ kind: 'web_search', query }, request,
    { read: operations.read, search: async () => ({ ...resource, text: evidenceText }) });
  return { context, hits, evidence };
}
