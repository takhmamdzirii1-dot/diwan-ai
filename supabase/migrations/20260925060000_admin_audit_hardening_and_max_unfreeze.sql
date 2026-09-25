begin;

-- MAX catalog values become editable for future orders/periods. The update is
-- intentionally limited to the live catalog row; immutable payment orders,
-- entitlement snapshots, subscription periods and ledger history are untouched.
lock table public.payment_plans in share row exclusive mode;
alter table public.payment_plans disable trigger payment_plan_admin_audit;
alter table public.payment_plans disable trigger protect_frozen_payment_plan;

update public.payment_plans
set frozen = false,
    updated_at = now()
where plan_code = 'max'
  and frozen = true;

alter table public.payment_plans enable trigger protect_frozen_payment_plan;
alter table public.payment_plans enable trigger payment_plan_admin_audit;

-- Preserve the generic freeze guard for any catalog row intentionally frozen in
-- the future. MAX is editable because its row no longer carries the frozen flag.
create or replace function public.protect_frozen_payment_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.frozen then
      raise exception using errcode = '55000', message = 'PAYMENT_PLAN_FROZEN';
    end if;
    return old;
  end if;
  if old.frozen and (
    new.slug is distinct from old.slug
    or new.plan_code is distinct from old.plan_code
    or new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.kind is distinct from old.kind
    or new.price_dzd is distinct from old.price_dzd
    or new.unified_credits is distinct from old.unified_credits
    or new.active is distinct from old.active
    or new.featured is distinct from old.featured
    or new.entitlement is distinct from old.entitlement
    or new.access_period_days is distinct from old.access_period_days
    or new.public_visible is distinct from old.public_visible
    or new.eligibility_required is distinct from old.eligibility_required
    or new.subscription_credit_allowance is distinct from old.subscription_credit_allowance
    or new.frozen is distinct from old.frozen
  ) then
    raise exception using errcode = '55000', message = 'PAYMENT_PLAN_FROZEN';
  end if;
  return new;
end;
$$;

-- Full, secret-free catalog snapshots make field-level diffs useful while the
-- stable row id continues to anchor historical audit records.
create or replace function public.audit_payment_plan_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := case when tg_op = 'INSERT' then new.updated_by else coalesce(new.updated_by, old.updated_by) end;
  v_is_pack boolean := new.kind = 'credit_pack';
begin
  if v_actor is not null then
    perform public.write_admin_audit(
      v_actor,
      case
        when tg_op = 'INSERT' and v_is_pack then 'credit_pack_created'
        when tg_op = 'INSERT' then 'plan_created'
        when old.active and not new.active and v_is_pack then 'credit_pack_archived'
        when old.active and not new.active then 'plan_archived'
        when v_is_pack then 'credit_pack_updated'
        else 'plan_updated'
      end,
      'plan',
      new.id::text,
      case when tg_op = 'INSERT' then null else jsonb_build_object(
        'name', old.name,
        'plan_code', old.plan_code,
        'description', old.description,
        'kind', old.kind,
        'price_dzd', old.price_dzd,
        'unified_credits', old.unified_credits,
        'subscription_credit_allowance', old.subscription_credit_allowance,
        'included_video_allowance', old.included_video_allowance,
        'access_period_days', old.access_period_days,
        'active', old.active,
        'public_visible', old.public_visible,
        'eligibility_required', old.eligibility_required,
        'display_order', old.display_order,
        'featured', old.featured,
        'top_up_plan_code', old.entitlement->>'top_up_plan_code',
        'top_up_purchase_limit_per_period', old.entitlement->>'top_up_purchase_limit_per_period'
      ) end,
      jsonb_build_object(
        'name', new.name,
        'plan_code', new.plan_code,
        'description', new.description,
        'kind', new.kind,
        'price_dzd', new.price_dzd,
        'unified_credits', new.unified_credits,
        'subscription_credit_allowance', new.subscription_credit_allowance,
        'included_video_allowance', new.included_video_allowance,
        'access_period_days', new.access_period_days,
        'active', new.active,
        'public_visible', new.public_visible,
        'eligibility_required', new.eligibility_required,
        'display_order', new.display_order,
        'featured', new.featured,
        'top_up_plan_code', new.entitlement->>'top_up_plan_code',
        'top_up_purchase_limit_per_period', new.entitlement->>'top_up_purchase_limit_per_period'
      ),
      jsonb_build_object(
        'resource_label', new.name || ' (' || coalesce(new.plan_code, new.slug) || ')',
        'resource_code', coalesce(new.plan_code, new.slug)
      )
    );
  end if;
  return new;
end;
$$;

create or replace function public.audit_model_runtime_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := case when tg_op = 'INSERT' then new.updated_by else coalesce(new.updated_by, old.updated_by) end;
  v_label text := coalesce(nullif(btrim(new.customer_display_name), ''), new.model_key);
