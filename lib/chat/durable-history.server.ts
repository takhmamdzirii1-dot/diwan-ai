import 'server-only';
import { getSupabaseAdminClient } from '@/lib/admin/supabase-admin';
import { CHAT_INTERRUPTED_AFTER_MS, recoveredChatStatus, type DurableMessage } from './durable-history';

function admin() {
  const client = getSupabaseAdminClient();
  if (!client) throw new Error('CHAT_HISTORY_UNAVAILABLE');
  return client;
}

export async function beginChatTurn(input: { userId: string; conversationId: string; userMessageId: string;
  operationId: string; content: string }) {
  const { data, error } = await admin().rpc('begin_chat_turn', { p_user_id: input.userId,
    p_conversation_id: input.conversationId, p_user_message_id: input.userMessageId,
    p_operation_id: input.operationId, p_content: input.content });
  if (error) throw new Error('CHAT_HISTORY_SAVE_FAILED');
  return data === true;
}

export async function saveChatReply(input: { userId: string; conversationId: string; operationId: string;
  content: string; metadata: Record<string, unknown>; status: DurableMessage['vantraStatus'] }) {
  // Never overwrite a terminal/cancelled reply from a late checkpoint or duplicate finalizer.
  // Preserve immutable request binding separately from customer output metadata.
  const { data, error } = await admin().from('chat_messages').update({ content: input.content,
    output_metadata: input.metadata, status: input.status, updated_at: new Date().toISOString() })
    .eq('user_id', input.userId).eq('conversation_id', input.conversationId).eq('role', 'assistant')
    .eq('operation_id', input.operationId).eq('status', 'streaming').eq('cancel_requested', false).select('id');
  if (error) throw new Error('CHAT_HISTORY_SAVE_FAILED');
  if (data?.length) return true;
  const current = await admin().from('chat_messages').select('cancel_requested').eq('user_id', input.userId)
    .eq('conversation_id', input.conversationId).eq('operation_id', input.operationId).eq('role', 'assistant').maybeSingle();
  if (current.error) throw new Error('CHAT_HISTORY_SAVE_FAILED');
  return Boolean(current.data) && current.data.cancel_requested !== true;
}

export async function listChatConversations(userId: string) {
  const { data, error } = await admin().from('chat_conversations').select('id,title,created_at')
    .eq('user_id', userId).order('updated_at', { ascending: false }).limit(30);
  if (error) throw new Error('CHAT_HISTORY_UNAVAILABLE');
  return (data ?? []).map(row => ({ id: row.id, title: row.title, createdAt: Date.parse(row.created_at) }));
}

export async function loadChatConversation(userId: string, conversationId: string): Promise<DurableMessage[]> {
  const client = admin();
  // Request-driven stale marking, not a cron. This does not alter execution/usage authority.
  const stale = await client.from('chat_messages').update({ status: 'interrupted' }).eq('user_id', userId)
    .eq('conversation_id', conversationId).eq('status', 'streaming')
    .lt('updated_at', new Date(Date.now() - CHAT_INTERRUPTED_AFTER_MS).toISOString());
  if (stale.error) throw new Error('CHAT_HISTORY_UNAVAILABLE');
  const { data, error } = await client.from('chat_messages')
    .select('id,role,content,output_metadata,status,created_at,updated_at,operation_id').eq('user_id', userId)
    .eq('conversation_id', conversationId).order('created_at').limit(500);
  if (error) throw new Error('CHAT_HISTORY_UNAVAILABLE');
  return (data ?? []).map(row => ({ id: row.id, role: row.role, content: row.content,
    createdAt: row.created_at, updatedAt: row.updated_at,
    vantraStatus: recoveredChatStatus(row.status, row.updated_at),
    ...(row.operation_id ? { vantraOperationId: row.operation_id } : {}),
    ...(row.output_metadata?.vantraParts ? { vantraParts: row.output_metadata.vantraParts } : {}),
    ...(row.output_metadata?.annotations ? { annotations: row.output_metadata.annotations } : {}) }));
}

export async function cancelChatReply(userId: string, conversationId: string, operationId: string) {
  const { error } = await admin().from('chat_messages').update({ cancel_requested: true, status: 'interrupted' })
    .eq('user_id', userId).eq('conversation_id', conversationId).eq('operation_id', operationId)
    .eq('role', 'assistant').eq('status', 'streaming');
  if (error) throw new Error('CHAT_HISTORY_UNAVAILABLE');
}

export async function deleteChatConversation(userId: string, conversationId: string) {
  const { error } = await admin().from('chat_conversations').delete().eq('user_id', userId).eq('id', conversationId);
  if (error) throw new Error('CHAT_HISTORY_UNAVAILABLE');
}
