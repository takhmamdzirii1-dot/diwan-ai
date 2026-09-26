import assert from 'node:assert/strict';
import test from 'node:test';
import { ChatStreamFinalizer, consumeCanonicalChatStream, restoreCanonicalAssistantText } from './client-finalization';

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
  assert.deepEqual(committed, [{ requestId: 'request-2', text: answer, status: 'completed' }]);

  finalizer.append(' stale partial callback');
  finalizer.consumerDone();
  finalizer.rawDone('error');
  assert.deepEqual(committed, [{ requestId: 'request-2', text: answer, status: 'completed' }]);
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
