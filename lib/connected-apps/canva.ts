import 'server-only';
import { z } from 'zod';
import { parseCredentials } from './oauth';
import { connectedBody, connectedHttp } from './http.server';
import { explicitConnectedWriteRequest, type ConnectedAppAdapter, type ConnectedCredentials } from './core';

const scopes = ['profile:read', 'design:meta:read'];
const inputSchema = z.object({ query: z.string().max(255), continuation: z.string().min(1).max(2000).optional() }).strict();
const designId = z.string().regex(/^[A-Za-z0-9_-]{1,200}$/u);
const writeInput = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('create_design'), title: z.string().min(1).max(255),
    designType: z.enum(['doc', 'presentation', 'whiteboard', 'email']) }).strict(),
  z.object({ operation: z.literal('export_design'), designId, format: z.enum(['pdf', 'pptx']) }).strict(),
]);
const exportStatusInput = z.object({ jobId: z.string().uuid() }).strict();
const writeIntent = (request: string) => /\bcanva\b/iu.test(request) && explicitConnectedWriteRequest(request);
const exportJob = z.object({ job: z.object({ id: z.string().uuid(), status: z.enum(['in_progress', 'success', 'failed']),
  urls: z.array(z.string().url().max(4000).refine(value => {
    const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password
      && (url.hostname === 'canva.com' || url.hostname.endsWith('.canva.com'));
  })).max(100).optional() }) });

