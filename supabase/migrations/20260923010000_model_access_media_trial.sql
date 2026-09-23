-- Canonical per-plan model access and concurrency-safe model trial usage.
-- This is additive: existing runtime routes, pricing, credit ledgers, and history stay intact.

begin;

-- Preserve the final weighted Chat limits while removing the day-seven media gate.
insert into public.chat_plan_limits (plan_code, five_hour_limit, weekly_limit, fallback_enabled)
values
  ('free', 120, 800, false),
  ('lite', 200, 1600, false),
  ('pro', 300, 3000, false),
  ('max', 500, 6500, false)
on conflict (plan_code) do update set
  five_hour_limit = excluded.five_hour_limit,
  weekly_limit = excluded.weekly_limit,
  updated_at = now();

create table public.model_plan_access_configs (
  model_key text not null,
  plan_code text not null check (plan_code in ('free', 'lite', 'pro', 'max')),
  access_state text not null check (access_state in ('included', 'trial', 'locked')),
  trial_allowance integer check (trial_allowance is null or trial_allowance > 0),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (model_key, plan_code),
  constraint model_plan_access_trial_shape check (
    (access_state = 'trial') or trial_allowance is null
  )
);

alter table public.model_plan_access_configs enable row level security;
revoke all on table public.model_plan_access_configs from public, anon, authenticated;
grant select, insert, update on table public.model_plan_access_configs to service_role;

create or replace function public.audit_model_plan_access_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.updated_by is not null then
    perform public.write_admin_audit(
      new.updated_by,
      case when tg_op = 'INSERT' then 'model_access_created' else 'model_access_updated' end,
      'model', new.model_key,
      case when tg_op = 'INSERT' then null else jsonb_build_object(
        'plan_code', old.plan_code, 'access_state', old.access_state,
        'trial_allowance', old.trial_allowance
      ) end,
      jsonb_build_object(
        'plan_code', new.plan_code, 'access_state', new.access_state,
        'trial_allowance', new.trial_allowance
      )
    );
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger model_plan_access_admin_audit
before insert or update on public.model_plan_access_configs
for each row execute function public.audit_model_plan_access_change();

with matrix(modality, normalized_name, free_state, free_allowance, lite_state, lite_allowance) as (
  values
    ('chat','gpt56luna','included',null::integer,'included',null::integer),
    ('chat','luna','included',null,'included',null),
    ('chat','gpt56terra','included',null,'included',null),
    ('chat','terra','included',null,'included',null),
    ('chat','gemini38flash','included',null,'included',null),
    ('chat','claudesonnet5','trial',null,'included',null),
    ('chat','claude35sonnet','trial',null,'included',null),
    ('chat','sonnet','trial',null,'included',null),
    ('chat','gpt56sol','trial',null,'included',null),
    ('chat','gptsol','trial',null,'included',null),
    ('chat','kimik3','trial',null,'included',null),
    ('chat','gpt6astra','trial',null,'trial',null),
    ('chat','gptastra','trial',null,'trial',null),
    ('chat','claudefable51','trial',null,'trial',null),
    ('chat','fable51','trial',null,'trial',null),
    ('chat','claudeopus5','trial',null,'trial',null),
    ('chat','opus','trial',null,'trial',null),
    ('chat','grok46','trial',null,'trial',null),
    ('chat','gemini31pro','trial',null,'trial',null),
    ('image','seedream50pro','included',null,'included',null),
    ('image','nanobanana2pro','included',null,'included',null),
    ('image','nanobananapro','included',null,'included',null),
    ('image','gptimage25','trial',1,'included',null),
    ('image','grokimagineimage20','locked',null,'trial',1),
    ('video','geminiomniflash','included',null,'included',null),
    ('video','kling30pro','locked',null,'included',null),
    ('video','kling30','locked',null,'included',null),
    ('video','seedance25','locked',null,'trial',null)
), matched as (
  select config.model_key, matrix.free_state, matrix.free_allowance,
    matrix.lite_state, matrix.lite_allowance
  from public.model_runtime_configs config
  join matrix on matrix.modality = config.modality
    and matrix.normalized_name = lower(regexp_replace(config.customer_display_name, '[^a-zA-Z0-9]', '', 'g'))
  where not coalesce(config.archived, false)
), rows as (
  select model_key, 'free'::text plan_code, free_state access_state, free_allowance trial_allowance from matched
  union all select model_key, 'lite', lite_state, lite_allowance from matched
  union all select model_key, 'pro', 'included', null from matched
  union all select model_key, 'max', 'included', null from matched
)
insert into public.model_plan_access_configs (model_key, plan_code, access_state, trial_allowance)
select model_key, plan_code, access_state, trial_allowance from rows
on conflict (model_key, plan_code) do nothing;

