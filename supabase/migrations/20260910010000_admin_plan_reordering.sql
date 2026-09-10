-- Atomically reorder the existing payment plan catalog.
-- Called only by the owner-authorized server API through the service role.

begin;

create or replace function public.admin_reorder_payment_plans(p_ordered_ids uuid[])
returns setof public.payment_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_count integer;
  v_unique_count integer;
  v_existing_count integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  select count(*) into v_plan_count from public.payment_plans;
  select count(distinct plan_id) into v_unique_count from unnest(p_ordered_ids) as supplied(plan_id);
  select count(*) into v_existing_count from public.payment_plans where id = any(p_ordered_ids);

  if cardinality(p_ordered_ids) <> v_plan_count
    or v_unique_count <> v_plan_count
    or v_existing_count <> v_plan_count then
    raise exception using errcode = '22023', message = 'INVALID_PLAN_ORDER';
  end if;

  update public.payment_plans as plan
  set display_order = (ordered.position - 1) * 10
  from unnest(p_ordered_ids) with ordinality as ordered(id, position)
  where plan.id = ordered.id;

  return query
    select * from public.payment_plans order by display_order asc, name asc;
end;
$$;

revoke all on function public.admin_reorder_payment_plans(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_reorder_payment_plans(uuid[]) to service_role;

commit;
