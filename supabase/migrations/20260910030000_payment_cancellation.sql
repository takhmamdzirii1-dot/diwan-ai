-- Add incomplete or submitted-but-unfulfilled payment orders without deleting
-- their immutable snapshots or reversing any financial fulfillment.

begin;

alter table public.payment_orders drop constraint if exists payment_orders_status_check;
alter table public.payment_orders add constraint payment_orders_status_check
  check (status in ('draft', 'pending', 'approved', 'rejected', 'cancelled', 'expired'));

alter table public.payment_orders drop constraint if exists payment_order_review_shape;
alter table public.payment_orders add constraint payment_order_review_shape check (
  (status = 'draft' and submitted_at is null and reviewed_at is null and reviewed_by is null)
  or (status = 'pending' and submitted_at is not null and reviewed_at is null and reviewed_by is null)
  or (status in ('approved', 'rejected', 'expired') and submitted_at is not null
    and reviewed_at is not null and reviewed_by is not null)
  or (status = 'cancelled' and reviewed_at is not null and reviewed_by is not null)
) not valid;

alter table public.payment_orders add constraint payment_order_cancelled_unfulfilled check (
  status <> 'cancelled'
  or (resulting_credit_transaction_id is null and resulting_entitlement_id is null)
);

alter table public.payment_audit_log drop constraint if exists payment_audit_log_action_check;
alter table public.payment_audit_log add constraint payment_audit_log_action_check
  check (action in ('created', 'submitted', 'approved', 'rejected', 'cancelled', 'expired'));

create or replace function public.cancel_manual_payment(p_payment_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.payment_orders%rowtype;
begin
  if v_user_id is null or coalesce((select auth.role()), '') <> 'authenticated' then
    raise exception using errcode = '42501', message = 'AUTHENTICATION_REQUIRED';
  end if;

  select * into v_order
  from public.payment_orders
  where id = p_payment_order_id and user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PAYMENT_ORDER_NOT_FOUND';
  end if;
  if v_order.status not in ('draft', 'pending')
    or v_order.resulting_credit_transaction_id is not null
    or v_order.resulting_entitlement_id is not null then
    raise exception using errcode = '22023', message = 'PAYMENT_ORDER_NOT_CANCELLABLE';
  end if;

  update public.payment_orders
  set status = 'cancelled', reviewed_at = now(), reviewed_by = v_user_id,
    review_note = 'customer_cancelled'
  where id = v_order.id;
  insert into public.payment_audit_log (
    payment_order_id, actor_user_id, action, previous_status, new_status
  ) values (
    v_order.id, v_user_id, 'cancelled', v_order.status, 'cancelled'
  );

  return jsonb_build_object(
    'payment_order_id', v_order.id, 'status', 'cancelled', 'previous_status', v_order.status
  );
end;
$$;

create or replace function public.admin_cancel_manual_payment(
  p_payment_order_id uuid,
  p_actor_user_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.payment_orders%rowtype;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_actor_user_id is null then
    raise exception using errcode = '22023', message = 'ACTOR_REQUIRED';
  end if;
  if char_length(coalesce(p_reason, '')) > 1000 then
    raise exception using errcode = '22023', message = 'INVALID_CANCELLATION_REASON';
  end if;

  select * into v_order
  from public.payment_orders
  where id = p_payment_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PAYMENT_ORDER_NOT_FOUND';
  end if;
  if v_order.status not in ('draft', 'pending')
    or v_order.resulting_credit_transaction_id is not null
    or v_order.resulting_entitlement_id is not null then
    raise exception using errcode = '22023', message = 'PAYMENT_ORDER_NOT_CANCELLABLE';
  end if;

  update public.payment_orders
  set status = 'cancelled', reviewed_at = now(), reviewed_by = p_actor_user_id,
    review_note = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'owner_cancelled')
  where id = v_order.id;
  insert into public.payment_audit_log (
    payment_order_id, actor_user_id, action, previous_status, new_status
  ) values (
    v_order.id, p_actor_user_id, 'cancelled', v_order.status, 'cancelled'
  );

  return jsonb_build_object(
    'payment_order_id', v_order.id, 'status', 'cancelled', 'previous_status', v_order.status
  );
end;
$$;

revoke all on function public.cancel_manual_payment(uuid) from public, anon;
grant execute on function public.cancel_manual_payment(uuid) to authenticated;
revoke all on function public.admin_cancel_manual_payment(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_cancel_manual_payment(uuid, uuid, text) to service_role;

comment on function public.cancel_manual_payment(uuid) is
  'Cancels the authenticated customer''s own unfulfilled draft or pending payment order.';
comment on function public.admin_cancel_manual_payment(uuid, uuid, text) is
  'Cancels an unfulfilled draft or pending payment order through the owner-authorized server.';

commit;
