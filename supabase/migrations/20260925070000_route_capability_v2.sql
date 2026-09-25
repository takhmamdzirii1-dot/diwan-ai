-- Route-bound native capability evidence and manual overrides live in the
-- existing model runtime configuration. No provider credentials are stored.
alter table public.model_runtime_configs
  add column if not exists route_capabilities_v2 jsonb not null default '{}'::jsonb;

-- Extend the existing model runtime audit snapshot without creating another
-- audit stream or changing historical entries.
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
        'capability_sync_status', old.capability_sync_status,
        'route_capabilities_v2', old.route_capabilities_v2
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
        'capability_sync_status', new.capability_sync_status,
        'route_capabilities_v2', new.route_capabilities_v2
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
