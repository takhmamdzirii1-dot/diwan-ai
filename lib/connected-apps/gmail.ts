import 'server-only';
import { z } from 'zod';
import { parseCredentials } from './oauth';
import { googleOAuth } from './google-oauth.server';
import { connectedBody, connectedHttp } from './http.server';
import { explicitConnectedWriteRequest, type ConnectedAppAdapter } from './core';

export const GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export const GMAIL_DRAFT_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
const id = z.string().regex(/^[A-Za-z0-9_-]{1,200}$/u);
const searchInput = z.object({ operation: z.literal('search'), query: z.string().trim().min(1).max(400), pageToken: id.optional() }).strict();
const readInput = z.object({ operation: z.literal('read'), messageId: id }).strict();
const inputSchema = z.discriminatedUnion('operation', [searchInput, readInput]);
const draftInput = z.object({ to: z.string().email().max(254), subject: z.string().min(1).max(200).refine(value => !/[\r\n]/u.test(value)),
  body: z.string().min(1).max(12_000), replyMessageId: id.optional() }).strict();
const mailboxRequested = (request: string) => /\bgmail\b|\bmy\s+(?:(?:latest|recent|unread|new|last)\s+){0,3}(?:emails?|mail|inbox)\b|(?:بريدي|صندوق\s+الوارد)|\b(?:mes\s+(?:(?:derniers|nouveaux|récents)\s+){0,3}(?:e-?mails|courriels)|ma\s+bo[iî]te\s+mail)\b/iu.test(request);
const draftIntent = (request: string) => explicitConnectedWriteRequest(request) && mailboxRequested(request)
  && /\b(?:draft|reply|email|message)\b|(?:مسودة|رد|رسالة)|(?:brouillon|répond|message|courriel)/iu.test(request);

function plainParts(part: unknown, depth = 0): string {
  if (depth > 8 || !part || typeof part !== 'object') return '';
  const parsed = z.object({ mimeType: z.string().optional(), body: z.object({ data: z.string().max(160_000).optional() }).optional(),
    parts: z.array(z.unknown()).max(50).optional() }).parse(part);
  if (parsed.mimeType === 'text/plain' && parsed.body?.data) return Buffer.from(parsed.body.data, 'base64url').toString('utf8').slice(0, 20_000);
  return (parsed.parts ?? []).map(child => plainParts(child, depth + 1)).join('\n').slice(0, 20_000);
}

