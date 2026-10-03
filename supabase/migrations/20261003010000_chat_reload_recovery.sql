-- Additive Chat persistence. No financial tables, history, or execution RPCs change.
begin;
create table public.chat_conversations (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 120),
  title text not null check (length(title) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table public.chat_messages (
  user_id uuid not null,
  conversation_id text not null,
  id text not null,
  operation_id text,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '' check (length(content) <= 1000000),
  metadata jsonb not null default '{}'::jsonb,
  output_metadata jsonb not null default '{}'::jsonb,
  status text not null check (status in ('complete', 'streaming', 'interrupted')),
  cancel_requested boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, conversation_id, id),
  foreign key (user_id, conversation_id) references public.chat_conversations(user_id, id) on delete cascade
);
create unique index chat_messages_assistant_operation on public.chat_messages(user_id, operation_id) where role = 'assistant';
create index chat_messages_conversation_order on public.chat_messages(user_id, conversation_id, created_at);
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
create policy chat_conversations_owner_read on public.chat_conversations for select to authenticated using ((select auth.uid()) = user_id);
create policy chat_messages_owner_read on public.chat_messages for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.chat_conversations, public.chat_messages from anon, authenticated;
grant select on public.chat_conversations, public.chat_messages to authenticated;
grant all on public.chat_conversations, public.chat_messages to service_role;

create function public.begin_chat_turn(p_user_id uuid, p_conversation_id text, p_user_message_id text,
  p_operation_id text, p_content text) returns boolean language plpgsql security definer set search_path = public as $$
declare inserted_count integer;
begin
  if auth.role() <> 'service_role' then raise exception 'UNAUTHORIZED'; end if;
  if length(p_user_message_id) not between 1 and 120 or length(p_operation_id) not between 1 and 160 then
    raise exception 'INVALID_CHAT_ID';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':chat:' || p_operation_id, 0));
  insert into public.chat_conversations(user_id, id, title) values(p_user_id, p_conversation_id, left(p_content, 160))
    on conflict(user_id, id) do update set updated_at = now();
  -- Retry reuses the user row but never silently replaces its original content.
  if exists(select 1 from public.chat_messages where user_id = p_user_id and conversation_id = p_conversation_id
    and id = p_user_message_id and (role <> 'user' or content <> p_content)) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if exists(select 1 from public.chat_messages where user_id = p_user_id and operation_id = p_operation_id
    and (conversation_id <> p_conversation_id or role <> 'assistant'
      or metadata->>'userMessageId' is distinct from p_user_message_id)) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  insert into public.chat_messages(user_id, conversation_id, id, role, content, status)
    values(p_user_id, p_conversation_id, p_user_message_id, 'user', p_content, 'complete') on conflict do nothing;
  insert into public.chat_messages(user_id, conversation_id, id, operation_id, role, status, metadata)
    values(p_user_id, p_conversation_id, 'reply-' || p_operation_id, p_operation_id, 'assistant', 'streaming',
      jsonb_build_object('userMessageId', p_user_message_id)) on conflict do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count > 0;
end $$;
revoke all on function public.begin_chat_turn(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.begin_chat_turn(uuid,text,text,text,text) to service_role;
commit;
