-- Admin-managed provider/model lifecycle. Credentials remain environment-only.

begin;

alter table public.provider_runtime_configs
  add column if not exists display_name text,
  add column if not exists adapter_type text,
  add column if not exists base_endpoint text,
  add column if not exists archived boolean not null default false;

alter table public.provider_runtime_configs
  drop constraint if exists provider_runtime_display_name_check,
  add constraint provider_runtime_display_name_check
    check (display_name is null or char_length(btrim(display_name)) between 1 and 80),
  drop constraint if exists provider_runtime_adapter_type_check,
  add constraint provider_runtime_adapter_type_check
    check (adapter_type is null or adapter_type in (
      'openai-compatible-chat', 'vercel-gateway', 'runware-media',
      'microsoft-foundry-image', 'pruna-video', 'not-connected'
    )),
  drop constraint if exists provider_runtime_base_endpoint_check,
  add constraint provider_runtime_base_endpoint_check
    check (base_endpoint is null or char_length(btrim(base_endpoint)) between 8 and 500);

alter table public.model_runtime_configs
  add column if not exists archived boolean not null default false;

-- Provider routing details can remain in server audit metadata, but customers
-- may read only the public usage columns through PostgREST.
revoke select on table public.usage_records from authenticated;
grant select (
  id, user_id, reservation_id, operation_key, modality, model_id,
  status, credits_charged, created_at
) on public.usage_records to authenticated;

create or replace function public.admin_archive_or_delete_provider(
  p_provider_id text,
  p_hard_delete boolean,
  p_updated_by uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if not exists (select 1 from public.provider_runtime_configs where provider_id = p_provider_id) then
    raise exception using errcode = 'P0002', message = 'PROVIDER_NOT_FOUND';
  end if;

  if p_hard_delete then
    if exists (select 1 from public.model_provider_routes where provider_id = p_provider_id)
      or exists (select 1 from public.ai_executions where provider_id = p_provider_id)
      or exists (select 1 from public.provider_attempts where provider = p_provider_id)
      or exists (select 1 from public.provider_cost_records where provider = p_provider_id)
    then
      raise exception using errcode = '55000', message = 'PROVIDER_REFERENCED_ARCHIVE_REQUIRED';
    end if;
    delete from public.provider_runtime_configs where provider_id = p_provider_id;
    return 'deleted';
  end if;

  update public.provider_runtime_configs
  set archived = true, enabled = false, emergency_disabled = false, updated_by = p_updated_by
  where provider_id = p_provider_id;
  update public.model_provider_routes
  set enabled = false, updated_by = p_updated_by
  where provider_id = p_provider_id and enabled;
  return 'archived';
end;
$$;

create or replace function public.admin_archive_or_delete_model(
  p_model_key text,
  p_model_id text,
  p_modality text,
  p_hard_delete boolean,
  p_updated_by uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_hard_delete then
    if exists (select 1 from public.model_provider_routes where model_key = p_model_key)
      or exists (select 1 from public.ai_executions where model_key = p_model_key or model_id = p_model_id)
      or exists (select 1 from public.generations where model_id = p_model_id)
      or exists (select 1 from public.credit_reservations where model_id = p_model_id)
      or exists (select 1 from public.usage_records where model_id = p_model_id)
      or exists (select 1 from public.provider_dispatch_outbox where model_id = p_model_id)
    then
      raise exception using errcode = '55000', message = 'MODEL_REFERENCED_ARCHIVE_REQUIRED';
    end if;
    delete from public.model_runtime_configs where model_key = p_model_key;
    if not found then
      raise exception using errcode = 'P0002', message = 'MODEL_NOT_FOUND';
    end if;
    return 'deleted';
  end if;

  insert into public.model_runtime_configs (
    model_key, model_id, modality, enabled, routing_role, studio_visible, archived, updated_by
  ) values (
    p_model_key, p_model_id, p_modality, false, 'unassigned', false, true, p_updated_by
  )
  on conflict (model_key) do update set
    enabled = false,
    routing_role = 'unassigned',
    studio_visible = false,
    archived = true,
    updated_by = excluded.updated_by;
  update public.model_provider_routes
  set enabled = false, updated_by = p_updated_by
  where model_key = p_model_key and enabled;
  return 'archived';
end;
$$;

revoke all on function public.admin_archive_or_delete_provider(text,boolean,uuid)
  from public, anon, authenticated;
grant execute on function public.admin_archive_or_delete_provider(text,boolean,uuid)
  to service_role;
revoke all on function public.admin_archive_or_delete_model(text,text,text,boolean,uuid)
  from public, anon, authenticated;
grant execute on function public.admin_archive_or_delete_model(text,text,text,boolean,uuid)
  to service_role;

commit;
