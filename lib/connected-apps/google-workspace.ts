import 'server-only';
import { z } from 'zod';
import { googleOAuth } from './google-oauth.server';
import { connectedBody, connectedHttp } from './http.server';
import { parseCredentials } from './oauth';
import type { ConnectedAppAdapter } from './core';

export const WORKSPACE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const fileId = z.string().regex(/^[A-Za-z0-9_-]{10,200}$/u);
const title = z.string().trim().min(1).max(160);
const rows = z.array(z.array(z.string().max(1000)).min(1).max(20)).min(1).max(100).refine(value => JSON.stringify(value).length <= 20_000);
const inputSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('create_document'), title, text: z.string().min(1).max(20_000) }).strict(),
  z.object({ operation: z.literal('append_document'), fileId, text: z.string().min(1).max(20_000) }).strict(),
  z.object({ operation: z.literal('create_spreadsheet'), title, rows }).strict(),
  z.object({ operation: z.literal('update_spreadsheet'), fileId, range: z.string().regex(/^(?:[A-Za-z0-9 _-]{1,80}!)?[A-Z]{1,3}[1-9]\d{0,5}(?::[A-Z]{1,3}[1-9]\d{0,5})?$/u), rows }).strict(),
]);

export function googleWorkspaceAdapter(fetcher: typeof fetch = fetch): ConnectedAppAdapter {
  const docs = connectedHttp('https://docs.googleapis.com', fetcher);
  const sheets = connectedHttp('https://sheets.googleapis.com', fetcher);
  return { id: 'google_workspace', name: 'Google Docs / Sheets', authorization: 'oauth',
    oauth: googleOAuth('GOOGLE_WORKSPACE', ['openid', 'email', WORKSPACE_SCOPE], fetcher),
    actions: [{ id: 'write_google_workspace', description: 'Prepare creation/update of the explicitly requested Google Doc or Sheet. Only files created/opened with this app are writable; never request access to all Drive files. Exact content is reviewed before execution.',
      classification: 'write', risk: 'low', requiredScopes: [WORKSPACE_SCOPE], requiresConnection: true, requiresConfirmation: true,
      parameters: inputSchema, matches: request => /\bgoogle\s+(?:docs?|sheets?)\b/iu.test(request),
      reviewSummary: args => `${String(args.operation).replaceAll('_', ' ')}: ${String(args.title ?? args.fileId)}${args.range ? ` · ${args.range}` : ''}` }],
    execute: async ({ actionId, credential, arguments: args, signal }) => {
      if (actionId !== 'write_google_workspace') throw new Error('permission_missing');
      const input = inputSchema.parse(args); const grant = parseCredentials(JSON.parse(credential ?? '{}'));
      const headers = { Authorization: `Bearer ${grant.accessToken}`, 'Content-Type': 'application/json' };
      let id: string;
      if (input.operation === 'create_document' || input.operation === 'append_document') {
        let revision: string | undefined;
        if (input.operation === 'create_document') {
          const created = z.object({ documentId: fileId }).parse(JSON.parse(await connectedBody(await docs('/v1/documents?fields=documentId', {
            method: 'POST', headers, body: JSON.stringify({ title: input.title }) }, signal), 20_000))); id = created.documentId;
        } else {
          id = input.fileId;
          const current = z.object({ documentId: z.literal(id), revisionId: z.string().min(1) }).parse(JSON.parse(await connectedBody(await docs(`/v1/documents/${id}?fields=documentId,revisionId`, { headers }, signal), 20_000)));
          revision = current.revisionId;
        }
        await docs(`/v1/documents/${id}:batchUpdate`, { method: 'POST', headers, body: JSON.stringify({ requests: [
          { insertText: { endOfSegmentLocation: {}, text: input.text } }], ...(revision ? { writeControl: { requiredRevisionId: revision } } : {}) }) }, signal);
      } else if (input.operation === 'create_spreadsheet') {
        const created = z.object({ spreadsheetId: fileId }).parse(JSON.parse(await connectedBody(await sheets('/v4/spreadsheets?fields=spreadsheetId', { method: 'POST', headers,
          body: JSON.stringify({ properties: { title: input.title }, sheets: [{ data: [{ rowData: input.rows.map(row => ({ values: row.map(value => ({ userEnteredValue: { stringValue: value } })) })) }] }] }) }, signal), 20_000)));
        id = created.spreadsheetId;
      } else {
        id = input.fileId;
        await sheets(`/v4/spreadsheets/${id}/values/${encodeURIComponent(input.range)}?valueInputOption=RAW`, { method: 'PUT', headers,
          body: JSON.stringify({ range: input.range, majorDimension: 'ROWS', values: input.rows }) }, signal);
      }
      return { sourceId: id, name: 'Google Workspace result', mimeType: 'text/plain',
        text: `Completed the reviewed ${input.operation.replaceAll('_', ' ')}. https://docs.google.com/${input.operation.includes('spreadsheet') ? 'spreadsheets' : 'document'}/d/${id}/edit` };
    },
  };
}
