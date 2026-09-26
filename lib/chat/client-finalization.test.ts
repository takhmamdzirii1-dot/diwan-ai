import assert from 'node:assert/strict';
import test from 'node:test';
import { ChatRequestTracker, ChatStreamFinalizer, consumeCanonicalChatStream, hasUsableCanonicalOutput, restoreCanonicalAssistantText } from './client-finalization';
import { chatPartsFromMessage } from '@/lib/artifacts/chat-parts';
import { runArtifactTool } from '@/lib/artifacts/tool-registry';

const answer = 'Understood. I have noted: red lion 1992';
const deltas = ['Understood. ', 'I have ', 'noted: ', 'red lion ', '1992'];
const frame = (text: string) => new TextEncoder().encode(`0:${JSON.stringify(text)}\n`);

test('completed stream commits every delta, even when animation is behind', async () => {
  const committed: string[] = [];
  const finalizer = new ChatStreamFinalizer('request-1', ({ text }) => committed.push(text));
  let animatedText = '';
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const delta of deltas) controller.enqueue(frame(delta));
      controller.close();
    },
  });

  const status = await consumeCanonicalChatStream(stream, (delta) => finalizer.append(delta));
  animatedText = answer.slice(0, -7);
  finalizer.rawDone(status);
  assert.deepEqual(committed, []);
  finalizer.consumerDone();
  assert.equal(status, 'completed');
  assert.equal(finalizer.textChars, answer.length);
  assert.equal(committed[0], answer);
  assert.notEqual(animatedText, committed[0]);
});

test('consumer error does not finalize before a delayed final delta arrives', async () => {
  const committed: Array<{ text: string; status: string }> = [];
  const finalizer = new ChatStreamFinalizer('request-2', (result) => committed.push(result));
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
  const read = consumeCanonicalChatStream(stream, (delta) => finalizer.append(delta));
  for (const delta of deltas.slice(0, -1)) controller.enqueue(frame(delta));
  finalizer.consumerDone(); // SDK consumer/display helper failed while the raw stream continued.
  assert.deepEqual(committed, []);
  controller.enqueue(frame(deltas[deltas.length - 1]));
  controller.close();
  finalizer.rawDone(await read);
  assert.deepEqual(committed, [{ requestId: 'request-2', text: answer, artifacts: [], status: 'completed' }]);

  finalizer.append(' stale partial callback');
  finalizer.consumerDone();
  finalizer.rawDone('error');
  assert.deepEqual(committed, [{ requestId: 'request-2', text: answer, artifacts: [], status: 'completed' }]);
});

test('terminal stream error can settle without a successful SDK consumer', async () => {
  const committed: string[] = [];
  const finalizer = new ChatStreamFinalizer('request-3', ({ status }) => committed.push(status));
  finalizer.append('partial');
  finalizer.rawDone('error');
  assert.deepEqual(committed, ['error']);
});

test('a stale partial SDK callback cannot overwrite the completed assistant message', () => {
  const stale = [
    { id: 'user', role: 'user', content: 'Remember the phrase' },
    { id: 'assistant', role: 'assistant', content: answer.slice(0, -5) },
  ];
  const restored = restoreCanonicalAssistantText(stale, 'assistant', answer);
  assert.equal(restored[1].content, answer);
  assert.equal(restored[0], stale[0]);
  assert.equal(restoreCanonicalAssistantText(restored, 'assistant', answer), restored);
});

test('conversation switch and navigation aborts stay bound to their original request', () => {
  const tracker = new ChatRequestTracker();
  tracker.begin('request-a', 'conversation-a');
  assert.equal(tracker.finish('request-a', 'conversation-a', 'conversation_switch_abort')?.reason, 'conversation_switch_abort');
  tracker.begin('request-b', 'conversation-b');
  assert.equal(tracker.finish('request-a', 'conversation-a', 'provider_error'), null);
  assert.equal(tracker.current?.reason, null);
  assert.equal(tracker.finish('request-b', 'conversation-b', 'navigation_abort')?.reason, 'navigation_abort');
});

