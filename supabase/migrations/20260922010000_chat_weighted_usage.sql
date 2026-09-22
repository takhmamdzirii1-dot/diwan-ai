-- Weighted Chat Usage Engine.
--
-- Chat must NEVER consume VANTRA Credits. Each chat request reserves
-- internal weighted units (the chat model's customer_credit_price, already
-- administered per model) against per-plan rolling 5-hour and rolling 7-day
-- allowances BEFORE provider dispatch, then finalizes on completion.
--
-- Limit values codify the allowances already displayed in Admin → Limits &
-- Fallback (Free 120/800, Lite 200/1300, Pro 250/3000). A NULL limit means
-- unlimited for that window. Max is a frozen plan; its row stays unlimited
-- rather than locking any remaining Max user out of chat.
-- Customer-facing surfaces must never expose these raw units.
--
-- Reservation lifecycle (all inside one atomic RPC per transition):
--   reserve   → row (status 'reserved', expires_at +15min) holds capacity
--   completed → row flips to 'completed' and counts exactly once
--   released  → row is deleted (failures/cancels never consume usage)
--   stale     → expired reservations are purged on every reserve call, so a
--               dead process can never pin capacity past its expiry
-- Only 'completed' rows are permanent usage; active reservations also hold
-- capacity while in flight so concurrent requests cannot overshoot.

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

