-- Server-authoritative provider routing and execution guards.
-- Provider credentials remain environment-only.

begin;

create table if not exists public.provider_runtime_configs (
  provider_id text primary key check (provider_id ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  enabled boolean not null default false,
  priority integer not null default 100 check (priority between 0 and 10000),
  emergency_disabled boolean not null default false,
  daily_spend_limit_minor bigint check (daily_spend_limit_minor is null or daily_spend_limit_minor >= 0),
  spend_currency text check (spend_currency is null or spend_currency ~ '^[A-Z]{3}$'),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  failure_threshold integer not null default 3 check (failure_threshold between 1 and 20),
  circuit_open_until timestamptz,
  last_error_code text,
  last_checked_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_spend_limit_shape check (
    (daily_spend_limit_minor is null and spend_currency is null)
    or (daily_spend_limit_minor is not null and spend_currency is not null)
  )
);

create table if not exists public.model_provider_routes (
  id uuid primary key default gen_random_uuid(),
  model_key text not null check (char_length(btrim(model_key)) between 1 and 300),
  model_id text not null check (char_length(btrim(model_id)) between 1 and 240),
  modality text not null check (modality in ('chat', 'image', 'video')),
  provider_id text not null references public.provider_runtime_configs(provider_id) on delete restrict,
  provider_model_id text not null check (char_length(btrim(provider_model_id)) between 1 and 300),
  enabled boolean not null default false,
  priority integer not null default 100 check (priority between 0 and 10000),
  fallback boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_key, provider_id, provider_model_id)
);

create index if not exists model_provider_routes_resolution_idx
  on public.model_provider_routes (model_key, enabled, priority, fallback);
create table if not exists public.ai_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_key text not null check (char_length(operation_key) between 8 and 200),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  modality text not null check (modality in ('chat', 'image', 'video')),
  model_key text not null,
  model_id text not null,
  route_id uuid not null references public.model_provider_routes(id) on delete restrict,
  provider_id text not null,
  provider_model_id text not null,
  reservation_id uuid references public.credit_reservations(id) on delete restrict,
  state text not null default 'reserved'
    check (state in ('reserved', 'streaming', 'completed', 'failed', 'cancelled')),
  credits_charged bigint check (credits_charged is null or credits_charged >= 0),
  finish_reason text,
  error_code text,
  execution_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, operation_key)
);

create index if not exists ai_executions_user_created_idx
  on public.ai_executions (user_id, created_at desc);
create index if not exists ai_executions_active_idx
  on public.ai_executions (user_id, modality, updated_at desc)
  where state in ('reserved', 'streaming');

create or replace function public.provider_routing_set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists provider_runtime_configs_updated_at on public.provider_runtime_configs;
create trigger provider_runtime_configs_updated_at before update on public.provider_runtime_configs
  for each row execute function public.provider_routing_set_updated_at();
drop trigger if exists model_provider_routes_updated_at on public.model_provider_routes;
create trigger model_provider_routes_updated_at before update on public.model_provider_routes
  for each row execute function public.provider_routing_set_updated_at();
drop trigger if exists ai_executions_updated_at on public.ai_executions;
create trigger ai_executions_updated_at before update on public.ai_executions
  for each row execute function public.provider_routing_set_updated_at();

alter table public.provider_runtime_configs enable row level security;
alter table public.model_provider_routes enable row level security;
alter table public.ai_executions enable row level security;
revoke all on table public.provider_runtime_configs, public.model_provider_routes, public.ai_executions
  from public, anon, authenticated;
grant all on table public.provider_runtime_configs, public.model_provider_routes, public.ai_executions
  to service_role;

insert into public.provider_runtime_configs (provider_id, enabled, priority)
values
  ('openrouter', true, 10),
  ('vercel_ai_gateway', false, 20),
  ('runware', false, 30),
  ('agnes', false, 40),
  ('microsoft_foundry', false, 50),
  ('pollinations', false, 60),
  ('puter', false, 70)
on conflict (provider_id) do nothing;

-- The only seeded route is the existing, already verified OpenRouter model ID.
insert into public.model_provider_routes (
  model_key, model_id, modality, provider_id, provider_model_id, enabled, priority, fallback
)
values (
  'studio:chat:nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'chat',
  'openrouter',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  true,
  10,
  false
)
on conflict (model_key, provider_id, provider_model_id) do nothing;

