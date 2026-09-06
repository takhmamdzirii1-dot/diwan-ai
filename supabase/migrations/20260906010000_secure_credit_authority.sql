-- VANTRA Phase 8B: secure the canonical credits balance and add an inactive,
-- provider-agnostic financial engine. This migration does not connect billing
-- to Chat, Image, Video, or any external provider.

begin;

lock table public.credits in share row exclusive mode;

alter table public.credits
  alter column balance type bigint using balance::bigint;

update public.credits
set updated_at = now()
where updated_at is null;

alter table public.credits
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.credits'::regclass
      and conname = 'credits_balance_nonnegative'
  ) then
    alter table public.credits
      add constraint credits_balance_nonnegative check (balance >= 0) not valid;
  end if;
end;
$$;

alter table public.credits validate constraint credits_balance_nonnegative;

drop policy if exists "Users can update own credits" on public.credits;
drop policy if exists "Users can view own credits" on public.credits;

create policy "Users can view own credits"
  on public.credits
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.credits from anon;
revoke insert, update, delete, truncate, references, trigger, maintain
  on table public.credits from authenticated;
grant select on table public.credits to authenticated;

create table if not exists public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_key text not null check (char_length(operation_key) between 1 and 200),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  modality text not null check (modality in ('chat', 'image', 'video')),
  model_id text not null check (char_length(btrim(model_id)) > 0),
  amount bigint not null check (amount > 0),
  settled_amount bigint check (settled_amount is null or settled_amount between 0 and amount),
  state text not null default 'reserved'
    check (state in ('reserved', 'settled', 'released', 'expired')),
  pricing_version text not null check (char_length(btrim(pricing_version)) > 0),
  pricing_snapshot jsonb not null,
  route_snapshot jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_reservation_expiry_valid check (expires_at > created_at),
  constraint credit_reservation_settlement_valid check (
    (state = 'settled' and settled_amount is not null)
    or (state <> 'settled' and settled_amount is null)
  ),
  unique (user_id, operation_key)
);

create index if not exists credit_reservations_user_state_idx
  on public.credit_reservations (user_id, state, created_at desc);
create index if not exists credit_reservations_expiry_idx
  on public.credit_reservations (expires_at)
  where state = 'reserved';

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reservation_id uuid references public.credit_reservations(id) on delete cascade,
  transaction_type text not null
    check (transaction_type in ('grant', 'reserve', 'settle', 'release', 'refund', 'adjustment')),
  amount bigint not null,
  balance_after bigint not null check (balance_after >= 0),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  reason text not null check (char_length(btrim(reason)) > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, transaction_type, idempotency_key)
);

create index if not exists credit_transactions_user_created_idx
  on public.credit_transactions (user_id, created_at desc);
create index if not exists credit_transactions_reservation_idx
  on public.credit_transactions (reservation_id, created_at);
create unique index if not exists credit_transactions_reserve_once_idx
  on public.credit_transactions (reservation_id)
  where transaction_type = 'reserve';
create unique index if not exists credit_transactions_terminal_once_idx
  on public.credit_transactions (reservation_id)
  where transaction_type in ('settle', 'release');