create table if not exists public.chat_usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  operation_key text not null unique,
  execution_id uuid,
  model_key text not null,
  model_id text not null,
  plan_code text not null,
  weight integer not null check (weight >= 0),
  status text not null default 'completed' check (status in ('reserved', 'completed')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists chat_usage_records_user_created_idx
  on public.chat_usage_records (user_id, created_at desc);

alter table public.chat_plan_limits enable row level security;
alter table public.chat_usage_records enable row level security;
-- No policies: denied for anon/authenticated, service_role bypasses RLS.
-- All access goes through the service-role server engine; Admin reads use
-- owner-guarded API routes.

-- Atomic reserve. Serialized per user via advisory lock so concurrent
-- distinct requests cannot overshoot a window. Same operation_key replays
-- return the existing reservation without reserving twice. Expired
-- reservations for this user are purged first (stale-process safety).
-- Window sums count completed usage plus live reservations, so held
-- capacity is never double-booked.
-- Returns: { allowed, duplicate, reason, five_hour_used, weekly_used,
--   five_hour_limit, weekly_limit, next_available_at }.
create or replace function public.reserve_chat_usage(
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
  v_status text;
  v_lim5 integer;
  v_lim7 integer;
  v_use5 bigint;
  v_use7 bigint;
  v_needed5 bigint;
  v_needed7 bigint;
  v_next5 timestamptz := null;
  v_next7 timestamptz := null;
  v_next timestamptz := null;
begin
  if p_weight is null or p_weight < 0 then
    return jsonb_build_object('allowed', false, 'duplicate', false, 'reason', 'invalid_weight');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':chat-usage', 0));

  -- Stale-process safety: dead reservations stop holding capacity.
  delete from public.chat_usage_records
    where user_id = p_user_id and status = 'reserved'
      and expires_at is not null and expires_at <= now();

  -- Idempotent replay: a completed key reports current state, an in-flight
  -- key returns its live reservation. Neither reserves twice.
  select status into v_status from public.chat_usage_records
    where operation_key = p_operation_key;
  if found then
    select coalesce(sum(weight), 0) into v_use5 from public.chat_usage_records
      where user_id = p_user_id and status = 'completed'
        and created_at > now() - interval '5 hours';
    select coalesce(sum(weight), 0) into v_use7 from public.chat_usage_records
      where user_id = p_user_id and status = 'completed'
        and created_at > now() - interval '7 days';
    select five_hour_limit, weekly_limit into v_lim5, v_lim7
      from public.chat_plan_limits where plan_code = p_plan_code;
    return jsonb_build_object(
      'allowed', true, 'duplicate', true,
      'reason', case when v_status = 'completed' then 'already_recorded' else 'already_reserved' end,
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

  -- Held capacity: completed usage plus live (non-expired) reservations.
  select coalesce(sum(weight), 0) into v_use5 from public.chat_usage_records
    where user_id = p_user_id
      and (status = 'completed' or (status = 'reserved' and (expires_at is null or expires_at > now())))
      and created_at > now() - interval '5 hours';
  select coalesce(sum(weight), 0) into v_use7 from public.chat_usage_records
    where user_id = p_user_id
      and (status = 'completed' or (status = 'reserved' and (expires_at is null or expires_at > now())))
      and created_at > now() - interval '7 days';

  -- Weighted availability: how much must expire before this weight fits.
  v_needed5 := greatest((v_use5 + p_weight) - coalesce(v_lim5, (v_use5 + p_weight)), 0);
  v_needed7 := greatest((v_use7 + p_weight) - coalesce(v_lim7, (v_use7 + p_weight)), 0);
  if v_lim5 is null then v_needed5 := 0; end if;
  if v_lim7 is null then v_needed7 := 0; end if;

  if v_needed5 > 0 then
    -- Earliest cutoff whose cumulatively expired weight covers the need.
    -- Records ordered oldest-first; at a record's cutoff exactly the rows
    -- up to and including it have expired.
    select min(sub.cutoff) into v_next5 from (
      select r.created_at + interval '5 hours' as cutoff,
             sum(r.weight) over (order by r.created_at, r.id rows unbounded preceding) as freed
        from public.chat_usage_records r
        where r.user_id = p_user_id and r.status = 'completed'
          and r.created_at > now() - interval '5 hours'
    ) sub where sub.freed >= v_needed5;
  end if;
  if v_needed7 > 0 then
    select min(sub.cutoff) into v_next7 from (
      select r.created_at + interval '7 days' as cutoff,
             sum(r.weight) over (order by r.created_at, r.id rows unbounded preceding) as freed
        from public.chat_usage_records r
        where r.user_id = p_user_id and r.status = 'completed'
          and r.created_at > now() - interval '7 days'
    ) sub where sub.freed >= v_needed7;
  end if;

  -- Binding availability: the later of the two windows. A window that can
  -- never free enough (single weight above its limit) binds with null.
  if v_needed5 <= 0 and v_needed7 <= 0 then
    insert into public.chat_usage_records
      (user_id, operation_key, execution_id, model_key, model_id, plan_code, weight, status, expires_at)
    values
      (p_user_id, p_operation_key, p_execution_id, p_model_key, p_model_id, p_plan_code, p_weight, 'reserved', now() + interval '15 minutes');
    return jsonb_build_object(
      'allowed', true, 'duplicate', false, 'reason', 'reserved',
      'five_hour_used', v_use5 + p_weight, 'weekly_used', v_use7 + p_weight,
      'five_hour_limit', v_lim5, 'weekly_limit', v_lim7,
      'next_available_at', null);
  end if;

  if v_needed5 > 0 and v_needed7 > 0 then
    v_next := greatest(v_next5, v_next7);
  elsif v_needed5 > 0 then
    v_next := v_next5;
  else
    v_next := v_next7;
  end if;
  -- greatest() with a null input yields null: a window that can never free
  -- enough binds the request with no countdown.
  return jsonb_build_object(
    'allowed', false, 'duplicate', false, 'reason', 'limit_reached',
    'five_hour_used', v_use5, 'weekly_used', v_use7,
    'five_hour_limit', v_lim5, 'weekly_limit', v_lim7,
    'next_available_at', v_next);
end;
$$;

-- Settle a reservation. 'completed' counts the request exactly once;
-- 'released' deletes it so failures, cancels, and interruptions never
-- consume usage. Unknown keys and repeats are safe no-ops.
create or replace function public.finalize_chat_usage(
  p_operation_key text,
  p_outcome text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if p_outcome not in ('completed', 'released') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_outcome');
  end if;
  select status into v_status from public.chat_usage_records
    where operation_key = p_operation_key;
  if not found then
    return jsonb_build_object('ok', true, 'reason', 'unknown_key_noop');
  end if;
  if p_outcome = 'completed' then
    if v_status = 'completed' then
      return jsonb_build_object('ok', true, 'reason', 'already_completed');
    end if;
    update public.chat_usage_records
      set status = 'completed', expires_at = null
      where operation_key = p_operation_key;
    return jsonb_build_object('ok', true, 'reason', 'completed');
  end if;
  delete from public.chat_usage_records where operation_key = p_operation_key;
  return jsonb_build_object('ok', true, 'reason', 'released');
end;
$$;

grant execute on function public.reserve_chat_usage(uuid, text, uuid, text, text, text, integer) to service_role;
grant execute on function public.finalize_chat_usage(text, text) to service_role;
