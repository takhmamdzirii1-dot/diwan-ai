import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatStreamFinalizer, consumeCanonicalChatStream } from '@/lib/chat/client-finalization';
import { connectedReviewIds } from './review-reference';
import { serializeChatSession } from '@/lib/chat/message-history';

test('Workspace review result survives canonical stream, consumer ordering and saved history without a local artifact', async () => {
  const reviewId = crypto.randomUUID();
  const wire = `9:${JSON.stringify({ toolCallId: 'proposal', toolName: 'read_connected_file', args: {} })}\n`
    + `a:${JSON.stringify({ toolCallId: 'proposal', result: { status: 'review_required', reviewId } })}\n`
    + `0:${JSON.stringify('Approve the exact spreadsheet below.')}\n`
    + `d:${JSON.stringify({ finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1 } })}\n`;
  const commits: unknown[] = [];
  const finalizer = new ChatStreamFinalizer('request', value => commits.push(value));
  const status = await consumeCanonicalChatStream(new Response(wire).body!, delta => finalizer.append(delta),
    undefined, undefined, undefined, undefined, undefined, undefined, review => finalizer.addConnectedReview(review));
  assert.equal(status, 'completed');
  finalizer.rawDone(status); assert.equal(commits.length, 0);
  finalizer.consumerDone(); assert.equal(commits.length, 1);
  const result = commits[0] as { text: string; annotations: unknown[]; artifacts: unknown[] };
  assert.deepEqual(result.artifacts, []); assert.deepEqual(connectedReviewIds(result), [reviewId]);
  const saved = JSON.parse(serializeChatSession([{ role: 'assistant', content: result.text, annotations: result.annotations }], () => []))[0];
  assert.deepEqual(connectedReviewIds(saved), [reviewId]);
});

test('invalid review reference and incomplete connected tool stream cannot complete; cancellation cannot commit', async () => {
  for (const result of [null, { status: 'review_required', reviewId: 'not-owned-reference-format' }]) {
    const wire = `9:${JSON.stringify({ toolCallId: 'proposal', toolName: 'read_connected_file' })}\n`
      + (result ? `a:${JSON.stringify({ toolCallId: 'proposal', result })}\n` : '');
    assert.equal(await consumeCanonicalChatStream(new Response(wire).body!, () => {}), 'error');
  }
  let committed = false;
  const finalizer = new ChatStreamFinalizer('cancel', () => { committed = true; });
  finalizer.addConnectedReview({ type: 'vantra-connected-review', reviewId: crypto.randomUUID() });
  finalizer.invalidate(); finalizer.rawDone('aborted'); finalizer.consumerDone();
  assert.equal(committed, false);
});
