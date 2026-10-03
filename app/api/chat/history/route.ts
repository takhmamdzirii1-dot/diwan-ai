import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chatIdentifier } from '@/lib/chat/durable-history';
import { cancelChatReply, deleteChatConversation, listChatConversations, loadChatConversation } from '@/lib/chat/durable-history.server';
import { abortOwnedChat } from '@/lib/chat/chat-cancellation.server';

export const dynamic = 'force-dynamic';
async function identity(request: Request) {
  const client = await createClient();
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  const { data } = token ? await client.auth.getUser(token) : await client.auth.getUser();
  return data.user?.id ?? null;
}
const unavailable = () => NextResponse.json({ error: 'CHAT_HISTORY_UNAVAILABLE' }, { status: 503 });

export async function GET(request: Request) {
  const userId = await identity(request);
  if (!userId) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  const value = new URL(request.url).searchParams.get('conversationId');
  if (value !== null && !chatIdentifier(value)) return NextResponse.json({ error: 'INVALID_CHAT_ID' }, { status: 400 });
  try {
    const body = value ? { messages: await loadChatConversation(userId, value) } : { sessions: await listChatConversations(userId) };
    return NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return unavailable(); }
}

export async function POST(request: Request) {
  const userId = await identity(request);
  if (!userId) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const conversationId = chatIdentifier(body.conversationId);
  const operationId = chatIdentifier(body.operationId);
  if (!conversationId || !operationId || body.action !== 'stop') return NextResponse.json({ error: 'INVALID_CHAT_ID' }, { status: 400 });
  try {
    await cancelChatReply(userId, conversationId, operationId);
    abortOwnedChat(userId, conversationId, operationId);
    return NextResponse.json({ stopped: true });
  } catch { return unavailable(); }
}

export async function DELETE(request: Request) {
  const userId = await identity(request);
  if (!userId) return NextResponse.json({ error: 'AUTHENTICATION_REQUIRED' }, { status: 401 });
  const conversationId = chatIdentifier(new URL(request.url).searchParams.get('conversationId'));
  if (!conversationId) return NextResponse.json({ error: 'INVALID_CHAT_ID' }, { status: 400 });
  try {
    const messages = await loadChatConversation(userId, conversationId);
    for (const message of messages) if (message.vantraStatus === 'streaming' && message.vantraOperationId) {
      await cancelChatReply(userId, conversationId, message.vantraOperationId);
      abortOwnedChat(userId, conversationId, message.vantraOperationId);
    }
    await deleteChatConversation(userId, conversationId); return NextResponse.json({ deleted: true });
  }
  catch { return unavailable(); }
}
