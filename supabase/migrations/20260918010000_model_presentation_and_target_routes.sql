-- Customer presentation metadata and disabled route registrations for the
-- current provider targets. Operational routing, pricing and provider cost
-- remain independent and server-authoritative.

begin;

alter table public.model_runtime_configs
  add column if not exists customer_display_name text,
  add column if not exists customer_short_description text,
  add column if not exists customer_media_url text,
  add column if not exists customer_category text,
  add column if not exists customer_sort_order integer,
  add column if not exists studio_visible boolean,
  add column if not exists customer_availability_label text;

alter table public.model_runtime_configs
  drop constraint if exists model_runtime_customer_presentation_shape;
alter table public.model_runtime_configs
  add constraint model_runtime_customer_presentation_shape check (
    (customer_display_name is null or char_length(btrim(customer_display_name)) between 1 and 80)
    and (customer_short_description is null or char_length(btrim(customer_short_description)) between 1 and 240)
    and (customer_media_url is null or char_length(btrim(customer_media_url)) between 1 and 500)
    and (customer_category is null or char_length(btrim(customer_category)) between 1 and 60)
    and (customer_sort_order is null or customer_sort_order between 0 and 10000)
    and (customer_availability_label is null or char_length(btrim(customer_availability_label)) between 1 and 60)
  );

create index if not exists model_runtime_studio_catalog_idx
  on public.model_runtime_configs (modality, studio_visible, customer_sort_order);

insert into public.provider_runtime_configs (provider_id, enabled, priority)
values
  ('orca_router', false, 60),
  ('pruna_ai', false, 70)
on conflict (provider_id) do nothing;

insert into public.model_runtime_configs (model_key, model_id, modality, enabled, routing_role)
values
  ('vantra:chat:glm-5.3-flash', 'vantra-glm-5.3-flash', 'chat', false, 'unassigned'),
  ('vantra:chat:hy3', 'vantra-hy3', 'chat', false, 'unassigned'),
  ('vantra:chat:union-alpha', 'vantra-union-alpha', 'chat', false, 'unassigned'),
  ('vantra:chat:deepseek-v4-flash', 'vantra-deepseek-v4-flash', 'chat', false, 'unassigned'),
  ('vantra:chat:agnes-3.0-flash', 'vantra-agnes-3.0-flash', 'chat', false, 'unassigned'),
  ('vantra:image:mai-image-2.6-flash', 'vantra-mai-image-2.6-flash', 'image', false, 'unassigned'),
  ('vantra:video:p-video-2-pro', 'vantra-p-video-2-pro', 'video', false, 'unassigned')
on conflict (model_key) do nothing;

insert into public.model_provider_routes (
  model_key, model_id, modality, provider_id, provider_model_id, enabled, priority, fallback
)
values
  ('vantra:chat:glm-5.3-flash', 'vantra-glm-5.3-flash', 'chat', 'orca_router', 'z-ai/glm-5.3-flash-free', false, 20, true),
  ('vantra:chat:hy3', 'vantra-hy3', 'chat', 'orca_router', 'tencent/hy3-free', false, 10, false),
  ('vantra:chat:union-alpha', 'vantra-union-alpha', 'chat', 'orca_router', 'stealth/union-alpha-free', false, 10, false),
  ('vantra:chat:deepseek-v4-flash', 'vantra-deepseek-v4-flash', 'chat', 'orca_router', 'deepseek/deepseek-v4-flash-free', false, 10, false),
  ('vantra:chat:agnes-3.0-flash', 'vantra-agnes-3.0-flash', 'chat', 'agnes', 'agnes-2.5', false, 20, true),
  ('vantra:image:mai-image-2.6-flash', 'vantra-mai-image-2.6-flash', 'image', 'microsoft_foundry', 'MAI-Image-2.6-Flash', false, 10, false),
  ('vantra:video:p-video-2-pro', 'vantra-p-video-2-pro', 'video', 'pruna_ai', 'P-Video-2-Pro', false, 10, false)
on conflict (model_key, provider_id, provider_model_id) do nothing;

