-- Forward-only. Apply manually; no financial/provider tables are changed.
-- Payloads may contain private email/file content and are encrypted server-side.
create table if not exists public.connected_app_action_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.connected_app_connections(id) on delete cascade,
  app_id text not null,
  action_id text not null,
  operation_key text not null check (length(operation_key) = 64),
  grant_fingerprint text not null check (length(grant_fingerprint) = 64),
  encrypted_payload text not null,
  status text not null default 'pending' check (status in ('pending','executing','completed','failed','unknown','cancelled')),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, operation_key)
);
create index if not exists connected_app_action_reviews_owner_idx on public.connected_app_action_reviews(user_id, created_at desc);
alter table public.connected_app_action_reviews enable row level security;
revoke all on public.connected_app_action_reviews from anon, authenticated;
grant select, insert, update on public.connected_app_action_reviews to service_role;
-- Exactly one server handler can claim a reviewed action. No retry of ambiguous external writes.
create or replace function public.claim_connected_app_action_review(p_user_id uuid, p_id uuid)
returns setof public.connected_app_action_reviews language sql security definer set search_path = public as $$
  update public.connected_app_action_reviews r set status = 'executing', updated_at = now()
  where r.id = p_id and r.user_id = p_user_id and r.status = 'pending' and r.expires_at > now()
    and exists (select 1 from public.connected_app_connections c where c.id = r.connection_id
      and c.user_id = p_user_id and c.app_id = r.app_id and c.status = 'connected')
  returning r.*;
$$;
revoke all on function public.claim_connected_app_action_review(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_connected_app_action_review(uuid, uuid) to service_role;

-- WooCommerce sends credentials server-to-server, not in the customer's browser.
create table if not exists public.connected_app_authorizations (
  nonce_hash text primary key check (length(nonce_hash) = 64),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null check (app_id = 'woocommerce'),
  store_domain text not null,
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);
alter table public.connected_app_authorizations enable row level security;
revoke all on public.connected_app_authorizations from anon, authenticated;
grant select, insert, update on public.connected_app_authorizations to service_role;
create or replace function public.complete_woocommerce_authorization(p_nonce_hash text, p_encrypted_credentials text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_authorization public.connected_app_authorizations;
begin
  select * into v_authorization from public.connected_app_authorizations
    where nonce_hash = p_nonce_hash and status = 'pending' and expires_at > now() for update;
  if not found then return false; end if;
  insert into public.connected_app_connections(user_id, app_id, scopes, encrypted_credentials, status, expires_at)
    values(v_authorization.user_id, 'woocommerce', array['woocommerce.read'], p_encrypted_credentials, 'connected', '9999-01-01'::timestamptz)
    on conflict (user_id, app_id) do update set scopes = excluded.scopes, encrypted_credentials = excluded.encrypted_credentials,
      status = 'connected', expires_at = excluded.expires_at, updated_at = now();
  update public.connected_app_authorizations set status = 'completed' where nonce_hash = p_nonce_hash;
  return true;
end;
$$;
revoke all on function public.complete_woocommerce_authorization(text, text) from public, anon, authenticated;
grant execute on function public.complete_woocommerce_authorization(text, text) to service_role;
