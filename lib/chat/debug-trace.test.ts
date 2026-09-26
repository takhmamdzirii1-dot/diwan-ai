import assert from 'node:assert/strict';
import test from 'node:test';
import { isChatTraceId, traceChatDataStream, type ChatStreamTrace } from './debug-trace';

test('one requestId and text count pass through server and client stream traces unchanged', async () => {
  const requestId = '123e4567-e89b-42d3-a456-426614174000';
  assert.equal(isChatTraceId(requestId), true);
  const wire = '0:"Your first "\n0:"message was: "\n0:"compound interest?"\n';
  const source = new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      const bytes = new TextEncoder().encode(wire);
      controller.enqueue(bytes.slice(0, 7));
      controller.enqueue(bytes.slice(7, 29));
      controller.enqueue(bytes.slice(29));
      controller.close();
    },
  }));
  const events: Array<{ side: string; event: ChatStreamTrace }> = [];
  const server = traceChatDataStream(source, requestId, (event) => events.push({ side: 'server', event }));
  const client = traceChatDataStream(server, requestId, (event) => events.push({ side: 'client', event }));
  assert.equal(await client.text(), wire);
  assert.equal(events.length, 2);
  assert.deepEqual(events.map(({ side, event }) => [side, event.requestId, event.textChars, event.status]), [
    ['server', requestId, 'Your first message was: compound interest?'.length, 'completed'],
    ['client', requestId, 'Your first message was: compound interest?'.length, 'completed'],
  ]);
});
