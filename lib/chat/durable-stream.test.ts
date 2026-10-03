import assert from 'node:assert/strict';
import test from 'node:test';
import { continueChatResponse } from './durable-stream';
import { chatIdentifier, CHAT_INTERRUPTED_AFTER_MS, mayHydrateChat, mergeRecoveredHistory, recoveredChatStatus } from './durable-history';

const encoder = new TextEncoder();
const frame = (value: string) => encoder.encode(value);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('reload/disconnect cancels only the browser branch; partial and final text persist', async () => {
  let upstream: ReadableStreamDefaultController<Uint8Array>;
  const source = new ReadableStream<Uint8Array>({ start(controller) { upstream = controller; } });
  const writes: Array<{ content: string; status: string }> = [];
  let aborts = 0;
  const durable = continueChatResponse(new Response(source), { operationId: 'op', checkpointMs: 5,
    save: async snapshot => { writes.push(snapshot); return true; }, abort: () => { aborts++; },
    completed: () => true, onSaveError: () => assert.fail('unexpected save error') });
  upstream!.enqueue(frame('0:"Hello"\n'));
  const browser = durable.response.body!.getReader();
  await browser.read();
  void browser.cancel('page reload');
  await delay(20);
  assert.ok(writes.some(write => write.status === 'streaming' && write.content === 'Hello'));
  upstream!.enqueue(frame('0:" world"\nd:{"finishReason":"stop"}\n'));
  upstream!.close();
  await durable.completion;
  assert.equal(aborts, 0);
  assert.equal(writes.at(-1)?.status, 'complete');
  assert.equal(writes.at(-1)?.content, 'Hello world');
});

test('explicit cancellation is observed by the checkpoint and never saved Complete', async () => {
  let upstream: ReadableStreamDefaultController<Uint8Array>;
  const source = new ReadableStream<Uint8Array>({ start(controller) { upstream = controller; } });
  let cancelled = false; let aborts = 0;
  const writes: string[] = [];
  const durable = continueChatResponse(new Response(source), { operationId: 'op', checkpointMs: 5,
    save: async snapshot => { writes.push(snapshot.status); return !cancelled; },
    abort: () => { if (aborts++ === 0) { upstream!.enqueue(frame('3:"cancelled"\nd:{"finishReason":"error"}\n')); upstream!.close(); } },
    completed: () => false, onSaveError: () => assert.fail('unexpected save error') });
  cancelled = true;
  await durable.completion;
  assert.ok(aborts > 0);
  assert.ok(!writes.includes('complete'));
  void durable.response.body!.cancel();
});

test('provider errors preserve safe partial output as interrupted, not successful usage', async () => {
  let final: { content: string; status: string };
  const source = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(frame('0:"Partial reply"\n3:"PROVIDER_STREAM_FAILED"\nd:{"finishReason":"error"}\n')); controller.close();
  } });
  const durable = continueChatResponse(new Response(source), { operationId: 'op',
    save: async snapshot => { final = snapshot; return true; }, abort: () => {}, completed: () => false, onSaveError: () => {} });
  await durable.completion;
  assert.equal(final!.status, 'interrupted');
  assert.equal(final!.content, 'Partial reply');
  void durable.response.body!.cancel();
});

test('final history preserves server-owned sources and owned search context', async () => {
  let metadata: Record<string, unknown>;
  const source = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(frame('0:"Verified answer"\n8:[{"type":"vantra-search-context","executionId":"f5995848-c40b-4df5-a433-5585c6da8004"}]\nd:{"finishReason":"stop"}\n')); controller.close();
  } });
  const durable = continueChatResponse(new Response(source), { operationId: 'op',
    save: async snapshot => { metadata = snapshot.metadata; return true; }, abort: () => {}, completed: () => true, onSaveError: () => {} });
  await durable.completion;
  assert.deepEqual(metadata!.annotations, [{ type: 'vantra-search-context', executionId: 'f5995848-c40b-4df5-a433-5585c6da8004' }]);
  void durable.response.body!.cancel();
});

test('no Complete history state before authoritative completion/usage settlement', async () => {
  let status = '';
  const source = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(frame('0:"Reply"\nd:{"finishReason":"stop"}\n')); controller.close();
  } });
  const durable = continueChatResponse(new Response(source), { operationId: 'op',
    save: async snapshot => { status = snapshot.status; return true; }, abort: () => {}, completed: () => false, onSaveError: () => {} });
  await durable.completion;
  assert.equal(status, 'interrupted');
  void durable.response.body!.cancel();
});

test('stale streaming recovery and hydration races do not affect terminal messages', () => {
  const now = Date.now();
  assert.equal(recoveredChatStatus('streaming', new Date(now - CHAT_INTERRUPTED_AFTER_MS - 1).toISOString(), now), 'interrupted');
  assert.equal(recoveredChatStatus('streaming', new Date(now).toISOString(), now), 'streaming');
  assert.equal(recoveredChatStatus('complete', new Date(0).toISOString(), now), 'complete');
  assert.equal(mayHydrateChat('A', 'B', false), false);
  assert.equal(mayHydrateChat('A', 'A', true), false);
  assert.equal(mayHydrateChat('A', 'A', false), true);
  assert.equal(chatIdentifier('../another-user'), null);
});

test('recovery replaces SDK assistant IDs without deleting browser-only Agent/artifact turns', () => {
  const message = (id: string, role: string, time: number) => ({ id, role, createdAt: new Date(time) });
  const local = [message('user-A', 'user', 1), message('sdk-A', 'assistant', 2),
    message('agent-user', 'user', 3), message('agent-artifact', 'assistant', 4)];
  const remote = [message('user-A', 'user', 1), message('reply-op', 'assistant', 2)];
  assert.deepEqual(mergeRecoveredHistory(local, remote).map(row => row.id), ['user-A', 'reply-op', 'agent-user', 'agent-artifact']);
});
