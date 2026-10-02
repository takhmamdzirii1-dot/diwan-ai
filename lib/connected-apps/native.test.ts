import assert from 'node:assert/strict';
import test from 'node:test';
import { streamText } from 'ai';
import type { LanguageModelV1, LanguageModelV1StreamPart } from '@ai-sdk/provider';
import { connectedReadTool, withConnectedRead } from './native';
import { referenceFilesAdapter } from './reference';
import { relevantConnectedActions } from './core';
import { z } from 'zod';
import { googleDriveAdapter, DRIVE_SCOPE } from './google-drive';
import { gmailAdapter, GMAIL_READ_SCOPE } from './gmail';

test('selected model reads an ownership-checked bounded tool result, then answers; no credentials on wire', async () => {
  const adapter = referenceFilesAdapter(); const request = 'Read the example file';
  const match = relevantConnectedActions(request, [adapter])[0];
  let loads = 0; const choices: unknown[] = [];
  const model: LanguageModelV1 = { specificationVersion: 'v1', provider: 'fixture', modelId: 'selected-model',
    defaultObjectGenerationMode: 'json', doGenerate: async () => { throw new Error('UNUSED'); },
    doStream: async params => {
      if (params.mode.type !== 'regular') throw new Error('UNEXPECTED_MODE');
      choices.push(params.mode.toolChoice);
      const read = choices.length === 1;
      if (!read) { const results = params.prompt.flatMap(entry => entry.role === 'tool' ? entry.content : []);
        assert.ok(JSON.stringify(results).includes('deterministic test resource'));
        assert.ok(!JSON.stringify(results).includes('secret-credential')); }
      const parts: LanguageModelV1StreamPart[] = read ? [{ type: 'tool-call', toolCallType: 'function', toolCallId: 'read-1',
        toolName: 'read_connected_file', args: '{"fileId":"ignored-model-hint","query":"ignored"}' }] : [{ type: 'text-delta', textDelta: 'This is the requested project note.' }];
      parts.push({ type: 'finish', finishReason: read ? 'tool-calls' : 'stop', usage: { promptTokens: 1, completionTokens: 1 } });
      return { stream: new ReadableStream({ start(c) { parts.forEach(part => c.enqueue(part)); c.close(); } }), rawCall: { rawPrompt: null, rawSettings: {} } };
    } };
  const result = await streamText({ model: withConnectedRead(model, null), prompt: request, maxSteps: 2, maxRetries: 0,
    tools: { read_connected_file: connectedReadTool({ match, request, userId: 'owned-user', signal: new AbortController().signal,
      load: async () => { loads++; return { connection: { id: 'own', appId: adapter.id, scopes: ['files.read'], status: 'connected', expiresAt: null }, credential: 'secret-credential' }; } }) } });
  await result.toDataStreamResponse().arrayBuffer();
  assert.deepEqual(choices, [{ type: 'tool', toolName: 'read_connected_file' }, { type: 'none' }]);
  assert.equal(loads, 1); assert.equal(await result.text, 'This is the requested project note.');
});

test('disconnect and missing scopes are rechecked at tool execution, not trusted from exposure time', async () => {
  const adapter = referenceFilesAdapter(); const request = 'Read the example file'; const match = relevantConnectedActions(request, [adapter])[0];
  const read = connectedReadTool({ match, request, userId: 'owner', signal: new AbortController().signal,
    load: async () => ({ connection: { id: 'own', appId: adapter.id, scopes: [], status: 'disconnected', expiresAt: null }, credential: null }) });
  const result = await read.execute!({});
  assert.deepEqual(result, { status: 'error', error: 'app_not_connected' });
});

test('cancelled read stops before credentials or external content are accessed', async () => {
  const controller = new AbortController(); controller.abort(); let loads = 0;
  const adapter = referenceFilesAdapter(); const request = 'Read the example file';
  const read = connectedReadTool({ match: relevantConnectedActions(request, [adapter])[0], request, userId: 'owner', signal: controller.signal,
    load: async () => { loads++; return { connection: null, credential: null }; } });
  await assert.rejects(async () => await read.execute!({}));
  assert.equal(loads, 0);
});

