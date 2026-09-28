-- Phase 1: server-only connection metadata and encrypted credential envelope.
-- No existing provider connection or financial table is changed.
create table if not exists public.connected_app_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null check (length(app_id) between 1 and 80),
  status text not null default 'connected' check (status in ('connected', 'disconnected')),
  scopes text[] not null default '{}',
  encrypted_credentials text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, app_id)
);
create index if not exists connected_app_connections_user_idx
  on public.connected_app_connections (user_id);
alter table public.connected_app_connections enable row level security;
-- No authenticated-user policies: only the server's service-role client may read/write.
revoke all on public.connected_app_connections from anon, authenticated;
grant select, insert, update, delete on public.connected_app_connections to service_role;
