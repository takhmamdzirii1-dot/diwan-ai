-- VANTRA Algeria manual payments.
-- No plan is seeded and no existing balance is changed by this migration.

begin;

create table public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_]{1,80}$'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  kind text not null default 'credit_pack' check (kind in ('credit_pack', 'subscription')),
  price_dzd integer not null check (price_dzd > 0),
  unified_credits bigint not null check (unified_credits > 0),
  active boolean not null default false,
  display_order integer not null default 0 check (display_order between -10000 and 10000),
  featured boolean not null default false,
  entitlement jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_plans_active_order_idx
  on public.payment_plans (active, display_order, created_at);

create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.payment_plans(id) on delete restrict,
  order_kind text not null check (order_kind in ('credit_pack', 'subscription')),
  plan_name text not null,
  plan_description text,
  payment_method text not null check (payment_method in ('baridimob', 'ccp', 'cib', 'edahabia')),
  amount_dzd integer not null check (amount_dzd > 0),
  credits_amount bigint not null check (credits_amount > 0),
  entitlement jsonb not null default '{}'::jsonb,
  payment_reference text not null unique check (char_length(payment_reference) between 8 and 80),
  customer_reference text check (customer_reference is null or char_length(customer_reference) between 2 and 200),
  proof_storage_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  resulting_credit_transaction_id uuid references public.credit_transactions(id) on delete restrict,
  resulting_entitlement_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '72 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_order_proof_owned check (
    proof_storage_path is null or proof_storage_path like user_id::text || '/payments/%'
  ),
  constraint payment_order_review_shape check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status <> 'pending' and reviewed_at is not null and reviewed_by is not null)
  )
);

create index payment_orders_user_created_idx on public.payment_orders (user_id, created_at desc);
create index payment_orders_status_submitted_idx on public.payment_orders (status, submitted_at, created_at desc);

create table public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.payment_plans(id) on delete restrict,
  plan_name text not null,
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired')),
  source_payment_order_id uuid not null unique references public.payment_orders(id) on delete restrict,
  entitlement jsonb not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_orders add constraint payment_orders_entitlement_fk
  foreign key (resulting_entitlement_id) references public.user_entitlements(id) on delete restrict;
create index user_entitlements_user_status_idx on public.user_entitlements (user_id, status, created_at desc);

