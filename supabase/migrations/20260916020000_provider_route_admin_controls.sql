begin;

create unique index if not exists model_provider_routes_one_primary_idx
  on public.model_provider_routes (model_key)
  where enabled and not fallback;

create or replace function public.admin_update_model_provider_route(
  p_route_id uuid, p_enabled boolean, p_priority integer,
  p_fallback boolean, p_updated_by uuid
)
returns public.model_provider_routes
language plpgsql security definer set search_path = '' as $$
declare
  v_route public.model_provider_routes;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_route_id is null or p_priority not between 0 and 10000 then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_ROUTE_CONFIG';
  end if;
  select * into v_route from public.model_provider_routes
  where id = p_route_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PROVIDER_ROUTE_NOT_FOUND';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('provider-route:' || v_route.model_key, 0)
  );
  if p_enabled and not p_fallback and exists (
    select 1 from public.model_provider_routes
    where model_key = v_route.model_key and enabled and not fallback and id <> v_route.id
  ) then
    raise exception using errcode = '23505', message = 'PRIMARY_PROVIDER_ROUTE_EXISTS';
  end if;
  if p_enabled and p_fallback and not exists (
    select 1 from public.model_provider_routes
    where model_key = v_route.model_key and enabled and not fallback and id <> v_route.id
  ) then
    raise exception using errcode = '22023', message = 'FALLBACK_REQUIRES_PRIMARY_ROUTE';
  end if;
  update public.model_provider_routes set
    enabled = p_enabled,
    priority = p_priority,
    fallback = p_fallback,
    updated_by = p_updated_by
  where id = v_route.id
  returning * into v_route;
  return v_route;
end;
$$;

revoke all on function public.admin_update_model_provider_route(uuid,boolean,integer,boolean,uuid)
  from public, anon, authenticated;
grant execute on function public.admin_update_model_provider_route(uuid,boolean,integer,boolean,uuid)
  to service_role;

commit;
