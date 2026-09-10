-- Separate incomplete checkout drafts from submitted payments without rewriting
-- ambiguous historical pending rows.

begin;

alter table public.payment_orders alter column status set default 'draft';
alter table public.payment_orders drop constraint if exists payment_orders_status_check;
alter table public.payment_orders add constraint payment_orders_status_check
  check (status in ('draft', 'pending', 'approved', 'rejected', 'expired'));

alter table public.payment_orders drop constraint if exists payment_order_review_shape;
alter table public.payment_orders add constraint payment_order_review_shape check (
  (status = 'draft' and submitted_at is null and reviewed_at is null and reviewed_by is null)
  or (status = 'pending' and submitted_at is not null and reviewed_at is null and reviewed_by is null)
  or (status in ('approved', 'rejected', 'expired') and submitted_at is not null
    and reviewed_at is not null and reviewed_by is not null)
) not valid;

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
    amount_dzd, credits_amount, entitlement, payment_reference, status
  ) values (
    v_user_id, v_plan.id, v_plan.kind, v_plan.name, v_plan.description, p_payment_method,
    v_plan.price_dzd, v_plan.unified_credits, v_plan.entitlement, v_reference, 'draft'
  ) returning * into v_order;
  insert into public.payment_audit_log (payment_order_id, actor_user_id, action, new_status)
    values (v_order.id, v_user_id, 'created', 'draft');
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
  v_previous_status text;
begin
  if v_user_id is null then raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED'; end if;
  if char_length(btrim(coalesce(p_customer_reference, ''))) not between 2 and 200 then
    raise exception using errcode = '22023', message = 'INVALID_TRANSFER_REFERENCE';
  end if;
  select * into v_order from public.payment_orders
    where id = p_payment_order_id and user_id = v_user_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PAYMENT_ORDER_NOT_FOUND'; end if;
  if v_order.payment_method not in ('baridimob', 'ccp')
    or not (
      v_order.status = 'draft'
      or (v_order.status = 'pending' and v_order.submitted_at is null)
    ) then
    raise exception using errcode = '22023', message = 'PAYMENT_ORDER_NOT_SUBMITTABLE';
  end if;
  if v_order.expires_at <= now() then raise exception using errcode = '22023', message = 'PAYMENT_ORDER_EXPIRED'; end if;
  if p_proof_storage_path is not null and p_proof_storage_path not like v_user_id::text || '/payments/%' then
    raise exception using errcode = '22023', message = 'INVALID_PROOF_PATH';
  end if;

  v_previous_status := v_order.status;
  update public.payment_orders set
    status = 'pending', customer_reference = btrim(p_customer_reference),
    proof_storage_path = p_proof_storage_path, submitted_at = now()
  where id = v_order.id returning * into v_order;
  insert into public.payment_audit_log (payment_order_id, actor_user_id, action, previous_status, new_status, metadata)
    values (v_order.id, v_user_id, 'submitted', v_previous_status, 'pending',
      jsonb_build_object('has_proof', p_proof_storage_path is not null));
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
  v_existing_transaction public.credit_transactions%rowtype;
  v_existing_entitlement public.user_entitlements%rowtype;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_actor_user_id is null then raise exception using errcode = '22023', message = 'ACTOR_REQUIRED'; end if;

  select * into v_order from public.payment_orders where id = p_payment_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PAYMENT_ORDER_NOT_FOUND'; end if;

  if v_order.status = 'approved' then
    if v_order.resulting_credit_transaction_id is null then
      raise exception using errcode = 'P0001', message = 'PAYMENT_APPROVAL_INTEGRITY_ERROR';
    end if;
    select * into v_existing_transaction from public.credit_transactions
      where id = v_order.resulting_credit_transaction_id;
    if not found
      or v_existing_transaction.user_id is distinct from v_order.user_id
      or v_existing_transaction.transaction_type is distinct from 'grant'
      or v_existing_transaction.amount is distinct from v_order.credits_amount
      or v_existing_transaction.idempotency_key is distinct from 'payment:' || v_order.id::text
      or v_existing_transaction.metadata->>'payment_order_id' is distinct from v_order.id::text then
      raise exception using errcode = 'P0001', message = 'PAYMENT_APPROVAL_INTEGRITY_ERROR';
    end if;
    if v_order.order_kind = 'subscription' then
      if v_order.resulting_entitlement_id is null then
        raise exception using errcode = 'P0001', message = 'PAYMENT_APPROVAL_INTEGRITY_ERROR';
      end if;
      select * into v_existing_entitlement from public.user_entitlements
        where id = v_order.resulting_entitlement_id;
      if not found
        or v_existing_entitlement.user_id is distinct from v_order.user_id
        or v_existing_entitlement.source_payment_order_id is distinct from v_order.id then
        raise exception using errcode = 'P0001', message = 'PAYMENT_APPROVAL_INTEGRITY_ERROR';
      end if;
    elsif v_order.resulting_entitlement_id is not null then
      raise exception using errcode = 'P0001', message = 'PAYMENT_APPROVAL_INTEGRITY_ERROR';
    end if;
    return jsonb_build_object('payment_order_id', v_order.id, 'status', 'approved',
      'credit_transaction_id', v_order.resulting_credit_transaction_id,
      'entitlement_id', v_order.resulting_entitlement_id, 'idempotent', true);
  end if;

  if v_order.status <> 'pending' or v_order.submitted_at is null or v_order.expires_at <= now() then
    raise exception using errcode = '22023', message = 'PAYMENT_ORDER_NOT_APPROVABLE';
  end if;

  select * into v_existing_transaction from public.credit_transactions
    where user_id = v_order.user_id
      and transaction_type = 'grant'
      and idempotency_key = 'payment:' || v_order.id::text;
  if found then
    raise exception using errcode = 'P0001', message = 'PAYMENT_APPROVAL_INTEGRITY_ERROR';
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
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
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

create or replace function public.get_current_user_entitlement()
returns table (plan_name text, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select entitlement.plan_name, entitlement.starts_at, entitlement.ends_at
  from public.user_entitlements entitlement
  where entitlement.user_id = (select auth.uid())
    and entitlement.status = 'active'
    and (entitlement.ends_at is null or entitlement.ends_at > now())
  order by entitlement.starts_at desc, entitlement.created_at desc
  limit 1;
$$;

revoke all on function public.get_current_user_entitlement() from public, anon;
grant execute on function public.get_current_user_entitlement() to authenticated;

drop policy if exists "Users can upload own payment proofs" on storage.objects;
create policy "Users can upload own payment proofs" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] = 'payments'
    and exists (
      select 1 from public.payment_orders payment_order
      where payment_order.user_id = (select auth.uid())
        and payment_order.id::text = (storage.foldername(name))[3]
        and payment_order.proof_storage_path is null
        and (
          payment_order.status = 'draft'
          or (payment_order.status = 'pending' and payment_order.submitted_at is null)
        )
    )
  );

drop policy if exists "Users can delete own payment proofs" on storage.objects;
create policy "Users can delete incomplete payment proofs" on storage.objects for delete to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] = 'payments'
    and exists (
      select 1 from public.payment_orders payment_order
      where payment_order.user_id = (select auth.uid())
        and payment_order.id::text = (storage.foldername(name))[3]
        and payment_order.proof_storage_path is null
        and (
          payment_order.status = 'draft'
          or (payment_order.status = 'pending' and payment_order.submitted_at is null)
        )
    )
  );

comment on constraint payment_order_review_shape on public.payment_orders is
  'Enforced for new and changed rows. It remains NOT VALID so ambiguous legacy pending rows are preserved.';

commit;