test('selected model proposes a reviewed write then acknowledges pending review without creating an artifact or external mutation', async () => {
  const choices: unknown[] = []; let proposals = 0; let externalWrites = 0;
  const adapter = { id: 'fixture-write', name: 'Fixture', authorization: 'oauth' as const,
    actions: [{ id: 'draft', description: 'Prepare a reviewed draft.', classification: 'write' as const,
      risk: 'low' as const, requiresConnection: true, requiresConfirmation: true, requiredScopes: ['draft'],
      parameters: z.object({ body: z.string() }).strict(), matches: () => true }],
    execute: async () => { externalWrites++; throw new Error('UNEXPECTED'); } };
  const request = 'Draft a message';
  const model: LanguageModelV1 = { specificationVersion: 'v1', provider: 'fixture', modelId: 'selected-model',
    defaultObjectGenerationMode: 'json', doGenerate: async () => { throw new Error('UNUSED'); }, doStream: async params => {
      if (params.mode.type !== 'regular') throw new Error('UNEXPECTED_MODE'); choices.push(params.mode.toolChoice);
      const first = choices.length === 1;
      const parts: LanguageModelV1StreamPart[] = first ? [{ type: 'tool-call', toolCallType: 'function', toolCallId: 'proposal',
        toolName: 'read_connected_file', args: JSON.stringify({ body: 'Reviewed body' }) }]
        : [{ type: 'text-delta', textDelta: 'Your draft is awaiting review; nothing has been sent.' }];
      parts.push({ type: 'finish', finishReason: first ? 'tool-calls' : 'stop', usage: { promptTokens: 1, completionTokens: 1 } });
      return { stream: new ReadableStream({ start(c) { parts.forEach(part => c.enqueue(part)); c.close(); } }), rawCall: { rawPrompt: null, rawSettings: {} } };
    } };
  const result = await streamText({ model: withConnectedRead(model, null), prompt: request, maxSteps: 2, maxRetries: 0,
    tools: { read_connected_file: connectedReadTool({ match: { adapter, action: adapter.actions[0] }, request,
      userId: 'owner', signal: new AbortController().signal, load: async () => ({ connection: null, credential: null }),
      prepare: async args => { proposals++; assert.equal(args.body, 'Reviewed body');
        return { sourceId: 'review', name: 'Pending review', mimeType: 'text/plain', text: 'Nothing has been sent. Review in Settings.' }; } }) } });
  await result.toDataStreamResponse().arrayBuffer();
  assert.deepEqual(choices, [{ type: 'tool', toolName: 'read_connected_file' }, { type: 'none' }]);
  assert.equal(proposals, 1); assert.equal(externalWrites, 0); assert.ok((await result.text).includes('awaiting review'));
});

test('Drive model hints cannot reject or redirect the server-owned URL read', async () => {
  const request = 'Read and summarize https://docs.google.com/document/d/authorized-file-123/edit';
  const calls: string[] = []; const events: unknown[] = [];
  const adapter = googleDriveAdapter(async url => {
    calls.push(String(url)); assert.ok(String(url).includes('/authorized-file-123'));
    return calls.length === 1 ? Response.json({ id: 'authorized-file-123', name: 'QA', mimeType: 'application/vnd.google-apps.document' })
      : new Response('Requested content. '.repeat(2500));
  });
  const read = connectedReadTool({ match: relevantConnectedActions(request, [adapter])[0], request, userId: 'owner',
    signal: new AbortController().signal, observe: event => events.push(event), load: async () => ({
      connection: { id: 'owned', appId: adapter.id, status: 'connected', scopes: [DRIVE_SCOPE], expiresAt: null },
      credential: JSON.stringify({ accessToken: 'fixture-access', expiresAt: new Date(Date.now() + 3600000).toISOString(),
        scopes: [DRIVE_SCOPE], account: { id: 'owner-account', name: 'QA' } }) }) });
  const args = read.parameters.parse({ fileId: 'another-file-123', endpoint: 'https://evil.example', request: 'Read another file' });
  assert.deepEqual(args, {});
  const result = await read.execute!(args);
  assert.equal(result.status, 'ok'); assert.equal('partial' in result && result.partial, true);
  assert.ok('text' in result && result.text.length <= 8000); assert.equal(calls.length, 2);
  assert.deepEqual(events, [{ stage: 'started', actionId: 'read_google_drive_file' }, { stage: 'completed', actionId: 'read_google_drive_file', status: 'ok', partial: true }]);
});

test('Gmail selected read uses the owned mailbox and propagates access errors, not fabricated content', async () => {
  const request = 'Show my latest Gmail messages'; let calls = 0;
  const adapter = gmailAdapter(async () => { calls++; return new Response('private upstream detail', { status: 403 }); });
  const read = connectedReadTool({ match: relevantConnectedActions(request, [adapter])[0], request, userId: 'owner',
    signal: new AbortController().signal, load: async () => ({ connection: { id: 'owned', appId: 'gmail', status: 'connected',
      scopes: [GMAIL_READ_SCOPE], expiresAt: null }, credential: JSON.stringify({ accessToken: 'fixture-access',
      expiresAt: new Date(Date.now() + 3600000).toISOString(), scopes: [GMAIL_READ_SCOPE], account: { id: 'owner', name: 'QA' } }) }) });
  const result = await read.execute!({ operation: 'search', query: 'in:inbox' });
  assert.deepEqual(result, { status: 'error', error: 'permission_missing' }); assert.equal(calls, 1);
  assert.throws(() => read.parameters.parse({ operation: 'search', query: 'in:inbox', endpoint: 'https://evil.example' }));
});
