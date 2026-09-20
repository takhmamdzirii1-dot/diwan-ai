-- Allow authenticated customers to read only their own effective plan through
-- the existing RPC without granting direct access to the private plan catalog.

begin;

alter function public.get_user_plan_access() security definer;

revoke all on function public.get_user_plan_access() from public, anon;
grant execute on function public.get_user_plan_access() to authenticated, service_role;

commit;
