import assert from 'node:assert/strict';
import test from 'node:test';
import { streamText } from 'ai';
import type { LanguageModelV1, LanguageModelV1StreamPart } from '@ai-sdk/provider';
import { connectedReadTool, withConnectedRead } from './native';
import { referenceFilesAdapter } from './reference';
import { relevantConnectedActions } from './core';

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
        toolName: 'read_connected_file', args: '{}' }] : [{ type: 'text-delta', textDelta: 'This is the requested project note.' }];
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
