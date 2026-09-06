-- VANTRA media generation foundation.
-- This migration creates metadata storage and a private object bucket only.
-- It does not connect an image or video generation provider.

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('image', 'video')),
  prompt text not null,
  model_id text not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  storage_path text,
  thumbnail_path text,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generation_storage_path_owned check (
    storage_path is null or storage_path like user_id::text || '/%'
  ),
  constraint generation_thumbnail_path_owned check (
    thumbnail_path is null or thumbnail_path like user_id::text || '/%'
  )
);

create index if not exists generations_user_created_idx
  on public.generations (user_id, created_at desc);
create index if not exists generations_user_type_created_idx
  on public.generations (user_id, type, created_at desc);
create index if not exists generations_user_status_idx
  on public.generations (user_id, status);

alter table public.generations enable row level security;

drop policy if exists "Users can read own generations" on public.generations;
create policy "Users can read own generations" on public.generations
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own generations" on public.generations;
create policy "Users can create own generations" on public.generations
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own generations" on public.generations;
create policy "Users can update own generations" on public.generations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own generations" on public.generations;
create policy "Users can delete own generations" on public.generations
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.update_updated_at_column()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_generations_updated_at on public.generations;
create trigger update_generations_updated_at
  before update on public.generations
  for each row execute function public.update_updated_at_column();

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, null)
on conflict (id) do update set public = false;

drop policy if exists "Users can read own media" on storage.objects;
create policy "Users can read own media" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can upload own media" on storage.objects;
create policy "Users can upload own media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] in ('images', 'videos')
  );

drop policy if exists "Users can update own media" on storage.objects;
create policy "Users can update own media" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] in ('images', 'videos')
  );

drop policy if exists "Users can delete own media" on storage.objects;
create policy "Users can delete own media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