-- Verified provider routes are installed disabled. Activation still requires
-- an enabled provider, server credential, enabled model, and explicit customer price.
insert into public.model_provider_routes (
  model_key, model_id, modality, provider_id, provider_model_id, enabled, priority, fallback
)
values
  ('vantra:chat:glm-5.3-flash', 'vantra-glm-5.3-flash', 'chat', 'vercel_ai_gateway', 'zai/glm-5.3-flash', false, 10, false),
  ('vantra:chat:qwen-3.8-flash', 'vantra-qwen-3.8-flash', 'chat', 'vercel_ai_gateway', 'alibaba/qwen3.8-flash', false, 10, false),
  ('vantra:chat:qwen-3.8-flash-next', 'vantra-qwen-3.8-flash-next', 'chat', 'vercel_ai_gateway', 'alibaba/qwen3.8-flash-next', false, 10, false),
  ('vantra:image:muse-image', 'vantra-muse-image', 'image', 'vercel_ai_gateway', 'meta/muse-image-1.0', false, 10, false),
  ('vantra:image:muse-image', 'vantra-muse-image', 'image', 'runware', 'meta:muse@image', false, 20, true),
  ('vantra:video:h3-max', 'vantra-h3-max', 'video', 'runware', 'minimax:h3@max', false, 10, false),
  ('vantra:video:h3-max-turbo', 'vantra-h3-max-turbo', 'video', 'runware', 'minimax:h3@max-turbo', false, 10, false),
  ('vantra:video:p-video', 'vantra-p-video', 'video', 'runware', 'prunaai:p-video@0', false, 10, false),
  ('vantra:video:p-video-2', 'vantra-p-video-2', 'video', 'runware', 'prunaai:p-video@2', false, 10, false),
  ('vantra:image:z-image', 'vantra-z-image', 'image', 'runware', 'runware:z-image@0', false, 10, false),
  ('vantra:chat:agnes-3.0-flash', 'vantra-agnes-3.0-flash', 'chat', 'agnes', 'agnes-3.0-flash', false, 10, false)
on conflict (model_key, provider_id, provider_model_id) do nothing;

create or replace function public.begin_ai_execution(
  p_user_id uuid, p_operation_key text, p_payload_hash text, p_modality text,
  p_model_key text, p_model_id text, p_route_id uuid,
  p_provider_id text, p_provider_model_id text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_existing public.ai_executions%rowtype;
  v_execution public.ai_executions%rowtype;
  v_recent_count integer;
  v_active_count integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_user_id is null
    or char_length(btrim(coalesce(p_operation_key, ''))) not between 8 and 200
    or coalesce(p_payload_hash, '') !~ '^[0-9a-f]{64}$'
    or p_modality not in ('chat', 'image', 'video')
    or char_length(btrim(coalesce(p_model_key, ''))) = 0
    or char_length(btrim(coalesce(p_model_id, ''))) = 0
    or p_route_id is null
    or char_length(btrim(coalesce(p_provider_id, ''))) = 0
    or char_length(btrim(coalesce(p_provider_model_id, ''))) = 0
  then
    raise exception using errcode = '22023', message = 'INVALID_EXECUTION_REQUEST';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_modality, 0)
  );

  select * into v_existing from public.ai_executions
  where user_id = p_user_id and operation_key = p_operation_key;
  if found then
    if v_existing.payload_hash <> p_payload_hash
      or v_existing.model_key <> p_model_key
      or v_existing.route_id <> p_route_id
    then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'execution_id', v_existing.id, 'state', v_existing.state, 'idempotent', true
    );
  end if;

  select count(*) into v_recent_count from public.ai_executions
  where user_id = p_user_id and created_at > now() - interval '1 minute';
  if v_recent_count >= 20 then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;

  select count(*) into v_active_count from public.ai_executions
  where user_id = p_user_id and modality = p_modality
    and state in ('reserved', 'streaming')
    and updated_at > now() - interval '2 minutes';
  if v_active_count >= 1 then
    raise exception using errcode = 'P0001', message = 'CONCURRENCY_LIMITED';
  end if;

  insert into public.ai_executions (
    user_id, operation_key, payload_hash, modality, model_key, model_id,
    route_id, provider_id, provider_model_id
  ) values (
    p_user_id, p_operation_key, p_payload_hash, p_modality, p_model_key, p_model_id,
    p_route_id, p_provider_id, p_provider_model_id
  ) returning * into v_execution;

  return jsonb_build_object(
    'execution_id', v_execution.id, 'state', v_execution.state, 'idempotent', false
  );
end;
$$;

