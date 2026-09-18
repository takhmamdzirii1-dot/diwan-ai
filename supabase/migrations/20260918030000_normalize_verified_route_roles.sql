-- Orca is currently the only verified active route for this stable model.
-- Keep it primary until another route is deliberately enabled ahead of it.

begin;

update public.model_provider_routes
set fallback = false,
    priority = 10
where model_key = 'vantra:chat:glm-5.3-flash'
  and provider_id = 'orca_router'
  and provider_model_id = 'z-ai/glm-5.3-flash-free';

commit;