create table public.model_trial_usages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_key text not null,
  model_id text not null,
  modality text not null check (modality in ('chat', 'image', 'video')),
  plan_code text not null check (plan_code in ('free', 'lite', 'pro', 'max')),
  entitlement_id uuid references public.user_entitlements(id) on delete restrict,
  trial_scope text not null,
  operation_key text not null check (char_length(operation_key) between 1 and 200),
  credit_reservation_id uuid references public.credit_reservations(id) on delete set null,
  state text not null check (state in ('reserved', 'completed', 'released')),
  expires_at timestamptz not null,
  completed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, operation_key)
);

create index model_trial_usage_scope_idx on public.model_trial_usages
  (user_id, model_key, plan_code, trial_scope, state, created_at desc);
create unique index model_trial_usage_credit_reservation_idx on public.model_trial_usages (credit_reservation_id)
  where credit_reservation_id is not null;

alter table public.model_trial_usages enable row level security;
revoke all on table public.model_trial_usages from public, anon, authenticated;
grant select, insert, update on table public.model_trial_usages to service_role;

create or replace function public.reserve_model_trial_access(
  p_user_id uuid,
  p_model_key text,
  p_model_id text,
  p_modality text,
  p_plan_code text,
  p_operation_key text,
  p_credit_reservation_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_access public.model_plan_access_configs%rowtype;
  v_existing public.model_trial_usages%rowtype;
  v_effective_plan text := 'free';
  v_entitlement_id uuid;
  v_scope text;
  v_used integer;
  v_expiry timestamptz := now() + interval '20 minutes';
  v_trial_id uuid;
  v_user_created_at timestamptz;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_user_id is null or p_modality not in ('chat','image','video')
    or p_plan_code not in ('free','lite','pro','max')
    or char_length(btrim(coalesce(p_model_key,''))) = 0
    or char_length(btrim(coalesce(p_model_id,''))) = 0
    or char_length(btrim(coalesce(p_operation_key,''))) not between 1 and 200
  then raise exception using errcode = '22023', message = 'INVALID_MODEL_TRIAL_REQUEST'; end if;

  select entitlement.id, plan.plan_code into v_entitlement_id, v_effective_plan
  from public.user_entitlements entitlement
  join public.payment_plans plan on plan.id = entitlement.plan_id
  where entitlement.user_id = p_user_id and entitlement.status = 'active'
    and (entitlement.ends_at is null or entitlement.ends_at > now())
    and plan.plan_code in ('lite','pro','max')
  order by entitlement.starts_at desc, entitlement.created_at desc limit 1;
  if not found then v_effective_plan := 'free'; v_entitlement_id := null; end if;
  if v_effective_plan <> p_plan_code then
    raise exception using errcode = 'P0001', message = 'MODEL_ACCESS_CHANGED';
  end if;

  select * into v_access from public.model_plan_access_configs
  where model_key = p_model_key and plan_code = v_effective_plan;
  if not found or v_access.access_state <> 'trial' or v_access.trial_allowance is null then
    raise exception using errcode = 'P0001', message = 'MODEL_TRIAL_UNCONFIGURED';
  end if;

  if v_effective_plan = 'free' then
    select created_at into v_user_created_at from auth.users where id = p_user_id;
    if not found then raise exception using errcode = 'P0001', message = 'MODEL_ACCESS_CHANGED'; end if;
    if p_modality in ('image','video') and now() >= v_user_created_at + interval '7 days' then
      raise exception using errcode = 'P0001', message = 'FREE_MEDIA_EXPIRED';
    end if;
    v_scope := 'free:one-time';
  else
    v_scope := 'entitlement:' || v_entitlement_id::text;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_model_key || ':' || v_scope, 0));
  select * into v_existing from public.model_trial_usages
  where user_id = p_user_id and operation_key = p_operation_key;
  if found then
    if v_existing.model_key <> p_model_key or v_existing.plan_code <> v_effective_plan
      or v_existing.trial_scope <> v_scope or v_existing.state = 'released'
    then raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('trial_usage_id',v_existing.id,'state',v_existing.state,'idempotent',true);
  end if;

  update public.model_trial_usages set state = 'released', released_at = now(), updated_at = now()
  where user_id = p_user_id and model_key = p_model_key and plan_code = v_effective_plan
    and trial_scope = v_scope and state = 'reserved' and expires_at <= now();
  select count(*) into v_used from public.model_trial_usages
  where user_id = p_user_id and model_key = p_model_key and plan_code = v_effective_plan
    and trial_scope = v_scope and (state = 'completed' or (state = 'reserved' and expires_at > now()));
  if v_used >= v_access.trial_allowance then
    raise exception using errcode = 'P0001', message = 'MODEL_TRIAL_EXHAUSTED';
  end if;

  if p_credit_reservation_id is not null then
    select least(expires_at, v_expiry) into v_expiry from public.credit_reservations
    where id = p_credit_reservation_id and user_id = p_user_id and operation_key = p_operation_key;
    if not found then raise exception using errcode = 'P0001', message = 'MODEL_ACCESS_CHANGED'; end if;
  end if;
  insert into public.model_trial_usages (
    user_id, model_key, model_id, modality, plan_code, entitlement_id, trial_scope,
    operation_key, credit_reservation_id, state, expires_at
  ) values (
    p_user_id,p_model_key,p_model_id,p_modality,v_effective_plan,v_entitlement_id,v_scope,
    p_operation_key,p_credit_reservation_id,'reserved',v_expiry
  ) returning id into v_trial_id;
  return jsonb_build_object('trial_usage_id',v_trial_id,'state','reserved','idempotent',false);