begin
  if v_actor is not null then
    perform public.write_admin_audit(
      v_actor,
      case when tg_op = 'INSERT' then 'model_runtime_created' else 'model_runtime_updated' end,
      'model',
      new.model_key,
      case when tg_op = 'INSERT' then null else jsonb_build_object(
        'model_id', old.model_id,
        'modality', old.modality,
        'enabled', old.enabled,
        'archived', old.archived,
        'routing_role', old.routing_role,
        'customer_credit_price', old.customer_credit_price,
        'provider_cost_status', old.provider_cost_status,
        'provider_cost_minor', old.provider_cost_minor,
        'provider_cost_currency', old.provider_cost_currency,
        'allowed_plans', old.allowed_plans,
        'display_name', old.customer_display_name,
        'short_description', old.customer_short_description,
        'media_url', old.customer_media_url,
        'category', old.customer_category,
        'studio_visible', old.studio_visible,
        'sort_order', old.customer_sort_order,
        'availability_label', old.customer_availability_label,
        'capabilities', old.capabilities,
        'surface_visibility', old.surface_visibility,
        'capability_source_type', old.capability_source_type,
        'capability_confidence', old.capability_confidence,
        'capability_sync_status', old.capability_sync_status
      ) end,
      jsonb_build_object(
        'model_id', new.model_id,
        'modality', new.modality,
        'enabled', new.enabled,
        'archived', new.archived,
        'routing_role', new.routing_role,
        'customer_credit_price', new.customer_credit_price,
        'provider_cost_status', new.provider_cost_status,
        'provider_cost_minor', new.provider_cost_minor,
        'provider_cost_currency', new.provider_cost_currency,
        'allowed_plans', new.allowed_plans,
        'display_name', new.customer_display_name,
        'short_description', new.customer_short_description,
        'media_url', new.customer_media_url,
        'category', new.customer_category,
        'studio_visible', new.studio_visible,
        'sort_order', new.customer_sort_order,
        'availability_label', new.customer_availability_label,
        'capabilities', new.capabilities,
        'surface_visibility', new.surface_visibility,
        'capability_source_type', new.capability_source_type,
        'capability_confidence', new.capability_confidence,
        'capability_sync_status', new.capability_sync_status
      ),
      jsonb_build_object(
        'resource_label', v_label || ' (' || new.model_key || ')',
        'modality', new.modality
      )
    );
  end if;
  return new;
end;
$$;

create or replace function public.audit_provider_route_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := case when tg_op = 'INSERT' then new.updated_by else coalesce(new.updated_by, old.updated_by) end;
begin
  if v_actor is not null then
    perform public.write_admin_audit(
      v_actor,
      case when tg_op = 'INSERT' then 'provider_route_created' else 'provider_route_updated' end,
      'provider_route',
      new.id::text,
      case when tg_op = 'INSERT' then null else jsonb_build_object(
        'model_key', old.model_key,
        'provider_id', old.provider_id,
        'provider_model_id', old.provider_model_id,
        'enabled', old.enabled,
        'priority', old.priority,
        'fallback', old.fallback
      ) end,
      jsonb_build_object(
        'model_key', new.model_key,
        'provider_id', new.provider_id,
        'provider_model_id', new.provider_model_id,
        'enabled', new.enabled,
        'priority', new.priority,
        'fallback', new.fallback
      ),
      jsonb_build_object(
        'resource_label', new.model_key || ' via ' || new.provider_id,
        'model_key', new.model_key,
        'provider_id', new.provider_id
      )
    );
  end if;
  return new;
end;
$$;

create or replace function public.audit_provider_runtime_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := case when tg_op = 'INSERT' then new.updated_by else coalesce(new.updated_by, old.updated_by) end;
  v_label text := coalesce(nullif(btrim(new.display_name), ''), new.provider_id);
begin
  if v_actor is not null then
    perform public.write_admin_audit(
      v_actor,
      case when tg_op = 'INSERT' then 'provider_runtime_created' else 'provider_runtime_updated' end,
      'provider',
      new.provider_id,
      case when tg_op = 'INSERT' then null else jsonb_build_object(
        'display_name', old.display_name,
        'adapter_type', old.adapter_type,
        'enabled', old.enabled,
        'archived', old.archived,
        'priority', old.priority,
        'emergency_disabled', old.emergency_disabled,
        'daily_spend_limit_minor', old.daily_spend_limit_minor,
        'spend_currency', old.spend_currency
      ) end,
      jsonb_build_object(
        'display_name', new.display_name,
        'adapter_type', new.adapter_type,
        'enabled', new.enabled,
        'archived', new.archived,
        'priority', new.priority,
        'emergency_disabled', new.emergency_disabled,
        'daily_spend_limit_minor', new.daily_spend_limit_minor,
        'spend_currency', new.spend_currency
      ),
      jsonb_build_object('resource_label', v_label || ' (' || new.provider_id || ')')
    );
  end if;
  return new;
end;
$$;

create or replace function public.audit_model_plan_access_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.updated_by is not null then
    perform public.write_admin_audit(
      new.updated_by,
      case when tg_op = 'INSERT' then 'model_access_created' else 'model_access_updated' end,
      'model',
      new.model_key,
      case when tg_op = 'INSERT' then null else jsonb_build_object(
        'plan_code', old.plan_code,
        'access_state', old.access_state,
        'trial_allowance', old.trial_allowance
      ) end,
      jsonb_build_object(
        'plan_code', new.plan_code,
        'access_state', new.access_state,
        'trial_allowance', new.trial_allowance
      ),
      jsonb_build_object(
        'resource_label', new.model_key || ' · ' || upper(new.plan_code),
        'plan_code', new.plan_code
      )
    );
  end if;
  new.updated_at := now();
  return new;
end;
$$;

comment on column public.payment_plans.frozen is
  'Optional catalog edit guard. MAX was unfrozen for future catalog management by migration 20260925060000; historical order snapshots remain immutable.';

commit;
