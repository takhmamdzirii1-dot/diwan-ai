-- General owner audit trail and atomic, ledger-authoritative credit adjustments.

begin;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(btrim(action)) between 1 and 120),
  resource_type text not null check (char_length(btrim(resource_type)) between 1 and 80),
  resource_id text not null check (char_length(btrim(resource_id)) between 1 and 300),
  previous_state jsonb,
  new_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_created_idx
  on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_resource_idx
  on public.admin_audit_log (resource_type, resource_id, created_at desc);

alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from public, anon, authenticated;
grant select, insert on table public.admin_audit_log to service_role;

create or replace function public.reject_admin_audit_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception using errcode = '55000', message = 'ADMIN_AUDIT_IMMUTABLE';
end;
$$;

drop trigger if exists admin_audit_immutable on public.admin_audit_log;
create trigger admin_audit_immutable before update or delete on public.admin_audit_log
  for each row execute function public.reject_admin_audit_mutation();

create or replace function public.write_admin_audit(
  p_actor_user_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_previous_state jsonb default null,
  p_new_state jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_actor_user_id is null
    or char_length(btrim(coalesce(p_action, ''))) not between 1 and 120
    or char_length(btrim(coalesce(p_resource_type, ''))) not between 1 and 80
    or char_length(btrim(coalesce(p_resource_id, ''))) not between 1 and 300
  then
    raise exception using errcode = '22023', message = 'INVALID_ADMIN_AUDIT_EVENT';
  end if;
  insert into public.admin_audit_log (
    actor_user_id, action, resource_type, resource_id,
    previous_state, new_state, metadata
  ) values (
    p_actor_user_id, btrim(p_action), btrim(p_resource_type), btrim(p_resource_id),
    p_previous_state, p_new_state, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.audit_model_runtime_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := case when tg_op = 'INSERT' then new.updated_by else coalesce(new.updated_by, old.updated_by) end;
begin
  if v_actor is not null then
    perform public.write_admin_audit(
      v_actor,
      case when tg_op = 'INSERT' then 'model_runtime_created' else 'model_runtime_updated' end,
      'model', new.model_key,
      case when tg_op = 'INSERT' then null else jsonb_build_object(
        'enabled', old.enabled, 'routing_role', old.routing_role,
        'customer_credit_price', old.customer_credit_price,
        'display_name', old.customer_display_name, 'studio_visible', old.studio_visible,
        'sort_order', old.customer_sort_order, 'availability_label', old.customer_availability_label
      ) end,
      jsonb_build_object(
        'enabled', new.enabled, 'routing_role', new.routing_role,
        'customer_credit_price', new.customer_credit_price,
        'display_name', new.customer_display_name, 'studio_visible', new.studio_visible,
        'sort_order', new.customer_sort_order, 'availability_label', new.customer_availability_label
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists model_runtime_admin_audit on public.model_runtime_configs;
create trigger model_runtime_admin_audit after insert or update on public.model_runtime_configs
  for each row execute function public.audit_model_runtime_change();

create or replace function public.audit_provider_route_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := case when tg_op = 'INSERT' then new.updated_by else coalesce(new.updated_by, old.updated_by) end;
begin
  if v_actor is not null then
    perform public.write_admin_audit(
      v_actor,
      case when tg_op = 'INSERT' then 'provider_route_created' else 'provider_route_updated' end,
      'provider_route', new.id::text,
      case when tg_op = 'INSERT' then null else jsonb_build_object(
        'provider_id', old.provider_id, 'provider_model_id', old.provider_model_id,
        'enabled', old.enabled, 'priority', old.priority, 'fallback', old.fallback
      ) end,
      jsonb_build_object(
        'model_key', new.model_key, 'provider_id', new.provider_id,
        'provider_model_id', new.provider_model_id, 'enabled', new.enabled,
        'priority', new.priority, 'fallback', new.fallback
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists provider_route_admin_audit on public.model_provider_routes;
create trigger provider_route_admin_audit after insert or update on public.model_provider_routes
  for each row execute function public.audit_provider_route_change();

create or replace function public.audit_provider_runtime_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := case when tg_op = 'INSERT' then new.updated_by else coalesce(new.updated_by, old.updated_by) end;
begin
  if v_actor is not null then
    perform public.write_admin_audit(
      v_actor,
      case when tg_op = 'INSERT' then 'provider_runtime_created' else 'provider_runtime_updated' end,
      'provider', new.provider_id,
      case when tg_op = 'INSERT' then null else jsonb_build_object(
        'enabled', old.enabled, 'priority', old.priority,
        'emergency_disabled', old.emergency_disabled,
        'daily_spend_limit_minor', old.daily_spend_limit_minor,
        'spend_currency', old.spend_currency
      ) end,
      jsonb_build_object(
        'enabled', new.enabled, 'priority', new.priority,
        'emergency_disabled', new.emergency_disabled,
        'daily_spend_limit_minor', new.daily_spend_limit_minor,
        'spend_currency', new.spend_currency
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists provider_runtime_admin_audit on public.provider_runtime_configs;
create trigger provider_runtime_admin_audit after insert or update on public.provider_runtime_configs
  for each row execute function public.audit_provider_runtime_change();

alter table public.payment_plans
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

create or replace function public.audit_payment_plan_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := case when tg_op = 'INSERT' then new.updated_by else coalesce(new.updated_by, old.updated_by) end;
begin
  if v_actor is not null then
    perform public.write_admin_audit(
      v_actor,
      case when tg_op = 'INSERT' then 'plan_created'
        when old.active and not new.active then 'plan_archived'
        else 'plan_updated' end,
      'plan', new.id::text,
      case when tg_op = 'INSERT' then null else jsonb_build_object(
        'name', old.name, 'kind', old.kind, 'price_dzd', old.price_dzd,
        'unified_credits', old.unified_credits, 'active', old.active,
        'display_order', old.display_order, 'featured', old.featured
      ) end,
      jsonb_build_object(
        'name', new.name, 'kind', new.kind, 'price_dzd', new.price_dzd,
        'unified_credits', new.unified_credits, 'active', new.active,
        'display_order', new.display_order, 'featured', new.featured
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists payment_plan_admin_audit on public.payment_plans;
create trigger payment_plan_admin_audit after insert or update on public.payment_plans
  for each row execute function public.audit_payment_plan_change();

create or replace function public.admin_reorder_payment_plans(p_ordered_ids uuid[], p_actor_user_id uuid)
returns setof public.payment_plans
language plpgsql security definer set search_path = '' as $$
declare
  v_plan_count integer;
  v_unique_count integer;
  v_existing_count integer;
begin
  if (select auth.role()) <> 'service_role' or p_actor_user_id is null then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  select count(*) into v_plan_count from public.payment_plans;
  select count(distinct plan_id) into v_unique_count from unnest(p_ordered_ids) as supplied(plan_id);
  select count(*) into v_existing_count from public.payment_plans where id = any(p_ordered_ids);
  if cardinality(p_ordered_ids) <> v_plan_count
    or v_unique_count <> v_plan_count
    or v_existing_count <> v_plan_count
  then
    raise exception using errcode = '22023', message = 'INVALID_PLAN_ORDER';
  end if;
  update public.payment_plans as plan
  set display_order = (ordered.position - 1) * 10,
      updated_by = p_actor_user_id
  from unnest(p_ordered_ids) with ordinality as ordered(id, position)
  where plan.id = ordered.id and plan.display_order is distinct from (ordered.position - 1) * 10;
  return query select * from public.payment_plans order by display_order asc, name asc;
end;
$$;

create or replace function public.admin_adjust_user_credits(
  p_target_user_id uuid,
  p_actor_user_id uuid,
  p_amount bigint,
  p_reason text,
  p_idempotency_key text,
  p_payload_hash text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_balance bigint;
  v_new_balance bigint;
  v_existing public.credit_transactions%rowtype;
  v_transaction public.credit_transactions%rowtype;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_target_user_id is null or p_actor_user_id is null
    or p_amount is null or p_amount = 0
    or p_amount < -1000000000 or p_amount > 1000000000
    or char_length(btrim(coalesce(p_reason, ''))) not between 3 and 500
    or char_length(btrim(coalesce(p_idempotency_key, ''))) not between 8 and 200
    or coalesce(p_payload_hash, '') !~ '^[0-9a-f]{64}$'
  then
    raise exception using errcode = '22023', message = 'INVALID_CREDIT_ADJUSTMENT';
  end if;

  -- Serialize retries for this user/key pair before checking the ledger. This
  -- makes simultaneous duplicate requests return the canonical first result.
  perform pg_advisory_xact_lock(
    hashtextextended(p_target_user_id::text || ':' || btrim(p_idempotency_key), 0)
  );

  select * into v_existing from public.credit_transactions
  where user_id = p_target_user_id
    and transaction_type = 'adjustment'
    and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.amount <> p_amount
      or v_existing.payload_hash <> p_payload_hash
      or v_existing.reason <> btrim(p_reason)
      or v_existing.metadata->>'actor_user_id' <> p_actor_user_id::text
    then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'transaction_id', v_existing.id,
      'balance', v_existing.balance_after,
      'amount', v_existing.amount,
      'idempotent', true,
      'created_at', v_existing.created_at
    );
  end if;

  select balance into v_balance from public.credits
  where user_id = p_target_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CREDIT_ACCOUNT_NOT_FOUND';
  end if;
  v_new_balance := v_balance + p_amount;
  if v_new_balance < 0 then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_CREDITS';
  end if;

  update public.credits set balance = v_new_balance, updated_at = now()
  where user_id = p_target_user_id;
  insert into public.credit_transactions (
    user_id, transaction_type, amount, balance_after,
    idempotency_key, payload_hash, reason, metadata
  ) values (
    p_target_user_id, 'adjustment', p_amount, v_new_balance,
    btrim(p_idempotency_key), p_payload_hash, btrim(p_reason),
    jsonb_build_object('actor_user_id', p_actor_user_id, 'source', 'owner_admin')
  ) returning * into v_transaction;

  perform public.write_admin_audit(
    p_actor_user_id, 'credits_adjusted', 'user', p_target_user_id::text,
    jsonb_build_object('balance', v_balance),
    jsonb_build_object(
      'balance', v_new_balance, 'amount', p_amount,
      'transaction_id', v_transaction.id, 'reason', btrim(p_reason)
    )
  );

  return jsonb_build_object(
    'transaction_id', v_transaction.id,
    'balance', v_new_balance,
    'amount', p_amount,
    'idempotent', false,
    'created_at', v_transaction.created_at
  );
end;
$$;

revoke all on function public.write_admin_audit(uuid,text,text,text,jsonb,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.write_admin_audit(uuid,text,text,text,jsonb,jsonb,jsonb)
  to service_role;
revoke all on function public.admin_adjust_user_credits(uuid,uuid,bigint,text,text,text)
  from public, anon, authenticated;
grant execute on function public.admin_adjust_user_credits(uuid,uuid,bigint,text,text,text)
  to service_role;
revoke all on function public.admin_reorder_payment_plans(uuid[],uuid)
  from public, anon, authenticated;
grant execute on function public.admin_reorder_payment_plans(uuid[],uuid)
  to service_role;

comment on table public.admin_audit_log is
  'Append-only, secret-free owner mutation audit trail.';
comment on function public.admin_adjust_user_credits(uuid,uuid,bigint,text,text,text) is
  'Atomic owner credit adjustment with ledger, idempotency and audit.';

commit;
