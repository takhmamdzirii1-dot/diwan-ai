-- Owner-managed operational model overrides. The typed application registry
-- remains the metadata/capability authority; this table stores runtime choices only.

begin;

create table if not exists public.model_runtime_configs (
  model_key text primary key check (char_length(btrim(model_key)) between 1 and 300),
  model_id text not null check (char_length(btrim(model_id)) between 1 and 240),
  modality text not null check (modality in ('chat', 'image', 'video')),
  enabled boolean not null default false,
  routing_role text not null default 'unassigned'
    check (routing_role in ('primary', 'backup', 'unassigned')),
  customer_credit_price bigint check (customer_credit_price is null or customer_credit_price >= 0),
  provider_cost_status text check (provider_cost_status in ('free', 'known', 'unknown')),
  provider_cost_minor bigint check (provider_cost_minor is null or provider_cost_minor >= 0),
  provider_cost_currency text check (provider_cost_currency is null or provider_cost_currency ~ '^[A-Z]{3}$'),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_runtime_role_requires_enabled check (enabled or routing_role = 'unassigned'),
  constraint model_runtime_provider_cost_shape check (
    provider_cost_status is null
    or (provider_cost_status = 'unknown' and provider_cost_minor is null and provider_cost_currency is null)
    or (provider_cost_status = 'free' and provider_cost_minor = 0)
    or (provider_cost_status = 'known' and provider_cost_minor is not null and provider_cost_currency is not null)
  )
);

create unique index if not exists model_runtime_one_primary_per_modality_idx
  on public.model_runtime_configs (modality)
  where enabled and routing_role = 'primary';

create index if not exists model_runtime_enabled_modality_idx
  on public.model_runtime_configs (modality, enabled, routing_role);

create or replace function public.model_runtime_config_set_updated_at()
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

drop trigger if exists model_runtime_configs_updated_at on public.model_runtime_configs;
create trigger model_runtime_configs_updated_at
  before update on public.model_runtime_configs
  for each row execute function public.model_runtime_config_set_updated_at();

alter table public.model_runtime_configs enable row level security;
revoke all on table public.model_runtime_configs from public, anon, authenticated;
grant all on table public.model_runtime_configs to service_role;

create or replace function public.admin_upsert_model_runtime_config(
  p_model_key text,
  p_model_id text,
  p_modality text,
  p_enabled boolean,
  p_routing_role text,
  p_customer_credit_price bigint,
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
    or p_routing_role not in ('primary', 'backup', 'unassigned')
    or (not p_enabled and p_routing_role <> 'unassigned')
    or p_customer_credit_price < 0 then
    raise exception using errcode = '22023', message = 'INVALID_MODEL_RUNTIME_CONFIG';
  end if;

  if p_enabled and p_routing_role = 'primary' then
    update public.model_runtime_configs
    set routing_role = 'unassigned', updated_by = p_updated_by
    where modality = p_modality and model_key <> p_model_key and routing_role = 'primary';
  end if;

  insert into public.model_runtime_configs (
    model_key, model_id, modality, enabled, routing_role, customer_credit_price, updated_by
  ) values (
    btrim(p_model_key), btrim(p_model_id), p_modality, p_enabled, p_routing_role,
    p_customer_credit_price, p_updated_by
  )
  on conflict (model_key) do update set
    model_id = excluded.model_id,
    modality = excluded.modality,
    enabled = excluded.enabled,
    routing_role = excluded.routing_role,
    customer_credit_price = excluded.customer_credit_price,
    updated_by = excluded.updated_by
  returning * into v_config;

  return v_config;
end;
$$;

revoke all on function public.admin_upsert_model_runtime_config(text,text,text,boolean,text,bigint,uuid)
  from public, anon, authenticated;
grant execute on function public.admin_upsert_model_runtime_config(text,text,text,boolean,text,bigint,uuid)
  to service_role;

commit;