create table public.payment_audit_log (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null references public.payment_orders(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('created', 'submitted', 'approved', 'rejected', 'expired')),
  previous_status text,
  new_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index payment_audit_order_created_idx on public.payment_audit_log (payment_order_id, created_at desc);

create table public.payment_gateway_events (
  id uuid primary key default gen_random_uuid(),
  gateway text not null check (char_length(btrim(gateway)) between 1 and 80),
  event_id text not null check (char_length(btrim(event_id)) between 1 and 200),
  payment_order_id uuid references public.payment_orders(id) on delete set null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  state text not null default 'received' check (state in ('received', 'processed', 'failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (gateway, event_id)
);

drop trigger if exists payment_plans_updated_at on public.payment_plans;
create trigger payment_plans_updated_at before update on public.payment_plans
  for each row execute function public.financial_set_updated_at();
drop trigger if exists payment_orders_updated_at on public.payment_orders;
create trigger payment_orders_updated_at before update on public.payment_orders
  for each row execute function public.financial_set_updated_at();
drop trigger if exists user_entitlements_updated_at on public.user_entitlements;
create trigger user_entitlements_updated_at before update on public.user_entitlements
  for each row execute function public.financial_set_updated_at();

alter table public.payment_plans enable row level security;
alter table public.payment_orders enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.payment_audit_log enable row level security;
alter table public.payment_gateway_events enable row level security;

create policy "Users can view own payment orders" on public.payment_orders
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can view own entitlements" on public.user_entitlements
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.create_manual_payment_order(p_plan_id uuid, p_payment_method text)
returns public.payment_orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_plan public.payment_plans%rowtype;
  v_order public.payment_orders%rowtype;
  v_reference text;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED'; end if;
  if p_payment_method not in ('baridimob', 'ccp') then
    raise exception using errcode = '22023', message = 'PAYMENT_METHOD_UNAVAILABLE';
  end if;
  select * into v_plan from public.payment_plans where id = p_plan_id and active = true;
  if not found then raise exception using errcode = '22023', message = 'PAYMENT_PLAN_UNAVAILABLE'; end if;

  v_reference := 'VAN-' || to_char(clock_timestamp(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.payment_orders (
    user_id, plan_id, order_kind, plan_name, plan_description, payment_method,
    amount_dzd, credits_amount, entitlement, payment_reference
  ) values (
    v_user_id, v_plan.id, v_plan.kind, v_plan.name, v_plan.description, p_payment_method,
    v_plan.price_dzd, v_plan.unified_credits, v_plan.entitlement, v_reference
  ) returning * into v_order;
  insert into public.payment_audit_log (payment_order_id, actor_user_id, action, new_status)
    values (v_order.id, v_user_id, 'created', 'pending');
  return v_order;
end;
$$;

create or replace function public.submit_manual_payment(
  p_payment_order_id uuid,
  p_customer_reference text,
  p_proof_storage_path text default null
)
returns public.payment_orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.payment_orders%rowtype;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED'; end if;
  if char_length(btrim(coalesce(p_customer_reference, ''))) not between 2 and 200 then
    raise exception using errcode = '22023', message = 'INVALID_TRANSFER_REFERENCE';
  end if;
  select * into v_order from public.payment_orders
    where id = p_payment_order_id and user_id = v_user_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PAYMENT_ORDER_NOT_FOUND'; end if;
  if v_order.payment_method not in ('baridimob', 'ccp') or v_order.status <> 'pending' then
    raise exception using errcode = '22023', message = 'PAYMENT_ORDER_NOT_SUBMITTABLE';
  end if;
  if v_order.expires_at <= now() then raise exception using errcode = '22023', message = 'PAYMENT_ORDER_EXPIRED'; end if;
  if p_proof_storage_path is not null and p_proof_storage_path not like v_user_id::text || '/payments/%' then
    raise exception using errcode = '22023', message = 'INVALID_PROOF_PATH';
  end if;
  update public.payment_orders set
    customer_reference = btrim(p_customer_reference), proof_storage_path = p_proof_storage_path,
    submitted_at = coalesce(submitted_at, now())
  where id = v_order.id returning * into v_order;
  insert into public.payment_audit_log (payment_order_id, actor_user_id, action, previous_status, new_status, metadata)
    values (v_order.id, v_user_id, 'submitted', 'pending', 'pending', jsonb_build_object('has_proof', p_proof_storage_path is not null));
  return v_order;
end;
$$;

create or replace function public.approve_manual_payment(
  p_payment_order_id uuid,
  p_actor_user_id uuid,
  p_review_note text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.payment_orders%rowtype;
  v_balance bigint;
  v_transaction_id uuid;
  v_entitlement_id uuid;
  v_hash text;
begin
  if p_actor_user_id is null then raise exception using errcode = '22023', message = 'ACTOR_REQUIRED'; end if;
  select * into v_order from public.payment_orders where id = p_payment_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PAYMENT_ORDER_NOT_FOUND'; end if;
  if v_order.status = 'approved' then
    return jsonb_build_object('payment_order_id', v_order.id, 'status', 'approved',
      'credit_transaction_id', v_order.resulting_credit_transaction_id,
      'entitlement_id', v_order.resulting_entitlement_id, 'idempotent', true);
  end if;
  if v_order.status <> 'pending' or v_order.submitted_at is null or v_order.expires_at <= now() then
    raise exception using errcode = '22023', message = 'PAYMENT_ORDER_NOT_APPROVABLE';
  end if;

  select balance into v_balance from public.credits where user_id = v_order.user_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'CREDIT_ACCOUNT_NOT_FOUND'; end if;
  update public.credits set balance = balance + v_order.credits_amount, updated_at = now()
    where user_id = v_order.user_id returning balance into v_balance;
  v_hash := md5(v_order.id::text || ':' || v_order.user_id::text) || md5(v_order.id::text || ':payment-grant');
  insert into public.credit_transactions (
    user_id, transaction_type, amount, balance_after, idempotency_key, payload_hash, reason, metadata
  ) values (
    v_order.user_id, 'grant', v_order.credits_amount, v_balance, 'payment:' || v_order.id::text,
    v_hash, 'manual_payment_approved', jsonb_build_object(
      'payment_order_id', v_order.id, 'payment_reference', v_order.payment_reference,
      'amount_dzd', v_order.amount_dzd, 'plan_id', v_order.plan_id,
      'plan_name', v_order.plan_name, 'approved_by', p_actor_user_id
    )
  ) returning id into v_transaction_id;

  if v_order.order_kind = 'subscription' then
    insert into public.user_entitlements (user_id, plan_id, plan_name, source_payment_order_id, entitlement)
      values (v_order.user_id, v_order.plan_id, v_order.plan_name, v_order.id, v_order.entitlement)
      returning id into v_entitlement_id;
  end if;
  update public.payment_orders set status = 'approved', reviewed_at = now(), reviewed_by = p_actor_user_id,
    review_note = nullif(btrim(coalesce(p_review_note, '')), ''),
    resulting_credit_transaction_id = v_transaction_id, resulting_entitlement_id = v_entitlement_id
  where id = v_order.id;
  insert into public.payment_audit_log (payment_order_id, actor_user_id, action, previous_status, new_status, metadata)
    values (v_order.id, p_actor_user_id, 'approved', 'pending', 'approved',
      jsonb_build_object('credit_transaction_id', v_transaction_id, 'entitlement_id', v_entitlement_id));
  return jsonb_build_object('payment_order_id', v_order.id, 'status', 'approved',
    'credit_transaction_id', v_transaction_id, 'entitlement_id', v_entitlement_id, 'idempotent', false);
end;
$$;

create or replace function public.reject_manual_payment(
  p_payment_order_id uuid,
  p_actor_user_id uuid,
  p_review_note text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_order public.payment_orders%rowtype;
begin
  select * into v_order from public.payment_orders where id = p_payment_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PAYMENT_ORDER_NOT_FOUND'; end if;
  if v_order.status = 'rejected' then
    return jsonb_build_object('payment_order_id', v_order.id, 'status', 'rejected', 'idempotent', true);
  end if;
  if p_actor_user_id is null or v_order.status <> 'pending' or v_order.submitted_at is null then
    raise exception using errcode = '22023', message = 'PAYMENT_ORDER_NOT_REJECTABLE';
  end if;
  update public.payment_orders set status = 'rejected', reviewed_at = now(), reviewed_by = p_actor_user_id,
    review_note = nullif(btrim(coalesce(p_review_note, '')), '') where id = v_order.id;
  insert into public.payment_audit_log (payment_order_id, actor_user_id, action, previous_status, new_status)
    values (v_order.id, p_actor_user_id, 'rejected', 'pending', 'rejected');
  return jsonb_build_object('payment_order_id', v_order.id, 'status', 'rejected', 'idempotent', false);
end;
$$;

revoke all on table public.payment_plans, public.payment_orders, public.user_entitlements,
  public.payment_audit_log, public.payment_gateway_events from public, anon, authenticated;
grant select on table public.payment_orders, public.user_entitlements to authenticated;
grant select, insert, update, delete on table public.payment_plans to service_role;
grant select on table public.payment_orders, public.user_entitlements, public.payment_audit_log to service_role;
grant select, insert, update on table public.payment_gateway_events to service_role;

revoke all on function public.create_manual_payment_order(uuid, text) from public, anon;
revoke all on function public.submit_manual_payment(uuid, text, text) from public, anon;
grant execute on function public.create_manual_payment_order(uuid, text) to authenticated;
grant execute on function public.submit_manual_payment(uuid, text, text) to authenticated;
revoke all on function public.approve_manual_payment(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.reject_manual_payment(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.approve_manual_payment(uuid, uuid, text) to service_role;
grant execute on function public.reject_manual_payment(uuid, uuid, text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create policy "Users can read own payment proofs" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] = 'payments');
create policy "Users can upload own payment proofs" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] = 'payments');
create policy "Users can delete own payment proofs" on storage.objects for delete to authenticated
  using (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] = 'payments');

comment on table public.payment_plans is 'Owner-managed payment catalog. No production price is seeded by migrations.';
comment on table public.payment_orders is 'Immutable plan snapshots and provider-agnostic payment lifecycle.';
comment on table public.payment_audit_log is 'Server-written payment audit trail.';

commit;