test('completed requests cannot become failed during later cleanup', () => {
  const tracker = new ChatRequestTracker();
  tracker.begin('request', 'conversation');
  assert.equal(tracker.finish('request', 'conversation', 'completed')?.reason, 'completed');
  assert.equal(tracker.finish('request', 'conversation', 'navigation_abort'), null);
  assert.equal(tracker.current?.reason, 'completed');
});

test('provider stream failure and network read failure remain distinct', async () => {
  const providerStream = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new TextEncoder().encode('3:"provider failed"\n'));
    controller.close();
  } });
  let providerReason = '';
  assert.equal(await consumeCanonicalChatStream(providerStream, () => undefined, undefined,
    (reason) => { providerReason = reason; }), 'error');
  assert.equal(providerReason, 'provider_error');

  const networkStream = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('network lost')); } });
  let networkReason = '';
  assert.equal(await consumeCanonicalChatStream(networkStream, () => undefined, undefined,
    (reason) => { networkReason = reason; }), 'error');
  assert.equal(networkReason, 'network_error');
});

test('user Stop is a terminal intentional reason', () => {
  const tracker = new ChatRequestTracker();
  tracker.begin('request', 'conversation');
  assert.equal(tracker.finish('request', 'conversation', 'user_stop')?.reason, 'user_stop');
  assert.equal(tracker.finish('request', 'conversation', 'network_error'), null);
});

test('valid document tool-only stream becomes a visible artifact with zero text and no extra call', async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => { calls++; throw new Error('Unexpected AI call'); }) as typeof fetch;
  try {
    const result = runArtifactTool('create_document', { title: 'AI adoption report',
      markdown: '# AI adoption report\n\n## Findings\n\nSmall businesses are adopting AI.', language: 'en' });
    assert.equal(result.status, 'ok');
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new TextEncoder().encode(`9:${JSON.stringify({ toolCallId: 'call-1', toolName: 'create_document', args: {} })}\n`));
      controller.enqueue(new TextEncoder().encode(`a:${JSON.stringify({ toolCallId: 'call-1', result })}\n`));
      controller.close();
    } });
    const committed: Array<{ text: string; artifacts: unknown[]; status: string }> = [];
    const finalizer = new ChatStreamFinalizer('report-request', (value) => committed.push(value));
    const status = await consumeCanonicalChatStream(stream, (delta) => finalizer.append(delta), undefined, undefined,
      (part) => finalizer.appendArtifact(part));
    finalizer.rawDone(status);
    finalizer.consumerDone();
    assert.equal(status, 'completed');
    assert.equal(finalizer.textChars, 0);
    assert.equal(finalizer.artifactCount, 1);
    assert.equal(hasUsableCanonicalOutput(status, committed[0].text, committed[0].artifacts as never), true);
    assert.deepEqual(chatPartsFromMessage('', 'en', committed[0].artifacts).map((part) => part.type), ['document']);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = previousFetch; }
});

test('invalid document result and empty completed stream fail safely', async () => {
  const invalid = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new TextEncoder().encode(`9:${JSON.stringify({ toolCallId: 'bad', toolName: 'create_document', args: {} })}\n`));
    controller.enqueue(new TextEncoder().encode(`a:${JSON.stringify({ toolCallId: 'bad', result: { status: 'ok', artifact: { type: 'document' } } })}\n`));
    controller.close();
  } });
  let category = '';
  const status = await consumeCanonicalChatStream(invalid, () => undefined, undefined,
    (reason) => { category = reason; });
  assert.equal(status, 'error');
  assert.equal(category, 'provider_error');
  assert.equal(hasUsableCanonicalOutput(status, '', []), false);
  assert.equal(hasUsableCanonicalOutput('completed', '', []), false);
  assert.equal(hasUsableCanonicalOutput('completed', 'Normal answer', []), true);
  const failedFinish = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new TextEncoder().encode('d:{"finishReason":"error","usage":{"promptTokens":0,"completionTokens":0}}\n'));
    controller.close();
  } });
  assert.equal(await consumeCanonicalChatStream(failedFinish, () => undefined), 'error');
});