create or replace function public.admin_update_model_presentation(
  p_model_key text,
  p_model_id text,
  p_modality text,
  p_display_name text,
  p_short_description text,
  p_media_url text,
  p_category text,
  p_sort_order integer,
  p_studio_visible boolean,
  p_availability_label text,
  p_updated_by uuid
)
returns public.model_runtime_configs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config public.model_runtime_configs;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if char_length(btrim(coalesce(p_model_key, ''))) not between 1 and 300
    or char_length(btrim(coalesce(p_model_id, ''))) not between 1 and 240
    or p_modality not in ('chat', 'image', 'video')
    or char_length(btrim(coalesce(p_display_name, ''))) not between 1 and 80
    or (p_short_description is not null and char_length(btrim(p_short_description)) not between 1 and 240)
    or (p_media_url is not null and char_length(btrim(p_media_url)) not between 1 and 500)
    or (p_category is not null and char_length(btrim(p_category)) not between 1 and 60)
    or p_sort_order not between 0 and 10000
    or (p_availability_label is not null and char_length(btrim(p_availability_label)) not between 1 and 60)
  then
    raise exception using errcode = '22023', message = 'INVALID_MODEL_PRESENTATION';
  end if;

  insert into public.model_runtime_configs (
    model_key, model_id, modality, enabled, routing_role,
    customer_display_name, customer_short_description, customer_media_url,
    customer_category, customer_sort_order, studio_visible,
    customer_availability_label, updated_by
  ) values (
    btrim(p_model_key), btrim(p_model_id), p_modality, false, 'unassigned',
    btrim(p_display_name), nullif(btrim(p_short_description), ''), nullif(btrim(p_media_url), ''),
    nullif(btrim(p_category), ''), p_sort_order, p_studio_visible,
    nullif(btrim(p_availability_label), ''), p_updated_by
  )
  on conflict (model_key) do update set
    customer_display_name = excluded.customer_display_name,
    customer_short_description = excluded.customer_short_description,
    customer_media_url = excluded.customer_media_url,
    customer_category = excluded.customer_category,
    customer_sort_order = excluded.customer_sort_order,
    studio_visible = excluded.studio_visible,
    customer_availability_label = excluded.customer_availability_label,
    updated_by = excluded.updated_by
  returning * into v_config;

  return v_config;
end;
$$;

create or replace function public.admin_update_model_provider_route_v2(
  p_route_id uuid,
  p_provider_model_id text,
  p_enabled boolean,
  p_priority integer,
  p_fallback boolean,
  p_updated_by uuid
)
returns public.model_provider_routes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_route public.model_provider_routes;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_route_id is null
    or char_length(btrim(coalesce(p_provider_model_id, ''))) not between 1 and 300
    or p_priority not between 0 and 10000
  then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_ROUTE_CONFIG';
  end if;

  select * into v_route
  from public.model_provider_routes
  where id = p_route_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PROVIDER_ROUTE_NOT_FOUND';
  end if;
  if v_route.enabled and btrim(p_provider_model_id) <> v_route.provider_model_id then
    raise exception using errcode = '55000', message = 'DISABLE_ROUTE_BEFORE_REMAP';
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
    provider_model_id = btrim(p_provider_model_id),
    enabled = p_enabled,
    priority = p_priority,
    fallback = p_fallback,
    updated_by = p_updated_by
  where id = v_route.id
  returning * into v_route;

  return v_route;
end;
$$;

revoke all on function public.admin_update_model_presentation(text,text,text,text,text,text,text,integer,boolean,text,uuid)
  from public, anon, authenticated;
grant execute on function public.admin_update_model_presentation(text,text,text,text,text,text,text,integer,boolean,text,uuid)
  to service_role;
revoke all on function public.admin_update_model_provider_route_v2(uuid,text,boolean,integer,boolean,uuid)
  from public, anon, authenticated;
grant execute on function public.admin_update_model_provider_route_v2(uuid,text,boolean,integer,boolean,uuid)
  to service_role;

commit;