create table if not exists public.usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reservation_id uuid not null unique references public.credit_reservations(id) on delete cascade,
  operation_key text not null,
  modality text not null check (modality in ('chat', 'image', 'video')),
  model_id text not null,
  status text not null check (status in ('completed', 'failed', 'cancelled')),
  credits_charged bigint not null check (credits_charged >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_records_user_created_idx
  on public.usage_records (user_id, created_at desc);
create index if not exists usage_records_user_modality_idx
  on public.usage_records (user_id, modality, created_at desc);

create table if not exists public.provider_cost_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reservation_id uuid not null unique references public.credit_reservations(id) on delete cascade,
  provider text not null,
  provider_model text not null,
  pricing_version text not null,
  estimated_cost_minor bigint check (estimated_cost_minor is null or estimated_cost_minor >= 0),
  actual_cost_minor bigint check (actual_cost_minor is null or actual_cost_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  credits_charged bigint check (credits_charged is null or credits_charged >= 0),
  internal_margin_minor bigint,
  execution_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists provider_cost_records_created_idx
  on public.provider_cost_records (created_at desc);

create table if not exists public.provider_dispatch_outbox (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.credit_reservations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stable_operation_id uuid not null unique default gen_random_uuid(),
  modality text not null check (modality in ('chat', 'image', 'video')),
  model_id text not null,
  route_key text,
  dispatch_payload jsonb not null default '{}'::jsonb,
  state text not null default 'pending'
    check (state in ('pending', 'leased', 'dispatched', 'completed', 'failed', 'cancelled')),
  lease_token uuid,
  lease_epoch bigint not null default 0 check (lease_epoch >= 0),
  leased_until timestamptz,
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  reconciliation_state text not null default 'not_required'
    check (reconciliation_state in ('not_required', 'pending', 'reconciling', 'resolved', 'manual_review')),
  next_reconcile_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_dispatch_lease_shape check (
    (state = 'leased' and lease_token is not null and leased_until is not null)
    or state <> 'leased'
  )
);

create index if not exists provider_dispatch_ready_idx
  on public.provider_dispatch_outbox (available_at, created_at)
  where state in ('pending', 'leased');

create table if not exists public.provider_attempts (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references public.provider_dispatch_outbox(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  fencing_token bigint not null check (fencing_token >= 0),
  provider text not null,
  provider_operation_id text,
  state text not null check (state in ('started', 'submitted', 'completed', 'failed', 'cancelled', 'unknown')),
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (outbox_id, attempt_number)
);

create unique index if not exists provider_attempts_operation_id_idx
  on public.provider_attempts (provider, provider_operation_id)
  where provider_operation_id is not null;

create table if not exists public.provider_webhook_inbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null,
  state text not null default 'received'
    check (state in ('received', 'processing', 'processed', 'failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  unique (provider, event_id)
);

create or replace function public.financial_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.enforce_credit_reservation_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.user_id <> new.user_id
    or old.operation_key <> new.operation_key
    or old.payload_hash <> new.payload_hash
    or old.modality <> new.modality
    or old.model_id <> new.model_id
    or old.amount <> new.amount
    or old.pricing_version <> new.pricing_version
    or old.pricing_snapshot <> new.pricing_snapshot
    or old.route_snapshot is distinct from new.route_snapshot
    or old.created_at <> new.created_at
  then
    raise exception using errcode = '22023', message = 'RESERVATION_IMMUTABLE_FIELDS';
  end if;

  if old.state <> new.state and not (
    old.state = 'reserved' and new.state in ('settled', 'released', 'expired')
  ) then
    raise exception using errcode = '22023', message = 'INVALID_RESERVATION_TRANSITION';
  end if;

  return new;
end;
$$;

drop trigger if exists credit_reservations_transition_guard on public.credit_reservations;
create trigger credit_reservations_transition_guard
  before update on public.credit_reservations
  for each row execute function public.enforce_credit_reservation_transition();

drop trigger if exists credit_reservations_updated_at on public.credit_reservations;
create trigger credit_reservations_updated_at
  before update on public.credit_reservations
  for each row execute function public.financial_set_updated_at();

drop trigger if exists provider_cost_records_updated_at on public.provider_cost_records;
create trigger provider_cost_records_updated_at
  before update on public.provider_cost_records
  for each row execute function public.financial_set_updated_at();

drop trigger if exists provider_dispatch_outbox_updated_at on public.provider_dispatch_outbox;
create trigger provider_dispatch_outbox_updated_at
  before update on public.provider_dispatch_outbox
  for each row execute function public.financial_set_updated_at();

insert into public.credit_transactions (
  user_id,
  transaction_type,
  amount,
  balance_after,
  idempotency_key,
  payload_hash,
  reason,
  metadata
)
select
  c.user_id,
  'adjustment',
  c.balance,
  c.balance,
  'phase-8b-opening-balance',
  encode(sha256(('phase-8b-opening-balance:' || c.user_id::text || ':' || c.balance::text)::bytea), 'hex'),
  'phase_8b_opening_balance',
  jsonb_build_object('migration', '20260906010000')
from public.credits c
on conflict (user_id, transaction_type, idempotency_key) do nothing;

create or replace function public.reserve_credits(
  p_user_id uuid,
  p_operation_key text,
  p_payload_hash text,
  p_modality text,
  p_model_id text,
  p_amount bigint,
  p_pricing_version text,
  p_pricing_snapshot jsonb,
  p_route_snapshot jsonb default null,
  p_expires_at timestamptz default (now() + interval '15 minutes')
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance bigint;
  v_reservation public.credit_reservations%rowtype;
begin
  if p_user_id is null
    or char_length(btrim(coalesce(p_operation_key, ''))) = 0
    or char_length(p_operation_key) > 200
    or coalesce(p_payload_hash, '') !~ '^[0-9a-f]{64}$'
    or p_modality not in ('chat', 'image', 'video')
    or char_length(btrim(coalesce(p_model_id, ''))) = 0
    or p_amount is null or p_amount <= 0
    or char_length(btrim(coalesce(p_pricing_version, ''))) = 0
    or p_pricing_snapshot is null
    or p_expires_at <= now()
  then
    raise exception using errcode = '22023', message = 'INVALID_RESERVATION_REQUEST';
  end if;

  select c.balance into v_balance
  from public.credits c
  where c.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CREDIT_ACCOUNT_NOT_FOUND';
  end if;

  select r.* into v_reservation
  from public.credit_reservations r
  where r.user_id = p_user_id and r.operation_key = p_operation_key;

  if found then
    if v_reservation.payload_hash <> p_payload_hash
      or v_reservation.modality <> p_modality
      or v_reservation.model_id <> p_model_id
      or v_reservation.amount <> p_amount
      or v_reservation.pricing_version <> p_pricing_version
      or v_reservation.pricing_snapshot <> p_pricing_snapshot
      or v_reservation.route_snapshot is distinct from p_route_snapshot
    then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT';
    end if;

    return jsonb_build_object(
      'reservation_id', v_reservation.id,
      'state', v_reservation.state,
      'amount', v_reservation.amount,
      'balance', v_balance,
      'idempotent', true
    );
  end if;

  if v_balance < p_amount then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_CREDITS';
  end if;

  insert into public.credit_reservations (
    user_id, operation_key, payload_hash, modality, model_id, amount,
    pricing_version, pricing_snapshot, route_snapshot, expires_at
  ) values (
    p_user_id, p_operation_key, p_payload_hash, p_modality, p_model_id, p_amount,
    p_pricing_version, p_pricing_snapshot, p_route_snapshot, p_expires_at
  ) returning * into v_reservation;

  update public.credits
  set balance = balance - p_amount,
      updated_at = now()
  where user_id = p_user_id
  returning balance into v_balance;

  insert into public.credit_transactions (
    user_id, reservation_id, transaction_type, amount, balance_after,
    idempotency_key, payload_hash, reason
  ) values (
    p_user_id, v_reservation.id, 'reserve', -p_amount, v_balance,
    p_operation_key, p_payload_hash, 'credit_reservation'
  );

  return jsonb_build_object(
    'reservation_id', v_reservation.id,
    'state', v_reservation.state,
    'amount', v_reservation.amount,
    'balance', v_balance,
    'idempotent', false
  );
end;
$$;

create or replace function public.settle_credits(
  p_user_id uuid,
  p_reservation_id uuid,
  p_operation_key text,
  p_payload_hash text,
  p_actual_amount bigint,
  p_usage_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance bigint;
  v_refund bigint;
  v_reservation public.credit_reservations%rowtype;
  v_existing public.credit_transactions%rowtype;
begin
  if p_user_id is null or p_reservation_id is null
    or char_length(btrim(coalesce(p_operation_key, ''))) = 0
    or char_length(p_operation_key) > 200
    or coalesce(p_payload_hash, '') !~ '^[0-9a-f]{64}$'
    or p_actual_amount is null or p_actual_amount < 0
  then
    raise exception using errcode = '22023', message = 'INVALID_SETTLEMENT_REQUEST';
  end if;

  select c.balance into v_balance
  from public.credits c
  where c.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CREDIT_ACCOUNT_NOT_FOUND';
  end if;

  select t.* into v_existing
  from public.credit_transactions t
  where t.user_id = p_user_id
    and t.transaction_type = 'settle'
    and t.idempotency_key = p_operation_key;

  if found then
    if v_existing.reservation_id <> p_reservation_id
      or v_existing.payload_hash <> p_payload_hash
      or (v_existing.metadata->>'charged_amount')::bigint <> p_actual_amount
    then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT';
    end if;

    return jsonb_build_object(
      'reservation_id', p_reservation_id,
      'state', 'settled',
      'balance', v_balance,
      'balance_delta', v_existing.amount,
      'idempotent', true
    );
  end if;

  select r.* into v_reservation
  from public.credit_reservations r
  where r.id = p_reservation_id and r.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'RESERVATION_NOT_FOUND';
  end if;

  if v_reservation.state <> 'reserved' then
    raise exception using errcode = '22023', message = 'RESERVATION_ALREADY_FINALIZED';
  end if;

  if p_actual_amount > v_reservation.amount then
    raise exception using errcode = '22023', message = 'SETTLEMENT_EXCEEDS_RESERVATION';
  end if;

  v_refund := v_reservation.amount - p_actual_amount;

  update public.credits
  set balance = balance + v_refund,
      updated_at = now()
  where user_id = p_user_id
  returning balance into v_balance;

  update public.credit_reservations
  set state = 'settled', settled_amount = p_actual_amount
  where id = p_reservation_id;

  insert into public.credit_transactions (
    user_id, reservation_id, transaction_type, amount, balance_after,
    idempotency_key, payload_hash, reason,
    metadata
  ) values (
    p_user_id, p_reservation_id, 'settle', v_refund, v_balance,
    p_operation_key, p_payload_hash, 'credit_settlement',
    jsonb_build_object('reserved_amount', v_reservation.amount, 'charged_amount', p_actual_amount)
  );

  insert into public.usage_records (
    user_id, reservation_id, operation_key, modality, model_id,
    status, credits_charged, metadata
  ) values (
    p_user_id, p_reservation_id, v_reservation.operation_key,
    v_reservation.modality, v_reservation.model_id,
    'completed', p_actual_amount, coalesce(p_usage_metadata, '{}'::jsonb)
  );

  return jsonb_build_object(
    'reservation_id', p_reservation_id,
    'state', 'settled',
    'charged_amount', p_actual_amount,
    'balance', v_balance,
    'balance_delta', v_refund,
    'idempotent', false
  );
end;
$$;

create or replace function public.release_credits(
  p_user_id uuid,
  p_reservation_id uuid,
  p_operation_key text,
  p_payload_hash text,
  p_reason text default 'operation_released'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance bigint;
  v_reservation public.credit_reservations%rowtype;
  v_existing public.credit_transactions%rowtype;
begin
  if p_user_id is null or p_reservation_id is null
    or char_length(btrim(coalesce(p_operation_key, ''))) = 0
    or char_length(p_operation_key) > 200
    or coalesce(p_payload_hash, '') !~ '^[0-9a-f]{64}$'
    or char_length(btrim(coalesce(p_reason, ''))) = 0
  then
    raise exception using errcode = '22023', message = 'INVALID_RELEASE_REQUEST';
  end if;

  select c.balance into v_balance
  from public.credits c
  where c.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CREDIT_ACCOUNT_NOT_FOUND';
  end if;

  select t.* into v_existing
  from public.credit_transactions t
  where t.user_id = p_user_id
    and t.transaction_type = 'release'
    and t.idempotency_key = p_operation_key;

  if found then
    if v_existing.reservation_id <> p_reservation_id or v_existing.payload_hash <> p_payload_hash then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT';
    end if;

    return jsonb_build_object(
      'reservation_id', p_reservation_id,
      'state', 'released',
      'balance', v_balance,
      'balance_delta', v_existing.amount,
      'idempotent', true
    );
  end if;

  select r.* into v_reservation
  from public.credit_reservations r
  where r.id = p_reservation_id and r.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'RESERVATION_NOT_FOUND';
  end if;

  if v_reservation.state <> 'reserved' then
    raise exception using errcode = '22023', message = 'RESERVATION_ALREADY_FINALIZED';
  end if;

  update public.credits
  set balance = balance + v_reservation.amount,
      updated_at = now()
  where user_id = p_user_id
  returning balance into v_balance;

  update public.credit_reservations
  set state = 'released'
  where id = p_reservation_id;

  insert into public.credit_transactions (
    user_id, reservation_id, transaction_type, amount, balance_after,
    idempotency_key, payload_hash, reason
  ) values (
    p_user_id, p_reservation_id, 'release', v_reservation.amount, v_balance,
    p_operation_key, p_payload_hash, p_reason
  );

  return jsonb_build_object(
    'reservation_id', p_reservation_id,
    'state', 'released',
    'balance', v_balance,
    'balance_delta', v_reservation.amount,
    'idempotent', false
  );
end;
$$;

alter table public.credit_reservations enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.usage_records enable row level security;
alter table public.provider_cost_records enable row level security;
alter table public.provider_dispatch_outbox enable row level security;
alter table public.provider_attempts enable row level security;
alter table public.provider_webhook_inbox enable row level security;

drop policy if exists "Users can view own usage records" on public.usage_records;
create policy "Users can view own usage records"
  on public.usage_records
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table
  public.credit_reservations,
  public.credit_transactions,
  public.usage_records,
  public.provider_cost_records,
  public.provider_dispatch_outbox,
  public.provider_attempts,
  public.provider_webhook_inbox
from anon, authenticated;

grant select on table public.usage_records to authenticated;

revoke all on table
  public.credits,
  public.credit_reservations,
  public.credit_transactions,
  public.usage_records,
  public.provider_cost_records,
  public.provider_dispatch_outbox,
  public.provider_attempts,
  public.provider_webhook_inbox
from service_role;

grant select on table
  public.credits,
  public.credit_reservations,
  public.credit_transactions,
  public.usage_records
to service_role;

grant select, insert, update, delete on table
  public.provider_cost_records,
  public.provider_dispatch_outbox,
  public.provider_attempts,
  public.provider_webhook_inbox
to service_role;

revoke all on function public.reserve_credits(uuid, text, text, text, text, bigint, text, jsonb, jsonb, timestamptz)
  from public, anon, authenticated;
revoke all on function public.settle_credits(uuid, uuid, text, text, bigint, jsonb)
  from public, anon, authenticated;
revoke all on function public.release_credits(uuid, uuid, text, text, text)
  from public, anon, authenticated;

grant execute on function public.reserve_credits(uuid, text, text, text, text, bigint, text, jsonb, jsonb, timestamptz)
  to service_role;
grant execute on function public.settle_credits(uuid, uuid, text, text, bigint, jsonb)
  to service_role;
grant execute on function public.release_credits(uuid, uuid, text, text, text)
  to service_role;

comment on table public.credits is
  'Canonical VANTRA available-credit authority. Direct client mutation is forbidden.';
comment on table public.credit_reservations is
  'Inactive Phase 8B reservation engine. Not connected to generation routes.';
comment on table public.credit_transactions is
  'Append-only application ledger. Rows are written only by trusted server financial operations.';
comment on table public.provider_cost_records is
  'Private server-only provider economics. Never expose through client policies.';
comment on table public.provider_dispatch_outbox is
  'Inactive durable dispatch foundation for future provider execution and reconciliation.';

commit;
