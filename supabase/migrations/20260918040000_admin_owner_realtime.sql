-- Owner-only reads for low-volume Admin Postgres Changes subscriptions.
-- Mutations stay in the existing service-role owner APIs.
begin;

grant select on public.ai_executions, public.model_runtime_configs,
  public.provider_runtime_configs to authenticated;

create policy "Owner can read execution events" on public.ai_executions
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');

create policy "Owner can read model config events" on public.model_runtime_configs
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');

create policy "Owner can read provider config events" on public.provider_runtime_configs
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');

create policy "Owner can read media generation events" on public.generations
  for select to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');

do $$
declare
  v_table text;
begin
  foreach v_table in array array['ai_executions', 'generations', 'model_runtime_configs', 'provider_runtime_configs'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;

commit;
