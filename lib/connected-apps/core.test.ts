import assert from 'node:assert/strict';
import test from 'node:test';
import { attachConversationFile, attachmentRequestContext } from '@/lib/chat/conversation-attachments';
import { routeChatIntent } from '@/lib/chat/intent-router';
import { selectArtifactTools } from '@/lib/artifacts/tool-registry';
import { boundedConnectedContent, connectedResourceAttachment, connectionError, executeConnectedAction,
  relevantConnectedActions, type ConnectedAppAdapter, type ConnectedAppConnection } from './core';
import { referenceFilesAdapter } from './reference';

const adapter = referenceFilesAdapter();
const match = relevantConnectedActions('Read the example file', [adapter])[0];
const connected: ConnectedAppConnection = { id: 'connection-1', appId: adapter.id,
  scopes: ['files.read'], status: 'connected', expiresAt: null };
const run = (connection: ConnectedAppConnection | null, credential: string | null = null) =>
  executeConnectedAction({ match, request: 'Read the example file', userId: 'user-1', connection, credential });

test('disconnected action returns connect-required before adapter execution', async () => {
  assert.equal((await run(null)).error, 'app_not_connected');
  assert.equal(connectionError(null, match.action), 'app_not_connected');
});

test('connected read executes and normalizes through Conversation Resources', async () => {
  const result = await run(connected);
  assert.equal(result.error, null);
  assert.ok(result.resource);
  const draft = connectedResourceAttachment(result.resource, adapter.id, connected.id);
  assert.equal(draft.kind, 'document');
  if (draft.kind !== 'document') return;
  assert.equal(draft.artifact.metadata.sourceApp, adapter.id);
  assert.equal(draft.artifact.metadata.sourceResourceId, result.resource.sourceId);
  const context = attachmentRequestContext(attachConversationFile([], draft, 'conversation-1'));
  assert.match(context.documentContext ?? '', /deterministic test resource/);
});

test('missing scope and expired authorization block before provider execution', async () => {
  let executions = 0;
  const guarded: ConnectedAppAdapter = { ...adapter,
    execute: async (input) => { executions++; return adapter.execute(input); } };
  const selected = relevantConnectedActions('Read the example file', [guarded])[0];
  const missing = await executeConnectedAction({ match: selected, request: 'Read the example file',
    userId: 'user-1', connection: { ...connected, scopes: [] }, credential: null });
  assert.equal(missing.error, 'permission_missing');
  const expired = await executeConnectedAction({ match: selected, request: 'Read the example file',
    userId: 'user-1', connection: { ...connected, expiresAt: '2000-01-01T00:00:00Z' }, credential: null });
  assert.equal(expired.error, 'authorization_expired');
  assert.equal(executions, 0);
});

test('another app connection cannot authorize this adapter', async () => {
  assert.equal((await run({ ...connected, appId: 'another_app' })).error, 'app_not_connected');
});

test('sensitive write remains blocked even when a caller claims confirmation', async () => {
  let called = false;
  const write: ConnectedAppAdapter = { ...adapter,
    actions: [{ ...adapter.actions[0], id: 'send_message', classification: 'write', risk: 'high',
      requiresConfirmation: true }], execute: async () => { called = true; throw new Error('should not execute'); } };
  const selected = relevantConnectedActions('Read the example file', [write])[0];
  const result = await executeConnectedAction({ match: selected, request: 'Read the example file',
    userId: 'user-1', connection: connected, credential: null });
  assert.equal(result.error, 'action_requires_confirmation');
  assert.equal(called, false);
});

test('connected app selection coexists with deterministic Universal Action Routing', () => {
  const request = 'Read the example file';
  const routed = routeChatIntent(request);
  assert.equal(routed.intent, 'normal_chat');
  assert.deepEqual(selectArtifactTools(request, { route: routed }).names, []);
  assert.deepEqual(relevantConnectedActions(request, [adapter]).map(({ action }) => action.id), ['read_example_file']);
  assert.deepEqual(relevantConnectedActions('Create a quarterly presentation', [adapter]), []);
  assert.deepEqual(relevantConnectedActions('A presentation about the example file', [adapter]), []);
  assert.deepEqual(relevantConnectedActions('Do not read the example file', [adapter]), []);
  assert.equal(relevantConnectedActions('اقرأ ملف تجريبي', [adapter]).length, 1);
});

test('large content sends only matching bounded sections and rejects embedded credentials', () => {
  const resource = { sourceId: 'file-1', name: 'Project note', mimeType: 'text/markdown',
    text: `${'Unrelated detail. '.repeat(600)}\n\nTimeline: launch in October.\n\n${'Other unrelated material. '.repeat(600)}` };
  const excerpt = boundedConnectedContent(resource, 'Summarize the project timeline', 160);
  assert.equal(excerpt, 'Timeline: launch in October.');
  assert.equal(boundedConnectedContent({ ...resource, text: 'API_KEY=super-secret-value' },
    'Read the project note'), null);
  assert.equal(boundedConnectedContent(resource, 'Read the file', 160), null);
});

test('model context contains only document content, not connection provenance', async () => {
  const result = await run(connected);
  assert.ok(result.resource);
  const draft = connectedResourceAttachment(result.resource, adapter.id, connected.id);
  const context = attachmentRequestContext(attachConversationFile([], draft, 'conversation-1'));
  assert.match(context.documentContext ?? '', /deterministic test resource/);
  assert.doesNotMatch(context.documentContext ?? '', /connection-1|vantra_example_files|files\.read/);
});

test('future mock adapter registers through metadata without routing/provider-name edits', async () => {
  const future: ConnectedAppAdapter = { ...adapter, id: 'future_app', name: 'Future app',
    actions: [{ ...adapter.actions[0], id: 'find_record', matches: (request) => /find a record/i.test(request) }] };
  const selected = relevantConnectedActions('Find a record', [adapter, future]);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].adapter.id, 'future_app');
  assert.equal((await executeConnectedAction({ match: selected[0], request: 'Find a record',
    userId: 'user-1', connection: { ...connected, appId: 'future_app' }, credential: null })).error,
  'resource_not_found');
});

test('credentials are never copied into model-facing resource or attachment', async () => {
  const secret = 'secret-test-value-never-expose';
  let receivedCredential: string | null = null;
  const credentialed: ConnectedAppAdapter = { ...adapter,
    execute: async (input) => { receivedCredential = input.credential; return adapter.execute(input); } };
  const selected = relevantConnectedActions('Read the example file', [credentialed])[0];
  const result = await executeConnectedAction({ match: selected, request: 'Read the example file',
    userId: 'user-1', connection: connected, credential: secret });
  assert.equal(receivedCredential, secret);
  assert.equal(result.error, null);
  assert.ok(result.resource);
  assert.doesNotMatch(JSON.stringify(result.resource), /secret-test-value/);
  assert.doesNotMatch(JSON.stringify(connectedResourceAttachment(result.resource, adapter.id, connected.id)),
    /secret-test-value/);
});

test('provider failures are reduced to safe structured codes', async () => {
  const failed: ConnectedAppAdapter = { ...adapter, execute: async () => { throw new Error('private upstream detail'); } };
  const selected = relevantConnectedActions('Read the example file', [failed])[0];
  const result = await executeConnectedAction({ match: selected, request: 'Read the example file',
    userId: 'user-1', connection: connected, credential: null });
  assert.deepEqual(result, { resource: null, error: 'action_failed' });
});
