-- Weighted Chat Usage Engine.
--
-- Chat must NEVER consume VANTRA Credits. Each successful chat request
-- consumes internal weighted units (the chat model's customer_credit_price,
-- already administered per model) against per-plan rolling 5-hour and
-- rolling 7-day allowances.
--
-- Limit values codify the allowances already displayed in Admin → Limits &
-- Fallback (Free 120/800, Lite 200/1300, Pro 250/3000). A NULL limit means
-- unlimited for that window. Max is a frozen plan; its row stays unlimited
-- rather than locking any remaining Max user out of chat.
-- Customer-facing surfaces must never expose these raw units.

create table if not exists public.chat_plan_limits (
  plan_code text primary key,
  five_hour_limit integer check (five_hour_limit is null or five_hour_limit >= 0),
  weekly_limit integer check (weekly_limit is null or weekly_limit >= 0),
  fallback_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.chat_plan_limits (plan_code, five_hour_limit, weekly_limit, fallback_enabled)
values
  ('free', 120, 800, false),
  ('lite', 200, 1300, false),
  ('pro', 250, 3000, false),
  ('max', null, null, false)
on conflict (plan_code) do nothing;

-- One row per successfully completed chat request. Failed provider requests
-- never reach this table, so they never consume usage. operation_key is the
-- client idempotency key: retries replay without double-charging.
create table if not exists public.chat_usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  operation_key text not null unique,
  execution_id uuid,
  model_key text not null,
  model_id text not null,
  plan_code text not null,
  weight integer not null check (weight >= 0),
  created_at timestamptz not null default now()
);

create index if not exists chat_usage_records_user_created_idx
  on public.chat_usage_records (user_id, created_at desc);

alter table public.chat_plan_limits enable row level security;
alter table public.chat_usage_records enable row level security;
-- No policies: denied for anon/authenticated, service_role bypasses RLS.
-- All access goes through the service-role server engine; Admin reads use
-- the owner-guarded API routes below.

-- Atomic check-and-consume. Serialized per user via advisory lock so
-- concurrent requests cannot overshoot a window. Returns a jsonb envelope:
-- { allowed, duplicate, reason, five_hour_used, weekly_used,
--   five_hour_limit, weekly_limit, next_available_at }.
create or replace function public.consume_chat_usage(
  p_user_id uuid,
  p_operation_key text,
  p_execution_id uuid,
  p_model_key text,
  p_model_id text,
  p_plan_code text,
  p_weight integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lim5 integer;
  v_lim7 integer;
  v_use5 bigint;
  v_use7 bigint;
  v_oldest5 timestamptz;
  v_oldest7 timestamptz;
  v_util5 double precision := 0;
  v_util7 double precision := 0;
  v_next timestamptz := null;
begin
  if p_weight is null or p_weight < 0 then
    return jsonb_build_object('allowed', false, 'duplicate', false, 'reason', 'invalid_weight');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':chat-usage', 0));

  -- Idempotent replay: same operation key never charges twice.
  if exists (select 1 from public.chat_usage_records where operation_key = p_operation_key) then
    select coalesce(sum(weight), 0) into v_use5 from public.chat_usage_records
      where user_id = p_user_id and created_at > now() - interval '5 hours';
    select coalesce(sum(weight), 0) into v_use7 from public.chat_usage_records
      where user_id = p_user_id and created_at > now() - interval '7 days';
    select five_hour_limit, weekly_limit into v_lim5, v_lim7
      from public.chat_plan_limits where plan_code = p_plan_code;
    return jsonb_build_object(
      'allowed', true, 'duplicate', true, 'reason', 'already_recorded',
      'five_hour_used', v_use5, 'weekly_used', v_use7,
      'five_hour_limit', v_lim5, 'weekly_limit', v_lim7,
      'next_available_at', null);
  end if;

  select five_hour_limit, weekly_limit into v_lim5, v_lim7
    from public.chat_plan_limits where plan_code = p_plan_code;
  if not found then
    return jsonb_build_object(
      'allowed', false, 'duplicate', false, 'reason', 'limits_unconfigured',
      'five_hour_used', 0, 'weekly_used', 0,
      'five_hour_limit', null, 'weekly_limit', null,
      'next_available_at', null);
  end if;

  select coalesce(sum(weight), 0), min(created_at) into v_use5, v_oldest5
    from public.chat_usage_records
    where user_id = p_user_id and created_at > now() - interval '5 hours';
  select coalesce(sum(weight), 0), min(created_at) into v_use7, v_oldest7
    from public.chat_usage_records
    where user_id = p_user_id and created_at > now() - interval '7 days';

  if v_lim5 is not null and v_lim5 > 0 then v_util5 := (v_use5 + p_weight)::double precision / v_lim5; end if;
  if v_lim5 = 0 then v_util5 := case when v_use5 + p_weight > 0 then 2 else 0 end; end if;
  if v_lim7 is not null and v_lim7 > 0 then v_util7 := (v_use7 + p_weight)::double precision / v_lim7; end if;
  if v_lim7 = 0 then v_util7 := case when v_use7 + p_weight > 0 then 2 else 0 end; end if;

  -- Binding window = higher post-add utilization; its oldest record sets
  -- next availability. A limit of 0 denies any positive weight immediately.
  if v_util5 >= v_util7 then
    if v_oldest5 is not null then v_next := v_oldest5 + interval '5 hours'; end if;
  else
    if v_oldest7 is not null then v_next := v_oldest7 + interval '7 days'; end if;
  end if;

  if v_util5 > 1 or v_util7 > 1 then
    return jsonb_build_object(
      'allowed', false, 'duplicate', false, 'reason', 'limit_reached',
      'five_hour_used', v_use5, 'weekly_used', v_use7,
      'five_hour_limit', v_lim5, 'weekly_limit', v_lim7,
      'next_available_at', v_next);
  end if;

  insert into public.chat_usage_records
    (user_id, operation_key, execution_id, model_key, model_id, plan_code, weight)
  values
    (p_user_id, p_operation_key, p_execution_id, p_model_key, p_model_id, p_plan_code, p_weight);

  return jsonb_build_object(
    'allowed', true, 'duplicate', false, 'reason', 'recorded',
    'five_hour_used', v_use5 + p_weight, 'weekly_used', v_use7 + p_weight,
    'five_hour_limit', v_lim5, 'weekly_limit', v_lim7,
    'next_available_at', null);
end;
$$;

grant execute on function public.consume_chat_usage(uuid, text, uuid, text, text, text, integer) to service_role;