create or replace function public.mark_ai_execution_streaming(
  p_execution_id uuid, p_user_id uuid, p_reservation_id uuid default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  update public.ai_executions set state = 'streaming', reservation_id = p_reservation_id
  where id = p_execution_id and user_id = p_user_id and state = 'reserved';
  if not found then
    raise exception using errcode = '22023', message = 'INVALID_EXECUTION_TRANSITION';
  end if;
end;
$$;

create or replace function public.complete_ai_execution(
  p_execution_id uuid, p_user_id uuid, p_credits_charged bigint,
  p_finish_reason text, p_execution_metadata jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_credits_charged < 0 then
    raise exception using errcode = '22023', message = 'INVALID_CREDITS_CHARGED';
  end if;
  update public.ai_executions set
    state = 'completed', credits_charged = p_credits_charged,
    finish_reason = left(p_finish_reason, 100),
    execution_metadata = coalesce(p_execution_metadata, '{}'::jsonb),
    completed_at = now()
  where id = p_execution_id and user_id = p_user_id
    and state in ('reserved', 'streaming');
  if not found and not exists (
    select 1 from public.ai_executions
    where id = p_execution_id and user_id = p_user_id and state = 'completed'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_EXECUTION_TRANSITION';
  end if;
end;
$$;

create or replace function public.fail_ai_execution(
  p_execution_id uuid, p_user_id uuid, p_error_code text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  update public.ai_executions set
    state = 'failed',
    error_code = left(coalesce(p_error_code, 'PROVIDER_ERROR'), 120),
    completed_at = now()
  where id = p_execution_id and user_id = p_user_id
    and state in ('reserved', 'streaming');
  if not found and not exists (
    select 1 from public.ai_executions
    where id = p_execution_id and user_id = p_user_id and state = 'failed'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_EXECUTION_TRANSITION';
  end if;
end;
$$;

create or replace function public.record_provider_runtime_result(
  p_provider_id text, p_succeeded boolean, p_error_code text default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  update public.provider_runtime_configs set
    consecutive_failures = case when p_succeeded then 0 else consecutive_failures + 1 end,
    circuit_open_until = case
      when p_succeeded then null
      when consecutive_failures + 1 >= failure_threshold then now() + interval '1 minute'
      else circuit_open_until
    end,
    last_error_code = case
      when p_succeeded then null
      else left(coalesce(p_error_code, 'PROVIDER_ERROR'), 120)
    end,
    last_checked_at = now()
  where provider_id = p_provider_id;
end;
$$;

create or replace function public.admin_upsert_provider_runtime_config(
  p_provider_id text, p_enabled boolean, p_priority integer,
  p_emergency_disabled boolean, p_daily_spend_limit_minor bigint,
  p_spend_currency text, p_updated_by uuid
)
returns public.provider_runtime_configs
language plpgsql security definer set search_path = '' as $$
declare
  v_config public.provider_runtime_configs;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if not exists (
      select 1 from public.provider_runtime_configs where provider_id = p_provider_id
    )
    or p_priority not between 0 and 10000
    or p_daily_spend_limit_minor < 0
    or ((p_daily_spend_limit_minor is null) <> (p_spend_currency is null))
    or (p_spend_currency is not null and p_spend_currency !~ '^[A-Z]{3}$')
  then
    raise exception using errcode = '22023', message = 'INVALID_PROVIDER_RUNTIME_CONFIG';
  end if;

  update public.provider_runtime_configs set
    enabled = p_enabled,
    priority = p_priority,
    emergency_disabled = p_emergency_disabled,
    daily_spend_limit_minor = p_daily_spend_limit_minor,
    spend_currency = p_spend_currency,
    updated_by = p_updated_by
  where provider_id = p_provider_id
  returning * into v_config;
  return v_config;
end;
$$;

revoke all on function public.begin_ai_execution(uuid,text,text,text,text,text,uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.mark_ai_execution_streaming(uuid,uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.complete_ai_execution(uuid,uuid,bigint,text,jsonb)
  from public, anon, authenticated;
revoke all on function public.fail_ai_execution(uuid,uuid,text)
  from public, anon, authenticated;
revoke all on function public.record_provider_runtime_result(text,boolean,text)
  from public, anon, authenticated;
revoke all on function public.admin_upsert_provider_runtime_config(text,boolean,integer,boolean,bigint,text,uuid)
  from public, anon, authenticated;
grant execute on function public.begin_ai_execution(uuid,text,text,text,text,text,uuid,text,text)
  to service_role;
grant execute on function public.mark_ai_execution_streaming(uuid,uuid,uuid)
  to service_role;
grant execute on function public.complete_ai_execution(uuid,uuid,bigint,text,jsonb)
  to service_role;
grant execute on function public.fail_ai_execution(uuid,uuid,text)
  to service_role;
grant execute on function public.record_provider_runtime_result(text,boolean,text)
  to service_role;
grant execute on function public.admin_upsert_provider_runtime_config(text,boolean,integer,boolean,bigint,text,uuid)
  to service_role;

commit;