end;
$$;

create or replace function public.finalize_model_trial_access(
  p_user_id uuid,
  p_operation_key text,
  p_outcome text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_usage public.model_trial_usages%rowtype;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_user_id is null or p_outcome not in ('completed','released') then
    raise exception using errcode = '22023', message = 'INVALID_MODEL_TRIAL_FINALIZATION';
  end if;
  select * into v_usage from public.model_trial_usages
  where user_id = p_user_id and operation_key = p_operation_key for update;
  if not found then return jsonb_build_object('state','not_applicable','idempotent',true); end if;
  if v_usage.state = p_outcome then
    return jsonb_build_object('trial_usage_id',v_usage.id,'state',v_usage.state,'idempotent',true);
  end if;
  if v_usage.state <> 'reserved' then
    raise exception using errcode = '22023', message = 'MODEL_TRIAL_ALREADY_FINALIZED';
  end if;
  update public.model_trial_usages set state = p_outcome,
    completed_at = case when p_outcome = 'completed' then now() else null end,
    released_at = case when p_outcome = 'released' then now() else null end,
    updated_at = now() where id = v_usage.id;
  return jsonb_build_object('trial_usage_id',v_usage.id,'state',p_outcome,'idempotent',false);
end;
$$;

create or replace function public.enforce_free_media_trial_expiry()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_created_at timestamptz;
begin
  if new.funding_source in ('free_trial_image','free_trial_video') then
    select created_at into v_created_at from auth.users where id = new.user_id;
    if v_created_at is null or now() >= v_created_at + interval '7 days' then
      raise exception using errcode = 'P0001', message = 'FREE_MEDIA_EXPIRED';
    end if;
  end if;
  return new;
end;
$$;

create trigger credit_reservation_free_media_expiry
before insert on public.credit_reservations
for each row execute function public.enforce_free_media_trial_expiry();

revoke all on function public.reserve_model_trial_access(uuid,text,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.reserve_model_trial_access(uuid,text,text,text,text,text,uuid) to service_role;
revoke all on function public.finalize_model_trial_access(uuid,text,text) from public, anon, authenticated;
grant execute on function public.finalize_model_trial_access(uuid,text,text) to service_role;

comment on table public.model_plan_access_configs is 'Canonical per-plan Included, Trial, or Locked access for customer-facing models.';
comment on table public.model_trial_usages is 'Idempotent model trial reservations scoped to the Free account or a paid entitlement period.';

commit;
