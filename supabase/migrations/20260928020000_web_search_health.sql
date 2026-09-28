-- Search provider health only. No query text, result content, or credentials are stored.
create table if not exists public.web_search_health (
  provider_id text not null check (provider_id ~ '^[a-z][a-z0-9_]{1,39}$'),
  month date not null,
  requests integer not null default 0 check (requests >= 0),
  successes integer not null default 0 check (successes >= 0),
  failures integer not null default 0 check (failures >= 0),
  rate_limits integer not null default 0 check (rate_limits >= 0),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  consecutive_rate_limits integer not null default 0 check (consecutive_rate_limits >= 0),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_failure_category text,
  cooldown_until timestamptz,
  last_latency_ms integer,
  last_result_count integer,
  last_truncated boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (provider_id, month)
);
alter table public.web_search_health enable row level security;
revoke all on public.web_search_health from anon, authenticated;
grant select, insert, update on public.web_search_health to service_role;

create or replace function public.claim_web_search_request(p_provider_id text, p_budget integer default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_row public.web_search_health%rowtype;
declare v_month date := date_trunc('month', now() at time zone 'UTC')::date;
begin
  if auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
  if p_provider_id !~ '^[a-z][a-z0-9_]{1,39}$' or (p_budget is not null and p_budget <= 0) then
    raise exception 'invalid search provider or budget';
  end if;
  insert into public.web_search_health(provider_id, month) values (p_provider_id, v_month)
    on conflict (provider_id, month) do nothing;
  select * into v_row from public.web_search_health
    where provider_id = p_provider_id and month = v_month for update;
  if v_row.cooldown_until > now() then return 'cooldown'; end if;
  if p_budget is not null and v_row.requests >= p_budget then return 'budget'; end if;
  update public.web_search_health set requests = requests + 1, updated_at = now()
    where provider_id = p_provider_id and month = v_month;
  return 'ok';
end $$;

create or replace function public.record_web_search_result(
  p_provider_id text, p_success boolean, p_category text,
  p_latency_ms integer, p_result_count integer, p_truncated boolean, p_cooldown_seconds integer
) returns void language plpgsql security definer set search_path = public as $$
declare v_month date := date_trunc('month', now() at time zone 'UTC')::date;
begin
  if auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
  if p_provider_id !~ '^[a-z][a-z0-9_]{1,39}$' or p_success is null
    or p_latency_ms < 0 or p_latency_ms > 120000 or p_result_count < 0 or p_result_count > 20
    or p_cooldown_seconds < 0 or p_cooldown_seconds > 86400
    or (not p_success and p_category not in ('rate_limited','quota_exhausted','timeout','unavailable','invalid_response')) then
    raise exception 'invalid search result';
  end if;
  update public.web_search_health set
    successes = successes + case when p_success then 1 else 0 end,
    failures = failures + case when p_success then 0 else 1 end,
    rate_limits = rate_limits + case when p_category = 'rate_limited' then 1 else 0 end,
    consecutive_failures = case when p_success then 0 else consecutive_failures + 1 end,
    consecutive_rate_limits = case when p_success then 0 when p_category = 'rate_limited'
      then consecutive_rate_limits + 1 else 0 end,
    last_success_at = case when p_success then now() else last_success_at end,
    last_failure_at = case when p_success then last_failure_at else now() end,
    last_failure_category = case when p_success then last_failure_category else p_category end,
    cooldown_until = case when p_success then null when p_cooldown_seconds > 0
      then now() + make_interval(secs => p_cooldown_seconds) else null end,
    last_latency_ms = p_latency_ms, last_result_count = p_result_count,
    last_truncated = coalesce(p_truncated, false), updated_at = now()
  where provider_id = p_provider_id and month = v_month;
end $$;

revoke all on function public.claim_web_search_request(text, integer) from public, anon, authenticated;
revoke all on function public.record_web_search_result(text, boolean, text, integer, integer, boolean, integer) from public, anon, authenticated;
grant execute on function public.claim_web_search_request(text, integer) to service_role;
grant execute on function public.record_web_search_result(text, boolean, text, integer, integer, boolean, integer) to service_role;
