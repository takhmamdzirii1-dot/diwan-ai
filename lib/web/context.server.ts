import 'server-only';
import { attachConversationFile, attachmentRequestContext } from '@/lib/chat/conversation-attachments';
import { boundedConnectedContent, connectedResourceAttachment } from '@/lib/connected-apps/core';
import type { WebContextTool } from './selection';
import { readPublicWebPage } from './url-reader.server';
import { searchWeb } from './search.server';
import { searchEvidence } from './evidence';

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

export async function searchContextForRequest(query: string, request: string) {
  const resource = await searchWeb(query);
  const evidence = searchEvidence(resource.hits, request);
  const context = await webContextForRequest({ kind: 'web_search', query }, request,
    { read: readPublicWebPage, search: async () => ({ ...resource, text: evidence.text }) });
  return { context, hits: resource.hits, evidence };
}