export function canvaAdapter(fetcher: typeof fetch = fetch): ConnectedAppAdapter {
  const grantedScopes = [...scopes, ...(process.env.CONNECTED_APPS_WRITES_ENABLED === 'true'
    ? ['design:content:read', 'design:content:write'] : [])];
  const api = connectedHttp('https://api.canva.com', fetcher);
  const clientId = () => process.env.CANVA_CLIENT_ID!;
  const basic = () => `Basic ${Buffer.from(`${clientId()}:${process.env.CANVA_CLIENT_SECRET!}`).toString('base64')}`;
  const token = async (parameters: Record<string, string>, previous?: ConnectedCredentials) => {
    const response = await api('/rest/v1/oauth/token', { method: 'POST', headers: { Authorization: basic() }, body: new URLSearchParams(parameters) });
    const grant = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1),
      expires_in: z.number().int().positive().max(86400), scope: z.string(), token_type: z.string().refine(value => value.toLowerCase() === 'bearer') })
      .parse(JSON.parse(await connectedBody(response, 40_000)));
    const granted = grant.scope.split(' ').filter(Boolean);
    if (grantedScopes.some(scope => !granted.includes(scope))) throw new Error('permission_missing');
    const account = previous?.account ?? await (async () => {
      const headers = { Authorization: `Bearer ${grant.access_token}` };
      const identity = z.object({ team_user: z.object({ user_id: z.string().min(1).max(256), team_id: z.string().min(1).max(256) }) })
        .parse(JSON.parse(await connectedBody(await api('/rest/v1/users/me', { headers }), 10_000)));
      const profile = z.object({ profile: z.object({ display_name: z.string().max(160).optional() }) })
        .parse(JSON.parse(await connectedBody(await api('/rest/v1/users/me/profile', { headers }), 10_000)));
      return { id: identity.team_user.user_id, name: profile.profile.display_name || 'Canva account' };
    })();
    return parseCredentials({ accessToken: grant.access_token, refreshToken: grant.refresh_token, account, scopes: granted,
      expiresAt: new Date(Date.now() + grant.expires_in * 1000).toISOString() });
  };
  return { id: 'canva', name: 'Canva', authorization: 'oauth', oauth: {
    authorize: ({ redirectUri, state, challenge }) => {
      const url = new URL('https://www.canva.com/api/oauth/authorize');
      url.search = new URLSearchParams({ client_id: clientId(), redirect_uri: redirectUri, state, code_challenge: challenge,
        code_challenge_method: 's256', response_type: 'code', scope: grantedScopes.join(' ') }).toString(); return url.toString();
    },
    exchange: ({ redirectUri, code, verifier }) => token({ grant_type: 'authorization_code', redirect_uri: redirectUri, code, code_verifier: verifier }),
    refresh: previous => { if (!previous.refreshToken) throw new Error('authorization_expired');
      return token({ grant_type: 'refresh_token', refresh_token: previous.refreshToken }, previous); },
    revoke: async previous => { await api('/rest/v1/oauth/revoke', { method: 'POST', headers: { Authorization: basic() },
      body: new URLSearchParams({ token: previous.refreshToken ?? previous.accessToken }) }); },
  }, actions: [{ id: 'search_canva', description: 'Find the user-requested Canva designs. Return metadata only, not an invented design preview or export. Use the continuation token only when the user requests more results.',
    classification: 'read', risk: 'low', requiredScopes: ['design:meta:read'], requiresConnection: true, requiresConfirmation: false,
    parameters: inputSchema, matches: request => /\bcanva\b/iu.test(request) && !writeIntent(request)
      && !/\bexport\b|تصدير|exportation/iu.test(request) },
    ...(process.env.CONNECTED_APPS_WRITES_ENABLED === 'true' ? [
      { id: 'write_canva', description: 'Prepare a blank Canva design or PDF/PPTX export for user review. A blank design is not generated artwork. Export is asynchronous; never claim a download exists before a success result.',
        classification: 'write' as const, risk: 'low' as const, requiredScopes: ['design:content:read', 'design:content:write'],
        requiresConnection: true, requiresConfirmation: true, parameters: writeInput, matches: writeIntent,
        reviewSummary: (args: Record<string, unknown>) => args.operation === 'create_design'
          ? `Create blank ${args.designType}: ${args.title}` : `Export Canva design ${args.designId} as ${args.format}` },
      { id: 'read_canva_export', description: 'Read the status of the Canva export job explicitly requested by its ID. Download links are returned only on success and expire after 24 hours. Do not automatically poll.',
        classification: 'read' as const, risk: 'low' as const, requiredScopes: ['design:content:read'], requiresConnection: true,
        requiresConfirmation: false, parameters: exportStatusInput,
        matches: (request: string) => /\bcanva\b/iu.test(request) && !writeIntent(request) && /\bexport\b|تصدير|exportation/iu.test(request) },
    ] : [])],
    execute: async ({ actionId, credential, arguments: args, request, signal }) => {
      const grant = parseCredentials(JSON.parse(credential ?? '{}'));
      const headers = { Authorization: `Bearer ${grant.accessToken}`, 'Content-Type': 'application/json' };
      if (actionId === 'write_canva') {
        const input = writeInput.parse(args);
        if (input.operation === 'create_design') {
          const value = z.object({ design: z.object({ id: designId, urls: z.object({ edit_url: z.string().url() }) }) })
            .parse(JSON.parse(await connectedBody(await api('/rest/v1/designs', { method: 'POST', headers,
              body: JSON.stringify({ type: 'type_and_asset', title: input.title, design_type: { type: 'preset', name: input.designType } }) }, signal))));
          const url = new URL(value.design.urls.edit_url);
          if (url.origin !== 'https://www.canva.com') throw new Error('resource_not_found');
          return { sourceId: value.design.id, name: 'Canva blank design', mimeType: 'text/plain', text: `Blank design created. Open Canva to edit: ${url}. Unedited blank designs expire after 7 days.` };
        }
        const value = exportJob.parse(JSON.parse(await connectedBody(await api('/rest/v1/exports', {
          method: 'POST', headers, body: JSON.stringify({ design_id: input.designId, format: { type: input.format } }) }, signal))));
        return { sourceId: value.job.id, name: 'Canva export', mimeType: 'text/plain', text: JSON.stringify(value) };
      }
      if (actionId === 'read_canva_export') {
        const input = exportStatusInput.parse(args);
        if (!request.includes(input.jobId)) throw new Error('permission_missing');
        const value = exportJob.parse(JSON.parse(await connectedBody(await api(`/rest/v1/exports/${input.jobId}`, { headers }, signal))));
        if (value.job.status === 'success' && !value.job.urls?.length) throw new Error('resource_not_found');
        return { sourceId: value.job.id, name: 'Canva export status', mimeType: 'text/plain', text: JSON.stringify(value) };
      }
      if (actionId !== 'search_canva') throw new Error('permission_missing');
      const input = inputSchema.parse(args);
      const query = new URLSearchParams({ query: input.query, ...(input.continuation ? { continuation: input.continuation } : {}) });
      const value = z.object({ items: z.array(z.object({ id: z.string().max(200), title: z.string().max(500).optional() })).max(100),
        continuation: z.string().max(2000).optional() }).parse(JSON.parse(await connectedBody(await api(`/rest/v1/designs?${query}`, {
          headers: { Authorization: `Bearer ${grant.accessToken}` } }, signal))));
      // Do not drop a provider page and accidentally skip records through its continuation.
      return { sourceId: 'canva-designs', name: 'Canva designs', mimeType: 'text/plain', text: JSON.stringify(value) };
    },
  };
}
