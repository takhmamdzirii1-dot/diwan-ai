import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// No real DB/credentials: exercise the actual store's HTTP ownership filters.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-placeholder-not-a-real-key';
const originalFetch = globalThis.fetch;
const requests: Array<{ url: URL; method: string; body: Record<string, unknown> }> = [];
let returnCancelled = false;
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  requests.push({ url, method: init?.method ?? 'GET', body });
  const empty = new URL(String(input)).searchParams.get('select') === 'id' && returnCancelled;
  const response = url.pathname.endsWith('/rpc/begin_chat_turn') ? true : empty ? [] : url.searchParams.get('select') === 'cancel_requested'
    ? { cancel_requested: returnCancelled } : [{ id: 'reply-op', role: 'assistant', content: 'Saved',
      status: 'complete', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), output_metadata: {} }];
  return new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
test.after(() => { globalThis.fetch = originalFetch; });
const store = await import('./durable-history.server');
const owner = '159ed28e-9cdb-47c1-9912-1ec559977777';

test('all history read/update/delete operations bind authenticated ownership and conversation', async () => {
  await store.loadChatConversation(owner, 'chat-A');
  await store.saveChatReply({ userId: owner, conversationId: 'chat-A', operationId: 'op', content: 'Reply', metadata: {}, status: 'complete' });
  await store.cancelChatReply(owner, 'chat-A', 'op');
  await store.deleteChatConversation(owner, 'chat-A');
  for (const request of requests) {
    assert.equal(request.url.searchParams.get('user_id'), `eq.${owner}`);
    const field = request.url.pathname.endsWith('chat_conversations') ? 'id' : 'conversation_id';
    assert.equal(request.url.searchParams.get(field), 'eq.chat-A');
  }
  const writes = requests.filter(request => request.method === 'PATCH' && 'content' in request.body);
  assert.equal(writes[0].url.searchParams.get('status'), 'eq.streaming');
  assert.equal(writes[0].url.searchParams.get('cancel_requested'), 'eq.false');
});

test('persisted cancellation blocks late final overwrite and signals abort', async () => {
  returnCancelled = true;
  const saved = await store.saveChatReply({ userId: owner, conversationId: 'chat-A', operationId: 'op', content: 'Late', metadata: {}, status: 'complete' });
  assert.equal(saved, false);
  returnCancelled = false;
});

test('atomic turn RPC uses server identity; SQL preserves originals and prevents operation reassignment', async () => {
  assert.equal(await store.beginChatTurn({ userId: owner, conversationId: 'chat-A', userMessageId: 'user-message', operationId: 'op', content: 'Hello' }), true);
  const request = requests.at(-1)!;
  assert.ok(request.url.pathname.endsWith('/rpc/begin_chat_turn'));
  assert.equal(request.body.p_user_id, owner);
  const sql = readFileSync(new URL('../../supabase/migrations/20261003010000_chat_reload_recovery.sql', import.meta.url), 'utf8');
  assert.match(sql, /begin;[\s\S]*commit;/);
  assert.match(sql, /auth\.role\(\) <> 'service_role'/);
  assert.match(sql, /role <> 'user' or content <> p_content/);
  assert.match(sql, /conversation_id <> p_conversation_id/);
  assert.match(sql, /metadata->>'userMessageId' is distinct from p_user_message_id/);
  assert.match(sql, /get diagnostics inserted_count = row_count/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public.chat_conversations, public.chat_messages from anon, authenticated/);
  assert.match(sql, /grant select on public.chat_conversations, public.chat_messages to authenticated/);
  assert.doesNotMatch(sql, /(?:alter|update|delete from) public\.(?:credit|payment|chat_usage|ai_execution)/);
});

test('route persists before model, consumes with after, and keeps Agent request cancellation', () => {
  const route = readFileSync(new URL('../../app/api/generate/chat/route.ts', import.meta.url), 'utf8');
  assert.ok(route.indexOf('await beginChatTurn(') < route.indexOf('await streamText('));
  assert.match(route, /conversationId \? generationController.signal : request.signal/);
  assert.match(route, /after\(durableCompletion\)/);
  assert.match(route, /completed: \(\) => completedStream && usageSettled/);
  assert.match(route, /if \(durableCompletion\) await durableCompletion/);
  assert.match(route, /await persistenceHandoff/);
  assert.match(route, /finally \{ finishRequestHandoff\(\); \}/);
  assert.match(route, /await settleChatUsage\('released'\)/);
  assert.match(route, /export const maxDuration = 60/);
});
