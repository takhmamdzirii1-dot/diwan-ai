import 'server-only';
import { z } from 'zod';
import { parseCredentials } from './oauth';
import { connectedBody, connectedHttp } from './http.server';
import { explicitConnectedWriteRequest, type ConnectedAppAdapter, type ConnectedCredentials } from './core';

const slug = z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/u).refine(value => !['.', '..'].includes(value));
const repository = z.object({ owner: slug, repo: slug });
const inputSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('repositories'), page: z.number().int().min(1).max(100).default(1) }).strict(),
  repository.extend({ operation: z.enum(['issues', 'pull_requests']), page: z.number().int().min(1).max(100).default(1) }).strict(),
  repository.extend({ operation: z.literal('file'), path: z.string().min(1).max(500).refine(value => !value.split('/').some(part => ['.', '..', ''].includes(part))),
    ref: z.string().min(1).max(150).optional() }).strict(),
]);
const writeInput = z.discriminatedUnion('operation', [
  repository.extend({ operation: z.literal('create_issue'), title: z.string().min(1).max(200), body: z.string().max(12_000) }).strict(),
  repository.extend({ operation: z.literal('create_pull_request'), title: z.string().min(1).max(200), body: z.string().max(12_000),
    head: z.string().min(1).max(150), base: z.string().min(1).max(150), draft: z.boolean().default(true) }).strict(),
]);
const writeIntent = (request: string) => explicitConnectedWriteRequest(request) && /\bgithub\b/iu.test(request)
  && /\b(?:issue|pull request|PR)\b|(?:مشكلة|طلب دمج)|(?:ticket|pull request|demande de fusion)/iu.test(request);

