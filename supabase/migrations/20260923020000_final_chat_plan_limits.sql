-- Final rolling weighted Chat limits. Historical usage and reservations are unchanged.
begin;

insert into public.chat_plan_limits (
  plan_code, five_hour_limit, weekly_limit, fallback_enabled
)
values
  ('free', 120, 800, false),
  ('lite', 240, 1600, false),
  ('pro', 600, 4000, false),
  ('max', 1200, 8000, false)
on conflict (plan_code) do update set
  five_hour_limit = excluded.five_hour_limit,
  weekly_limit = excluded.weekly_limit,
  updated_at = now();

commit;
