-- First-party device continuity. Only hashes of server-validated identities
-- are stored; network addresses and browser fingerprints are not collected.
begin;

create table public.free_device_links (
  identity_kind text not null check (identity_kind in ('installation','webcrypto')),
  identity_hash text not null check (identity_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  link_order bigserial not null unique,
  linked_at timestamptz not null default now(),
  primary key (identity_kind, identity_hash, user_id)
);
create index free_device_links_user_idx on public.free_device_links(user_id);
alter table public.free_device_links enable row level security;
revoke all on public.free_device_links from public, anon, authenticated;
grant select, insert on public.free_device_links to service_role;

-- No account reference or personal details survive deletion. This minimal
-- tombstone records that the validated identity has already claimed Free.
create table public.free_device_claim_history (
  identity_kind text not null check (identity_kind in ('installation','webcrypto')),
  identity_hash text not null check (identity_hash ~ '^[0-9a-f]{64}$'),
  primary key (identity_kind, identity_hash)
);
alter table public.free_device_claim_history enable row level security;
revoke all on public.free_device_claim_history from public, anon, authenticated;
grant select, insert on public.free_device_claim_history to service_role;

-- The earlier email-alias assessment and Admin actions both update this row.
-- Keep each known signal once, while retaining safe prior evidence and notes.
create or replace function public.merge_free_access_evidence()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_signals jsonb;
begin
  v_signals := coalesce(old.evidence->'signals','{}'::jsonb)
    || coalesce(new.evidence->'signals','{}'::jsonb);
  if old.reason_code in ('repeated_email_alias','shared_vantra_device','shared_trusted_browser_key') then
    v_signals := v_signals || jsonb_build_object(old.reason_code,true);
  end if;
  if new.reason_code in ('repeated_email_alias','shared_vantra_device','shared_trusted_browser_key') then
    v_signals := v_signals || jsonb_build_object(new.reason_code,true);
  end if;
  new.evidence := coalesce(old.evidence,'{}'::jsonb) || coalesce(new.evidence,'{}'::jsonb)
    || jsonb_build_object('signals',v_signals);
  return new;
end;
$$;
create trigger free_access_evidence_merge before update on public.free_access_eligibility
  for each row execute function public.merge_free_access_evidence();

create or replace function public.link_free_device_identity(
  p_user_id uuid, p_identity_kind text, p_identity_hash text
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_others integer;
  v_first_user uuid;
  v_already_linked boolean;
  v_prior_claim boolean;
  v_before text;
  v_reason text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_user_id is null or coalesce(p_identity_kind not in ('installation','webcrypto'),true)
    or coalesce(p_identity_hash !~ '^[0-9a-f]{64}$',true) then
    raise exception using errcode = '22023', message = 'INVALID_DEVICE_IDENTITY';
  end if;
  -- The lock makes the first and second linkage decisions sequential even
  -- when two accounts reach the server at the same instant.
  perform pg_advisory_xact_lock(hashtextextended(p_identity_kind || ':' || p_identity_hash, 0));
  select exists(select 1 from public.free_device_links
    where identity_kind=p_identity_kind and identity_hash=p_identity_hash
      and user_id=p_user_id) into v_already_linked;
  select exists(select 1 from public.free_device_claim_history
    where identity_kind=p_identity_kind and identity_hash=p_identity_hash) into v_prior_claim;
  insert into public.free_device_claim_history(identity_kind,identity_hash)
    values(p_identity_kind,p_identity_hash) on conflict do nothing;
  insert into public.free_device_links(identity_kind,identity_hash,user_id)
    values(p_identity_kind,p_identity_hash,p_user_id) on conflict do nothing;
  select count(distinct user_id) into v_others from public.free_device_links
    where identity_kind=p_identity_kind and identity_hash=p_identity_hash
      and user_id <> p_user_id;
  select user_id into v_first_user from public.free_device_links
    where identity_kind=p_identity_kind and identity_hash=p_identity_hash
    order by link_order limit 1;
  insert into public.free_access_eligibility(user_id) values(p_user_id)
    on conflict(user_id) do nothing;
  select state into v_before from public.free_access_eligibility
    where user_id=p_user_id for update;
  if ((v_prior_claim and not v_already_linked)
      or (v_others > 0 and v_first_user <> p_user_id))
    and v_before in ('eligible','review_required') then
    v_reason := case p_identity_kind when 'webcrypto' then 'shared_trusted_browser_key'
      else 'shared_vantra_device' end;
    update public.free_access_eligibility set state='review_required',
      reason_code=v_reason,
      evidence=jsonb_build_object('signal',p_identity_kind,'linked_accounts',v_others),
      updated_at=now() where user_id=p_user_id;
    if v_before='eligible' then
      insert into public.admin_audit_log(action,resource_type,resource_id,previous_state,new_state,metadata)
        values('free_account_sent_to_review','user',p_user_id::text,
          '{"state":"eligible"}'::jsonb,'{"state":"review_required"}'::jsonb,
          jsonb_build_object('reason',v_reason,'linked_accounts',v_others));
    end if;
    return 'review_required';
  end if;
  return v_before;
end;
$$;
revoke all on function public.link_free_device_identity(uuid,text,text) from public,anon,authenticated;
grant execute on function public.link_free_device_identity(uuid,text,text) to service_role;

create or replace function public.free_device_risk_summary(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  select jsonb_build_object(
      'linked_accounts',count(distinct other.user_id),
      'shared_installations',count(distinct mine.identity_hash)
        filter (where mine.identity_kind='installation' and other.user_id is not null),
      'shared_browser_keys',count(distinct mine.identity_hash)
        filter (where mine.identity_kind='webcrypto' and other.user_id is not null)
    ) into v_result
    from public.free_device_links mine
    left join public.free_device_links other
      on other.identity_kind=mine.identity_kind and other.identity_hash=mine.identity_hash
      and other.user_id <> mine.user_id
    where mine.user_id=p_user_id;
  return v_result;
end;
$$;
revoke all on function public.free_device_risk_summary(uuid) from public,anon,authenticated;
grant execute on function public.free_device_risk_summary(uuid) to service_role;

commit;