export function requestedGithubRepository(request: string, owner: string, repo: string): boolean {
  return (request.match(/https:\/\/github\.com\/[^\s<>"']+/giu) ?? []).some(value => {
    try { const url = new URL(value); const segments = url.pathname.split('/').filter(Boolean);
      return url.origin === 'https://github.com' && !url.username && !url.password
        && segments[0]?.toLowerCase() === owner.toLowerCase() && segments[1]?.toLowerCase() === repo.toLowerCase();
    } catch { return false; }
  });
}

export function githubAdapter(fetcher: typeof fetch = fetch): ConnectedAppAdapter {
  const api = connectedHttp('https://api.github.com', fetcher);
  const auth = connectedHttp('https://github.com', fetcher);
  const clientId = () => process.env.GITHUB_CONNECTED_APP_CLIENT_ID!;
  const clientSecret = () => process.env.GITHUB_CONNECTED_APP_CLIENT_SECRET!;
  const headers = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' });
  const token = async (parameters: Record<string, string>, previous?: ConnectedCredentials) => {
    const response = await auth('/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json' },
      body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), ...parameters }) });
    const value = z.object({ access_token: z.string().min(1), token_type: z.literal('bearer'),
      expires_in: z.number().int().positive().max(86400), refresh_token: z.string().min(1), scope: z.literal('') })
      .parse(JSON.parse(await connectedBody(response, 40_000)));
    // Expiring GitHub App user tokens, not an OAuth App's broad repo scope or a shared PAT.
    const account = previous?.account ?? await (async () => {
      const user = z.object({ id: z.number().int().positive(), login: slug })
        .parse(JSON.parse(await connectedBody(await api('/user', { headers: headers(value.access_token) }), 20_000)));
      return { id: String(user.id), name: user.login };
    })();
    return parseCredentials({ accessToken: value.access_token, refreshToken: value.refresh_token, account,
      scopes: ['github.user.read'], expiresAt: new Date(Date.now() + value.expires_in * 1000).toISOString() });
  };
  return { id: 'github', name: 'GitHub', authorization: 'oauth',
    oauth: {
      authorize: ({ redirectUri, state, challenge }) => {
        const url = new URL('https://github.com/login/oauth/authorize');
        url.search = new URLSearchParams({ client_id: clientId(), redirect_uri: redirectUri, state,
          code_challenge: challenge, code_challenge_method: 'S256', allow_signup: 'false' }).toString(); return url.toString();
      },
      exchange: ({ redirectUri, code, verifier }) => token({ redirect_uri: redirectUri, code, code_verifier: verifier }),
      refresh: previous => token({ grant_type: 'refresh_token', refresh_token: previous.refreshToken! }, previous),
      revoke: async previous => { await api(`/applications/${encodeURIComponent(clientId())}/grant`, { method: 'DELETE',
        headers: { Authorization: `Basic ${Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: previous.accessToken }) }); },
    },
    actions: [{ id: 'read_github', description: 'Discover accessible GitHub repositories or read issues, pull requests, or a text file from the repository explicitly requested by URL. Maximum 10 records per page. GitHub enforces the App installation and user permissions on every call.',
      classification: 'read', risk: 'low', requiredScopes: ['github.user.read'], requiresConnection: true, requiresConfirmation: false,
      parameters: inputSchema, matches: request => /\bgithub\b/iu.test(request) && !writeIntent(request) },
      ...(process.env.CONNECTED_APPS_WRITES_ENABLED === 'true' ? [{ id: 'write_github', description: 'Prepare an issue or pull request in the explicitly requested GitHub repository. User reviews the exact repository, title, content and branches before creation. Never merge, push or run code.',
        classification: 'write' as const, risk: 'high' as const, requiredScopes: ['github.user.read'], requiresConnection: true, requiresConfirmation: true,
        parameters: writeInput, matches: writeIntent, reviewSummary: (args: Record<string, unknown>) => `${args.operation}: ${args.owner}/${args.repo} · ${String(args.title).slice(0, 200)}` }] : [])],
    execute: async ({ actionId, credential, arguments: args, request, signal }) => {
      const grant = parseCredentials(JSON.parse(credential ?? '{}'));
      if (actionId === 'write_github') {
        const input = writeInput.parse(args);
        if (!requestedGithubRepository(request, input.owner, input.repo)) throw new Error('permission_missing');
        const base = `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}`;
        const body = input.operation === 'create_issue' ? { title: input.title, body: input.body }
          : { title: input.title, body: input.body, head: input.head, base: input.base, draft: input.draft };
        const result = z.object({ number: z.number().int().positive(), html_url: z.string().url() }).parse(JSON.parse(await connectedBody(await api(
          `${base}/${input.operation === 'create_issue' ? 'issues' : 'pulls'}`, { method: 'POST', headers: { ...headers(grant.accessToken), 'Content-Type': 'application/json' },
            body: JSON.stringify(body) }, signal), 20_000)));
        const url = new URL(result.html_url);
        if (url.origin !== 'https://github.com' || !url.pathname.startsWith(`/${input.owner}/${input.repo}/`)) throw new Error('resource_not_found');
        return { sourceId: String(result.number), name: 'GitHub action', mimeType: 'text/plain', text: `Created the reviewed ${input.operation === 'create_issue' ? 'issue' : 'pull request'}: ${url}` };
      }
      if (actionId !== 'read_github') throw new Error('permission_missing');
      const input = inputSchema.parse(args);
      if (input.operation !== 'repositories' && !requestedGithubRepository(request, input.owner, input.repo)) throw new Error('permission_missing');
      const base = input.operation === 'repositories' ? '/user/repos' : `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}`;
      const path = input.operation === 'repositories' ? `${base}?per_page=10&page=${input.page}`
        : input.operation === 'file' ? `${base}/contents/${input.path.split('/').map(encodeURIComponent).join('/')}?${new URLSearchParams(input.ref ? { ref: input.ref } : {})}`
          : `${base}/${input.operation === 'issues' ? 'issues' : 'pulls'}?per_page=10&page=${input.page}&state=all`;
      const value: unknown = JSON.parse(await connectedBody(await api(path, { headers: headers(grant.accessToken) }, signal)));
      let text: string;
      if (input.operation === 'file') {
        const file = z.object({ encoding: z.literal('base64'), content: z.string().max(100_000), size: z.number().max(30_000), name: z.string().max(160) }).parse(value);
        text = Buffer.from(file.content, 'base64').toString('utf8');
        if (text.includes('\u0000') || text.includes('\ufffd')) throw new Error('resource_not_found');
      } else {
        const rows = z.array(z.object({ id: z.number(), full_name: z.string().optional(), number: z.number().optional(),
          title: z.string().optional(), state: z.string().optional(), body: z.string().nullable().optional(), description: z.string().nullable().optional() })).max(10).parse(value);
        text = JSON.stringify({ items: rows.map(row => ({ ...row, body: row.body?.slice(0, 1500) })),
          page: input.page, mayHaveMore: rows.length === 10 });
      }
      return { sourceId: 'github-result', name: 'GitHub result', mimeType: 'text/plain', text };
    },
  };
}