export function gmailAdapter(fetcher: typeof fetch = fetch): ConnectedAppAdapter {
  const api = connectedHttp('https://gmail.googleapis.com', fetcher);
  return { id: 'gmail', name: 'Gmail', authorization: 'oauth',
    oauth: googleOAuth('GMAIL', ['openid', 'email', GMAIL_READ_SCOPE,
      ...(process.env.CONNECTED_APPS_WRITES_ENABLED === 'true' ? [GMAIL_DRAFT_SCOPE] : [])], fetcher),
    actions: [
      { id: 'search_gmail', description: 'Search the explicitly requested Gmail mailbox. Returns up to 10 messages and a continuation token; never reads unrelated mail.',
        classification: 'read', risk: 'low', requiredScopes: [GMAIL_READ_SCOPE], requiresConnection: true, requiresConfirmation: false,
        parameters: inputSchema, matches: request => mailboxRequested(request) && !draftIntent(request) },
      ...(process.env.CONNECTED_APPS_WRITES_ENABLED === 'true' ? [{ id: 'draft_gmail',
        description: 'Prepare a Gmail draft or reply for exact user review in Connected apps. This never sends an email. Do not claim it was created before approval.',
        classification: 'write' as const, risk: 'low' as const, requiredScopes: [GMAIL_READ_SCOPE, GMAIL_DRAFT_SCOPE],
        requiresConnection: true, requiresConfirmation: true, parameters: draftInput, matches: draftIntent,
        reviewSummary: (args: Record<string, unknown>) => `Create Gmail draft to ${args.to}: ${String(args.subject).slice(0, 200)} (not sent)` }] : []),
    ],
    execute: async ({ actionId, credential, arguments: args, signal }) => {
      const grant = parseCredentials(JSON.parse(credential ?? '{}'));
      const headers = { Authorization: `Bearer ${grant.accessToken}` };
      if (actionId === 'draft_gmail') {
        const input = draftInput.parse(args);
        let threadId: string | undefined; let replyHeaders = '';
        if (input.replyMessageId) {
          const original = z.object({ threadId: id, payload: z.object({ headers: z.array(z.object({ name: z.string(), value: z.string().max(2000) })).max(100) }) })
            .parse(JSON.parse(await connectedBody(await api(`/gmail/v1/users/me/messages/${input.replyMessageId}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References&metadataHeaders=Subject`, { headers }, signal), 20_000)));
          const messageId = original.payload.headers.find(header => header.name.toLowerCase() === 'message-id')?.value;
          const references = original.payload.headers.find(header => header.name.toLowerCase() === 'references')?.value ?? '';
          const subject = original.payload.headers.find(header => header.name.toLowerCase() === 'subject')?.value;
          // The reviewed subject must match the thread. Never silently change an
          // approved payload after review to satisfy Gmail's threading contract.
          if (!subject || input.subject.replace(/^re:\s*/iu, '') !== subject.replace(/^re:\s*/iu, '')) throw new Error('permission_missing');
          if (!messageId || /[\r\n]/u.test(messageId + references)) throw new Error('resource_not_found');
          threadId = original.threadId;
          replyHeaders = `In-Reply-To: ${messageId}\r\nReferences: ${references} ${messageId}\r\n`;
        }
        const message = `To: ${input.to}\r\nSubject: =?UTF-8?B?${Buffer.from(input.subject).toString('base64')}?=\r\n${replyHeaders}MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(input.body).toString('base64')}`;
        const value = z.object({ id }).parse(JSON.parse(await connectedBody(await api('/gmail/v1/users/me/drafts', {
          method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: {
            raw: Buffer.from(message).toString('base64url'), ...(threadId ? { threadId } : {}) } }) }, signal), 20_000)));
        return { sourceId: value.id, name: 'Gmail draft', mimeType: 'text/plain', text: `Draft created for ${input.to}. It has not been sent.` };
      }
      if (actionId !== 'search_gmail') throw new Error('permission_missing');
      const input = inputSchema.parse(args);
      if (input.operation === 'read') {
        const response = await api(`/gmail/v1/users/me/messages/${input.messageId}?format=full`, { headers }, signal);
        const value = z.object({ id, snippet: z.string().max(5000).optional(), payload: z.unknown() })
          .parse(JSON.parse(await connectedBody(response)));
        const text = plainParts(value.payload);
        return { sourceId: value.id, name: 'Gmail message', mimeType: 'text/plain',
          text: text || value.snippet || 'This message has no readable plain-text body.', };
      }
      const query = new URLSearchParams({ q: input.query, maxResults: '10', ...(input.pageToken ? { pageToken: input.pageToken } : {}) });
      const listed = z.object({ messages: z.array(z.object({ id, threadId: id })).max(10).optional(), nextPageToken: id.optional() })
        .parse(JSON.parse(await connectedBody(await api(`/gmail/v1/users/me/messages?${query}`, { headers }, signal))));
      // One bounded search result page. Full message bodies require a separately selected message.
      const messages = await Promise.all((listed.messages ?? []).map(async message => {
        const response = await api(`/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { headers }, signal);
        const value = z.object({ id, snippet: z.string().max(5000).optional(), payload: z.object({ headers: z.array(z.object({ name: z.string(), value: z.string() })).max(100) }).optional() })
          .parse(JSON.parse(await connectedBody(response, 20_000)));
        return { id: value.id, snippet: value.snippet?.slice(0, 1000), headers: value.payload?.headers
          .filter(header => ['subject', 'from', 'date'].includes(header.name.toLowerCase())).slice(0, 3)
          .map(header => ({ name: header.name.slice(0, 40), value: header.value.slice(0, 400) })) };
      }));
      return { sourceId: 'gmail-search', name: 'Gmail messages', mimeType: 'text/plain', text: JSON.stringify({ messages, nextPageToken: listed.nextPageToken, partial: true }) };
    },
  };
}

export const gmailMessageInput = readInput;
export const gmailPlainText = plainParts;
