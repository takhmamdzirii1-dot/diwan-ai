-- Typed model capabilities are operational configuration. Missing values are
-- deliberately unsupported; provider metadata, credentials and prices remain separate.

begin;

alter table public.model_runtime_configs
  add column if not exists capabilities jsonb not null default '{}'::jsonb;

alter table public.model_runtime_configs
  drop constraint if exists model_runtime_capabilities_object;
alter table public.model_runtime_configs
  add constraint model_runtime_capabilities_object check (jsonb_typeof(capabilities) = 'object');

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
        'display_name', old.customer_display_name, 'studio_visible', old.studio_visible,
        'sort_order', old.customer_sort_order, 'availability_label', old.customer_availability_label,
        'capabilities', old.capabilities
      ) end,
      jsonb_build_object(
        'enabled', new.enabled, 'routing_role', new.routing_role,
        'customer_credit_price', new.customer_credit_price,
        'display_name', new.customer_display_name, 'studio_visible', new.studio_visible,
        'sort_order', new.customer_sort_order, 'availability_label', new.customer_availability_label,
        'capabilities', new.capabilities
      )
    );
  end if;
  return new;
end;
$$;

commit;
