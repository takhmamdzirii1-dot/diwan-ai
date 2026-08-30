-- ============================================================
-- VANTRA — user_provider_connections
-- Stores encrypted BYOP provider tokens per authenticated user.
-- Run this once in the Supabase SQL Editor.
-- ============================================================

create table if not exists user_provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('pollinations')),
  encrypted_token text not null, -- AES-256-GCM, encrypted server-side
  expires_at timestamptz, -- scoped sk_ key expiry (7 days)
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, provider)
);

create index idx_provider_connections_user on user_provider_connections(user_id);

alter table user_provider_connections enable row level security;

create policy "Users can view own connections" on user_provider_connections
  for select using (auth.uid() = user_id);
create policy "Users can insert own connections" on user_provider_connections
  for insert with check (auth.uid() = user_id);
create policy "Users can update own connections" on user_provider_connections
  for update using (auth.uid() = user_id);
create policy "Users can delete own connections" on user_provider_connections
  for delete using (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists update_provider_connections_updated_at on user_provider_connections;
create trigger update_provider_connections_updated_at before update on user_provider_connections
  for each row execute procedure public.update_updated_at_column();
