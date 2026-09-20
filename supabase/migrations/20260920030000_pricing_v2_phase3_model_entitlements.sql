-- Pricing V2, phase 3: model access is an explicit plan entitlement.
-- Customer Credit prices and every MAX commercial/runtime setting stay unchanged.

begin;

alter table public.model_runtime_configs
  add column if not exists allowed_plans text[] not null default array['max']::text[];

alter table public.model_runtime_configs
  drop constraint if exists model_runtime_allowed_plans_shape;
alter table public.model_runtime_configs
  add constraint model_runtime_allowed_plans_shape check (
    cardinality(allowed_plans) between 1 and 4
    and allowed_plans <@ array['free','lite','pro','max']::text[]
    and 'max' = any(allowed_plans)
    and (not ('free' = any(allowed_plans)) or (
      'lite' = any(allowed_plans) and 'pro' = any(allowed_plans)
    ))
    and (not ('lite' = any(allowed_plans)) or 'pro' = any(allowed_plans))
  );

-- Selected strong Free models. The current image/video entries remain available
-- to Free so their existing starter allowances still have a usable model.
update public.model_runtime_configs set allowed_plans = array['free','lite','pro','max']::text[]
where model_key in (
  'studio:chat:nvidia/nemotron-3-ultra-550b-a55b:free',
  'studio:image:flux',
  'vantra:chat:glm-5.3-flash',
  'vantra:image:mai-image-2.6-flash',
  'vantra:video:p-video-2-pro'
);

-- Strong Core catalog for Lite. This is deliberately the majority of the
-- configured catalog rather than a low-quality or mostly locked tier.
update public.model_runtime_configs set allowed_plans = array['lite','pro','max']::text[]
where model_key in (
  'vantra:chat:hy3',
  'vantra:chat:deepseek-v4-flash',
  'vantra:chat:qwen-3.8-flash',
  'vantra:chat:agnes-3.0-flash',
  'vantra:image:muse-image',
  'vantra:image:z-image',
  'vantra:video:p-video',
  'vantra:video:p-video-2'
);

-- Premium/Advanced entries add Pro while retaining frozen MAX access.
update public.model_runtime_configs set allowed_plans = array['pro','max']::text[]
where model_key in (
  'studio:chat:z-ai/glm-5.2:free',
  'studio:chat:poolside/laguna-s-2.1:free',
  'studio:chat:minimax/minimax-m3:free',
  'vantra:chat:union-alpha',
  'vantra:chat:qwen-3.8-flash-next',
  'vantra:image:flux-klein',
  'vantra:video:h3-max',
  'vantra:video:h3-max-turbo'
);

create or replace function public.admin_upsert_model_runtime_config_v2(
  p_model_key text,
  p_model_id text,
  p_modality text,
  p_enabled boolean,
  p_routing_role text,
  p_customer_credit_price bigint,
  p_allowed_plans text[],
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
    or p_customer_credit_price < 0
    or p_allowed_plans is null
    or cardinality(p_allowed_plans) not between 1 and 4
    or not (p_allowed_plans <@ array['free','lite','pro','max']::text[])
    or not ('max' = any(p_allowed_plans))
    or ('free' = any(p_allowed_plans) and not (
      'lite' = any(p_allowed_plans) and 'pro' = any(p_allowed_plans)
    ))
    or ('lite' = any(p_allowed_plans) and not ('pro' = any(p_allowed_plans)))
    or cardinality(p_allowed_plans) <> (
      select count(distinct plan_code) from unnest(p_allowed_plans) as plan_code
    )
  then
    raise exception using errcode = '22023', message = 'INVALID_MODEL_RUNTIME_CONFIG';
  end if;

  if p_enabled and p_routing_role = 'primary' then
    update public.model_runtime_configs
    set routing_role = 'unassigned', updated_by = p_updated_by
    where modality = p_modality and model_key <> p_model_key and routing_role = 'primary';
  end if;

  insert into public.model_runtime_configs (
    model_key, model_id, modality, enabled, routing_role,
    customer_credit_price, allowed_plans, updated_by
  ) values (
    btrim(p_model_key), btrim(p_model_id), p_modality, p_enabled, p_routing_role,
    p_customer_credit_price, p_allowed_plans, p_updated_by
  )
  on conflict (model_key) do update set
    model_id = excluded.model_id,
    modality = excluded.modality,
    enabled = excluded.enabled,
    routing_role = excluded.routing_role,
    customer_credit_price = excluded.customer_credit_price,
    allowed_plans = excluded.allowed_plans,
    updated_by = excluded.updated_by
  returning * into v_config;

  return v_config;
end;
$$;

revoke all on function public.admin_upsert_model_runtime_config_v2(text,text,text,boolean,text,bigint,text[],uuid)
  from public, anon, authenticated;
grant execute on function public.admin_upsert_model_runtime_config_v2(text,text,text,boolean,text,bigint,text[],uuid)
  to service_role;

create or replace function public.get_current_model_plan()
returns table (plan_code text, plan_name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select plan.plan_code, entitlement.plan_name
  from public.user_entitlements entitlement
  join public.payment_plans plan on plan.id = entitlement.plan_id
  where entitlement.user_id = (select auth.uid())
    and entitlement.status = 'active'
    and entitlement.starts_at <= now()
    and (entitlement.ends_at is null or entitlement.ends_at > now())
    and plan.plan_code in ('lite','pro','max')
  order by entitlement.starts_at desc, entitlement.created_at desc
  limit 1;
$$;

revoke all on function public.get_current_model_plan() from public, anon;
grant execute on function public.get_current_model_plan() to authenticated;

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
        'allowed_plans', old.allowed_plans,
        'display_name', old.customer_display_name, 'studio_visible', old.studio_visible,
        'sort_order', old.customer_sort_order, 'availability_label', old.customer_availability_label,
        'capabilities', old.capabilities
      ) end,
      jsonb_build_object(
        'enabled', new.enabled, 'routing_role', new.routing_role,
        'customer_credit_price', new.customer_credit_price,
        'allowed_plans', new.allowed_plans,
        'display_name', new.customer_display_name, 'studio_visible', new.studio_visible,
        'sort_order', new.customer_sort_order, 'availability_label', new.customer_availability_label,
        'capabilities', new.capabilities
      )
    );
  end if;
  return new;
end;
$$;

comment on column public.model_runtime_configs.allowed_plans is
  'Explicit Pricing V2 model access. Credits remain a separate authorization and billing concern.';
comment on function public.get_current_model_plan() is
  'Current active paid plan for Studio model access; no row means Free.';

commit;
