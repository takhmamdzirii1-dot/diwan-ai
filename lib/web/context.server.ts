import 'server-only';
import { attachConversationFile, attachmentRequestContext } from '@/lib/chat/conversation-attachments';
import { boundedConnectedContent, connectedResourceAttachment } from '@/lib/connected-apps/core';
import type { WebContextTool } from './selection';
import { readPublicWebPage } from './url-reader.server';
import { searchWeb } from './search.server';

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
