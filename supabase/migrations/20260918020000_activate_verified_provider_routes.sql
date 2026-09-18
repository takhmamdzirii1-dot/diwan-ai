-- Activate only provider routes verified against the configured production
-- accounts on 2026-09-18. Customer model availability remains fail-closed:
-- runtime models stay disabled, hidden and without a customer credit price.

begin;

update public.provider_runtime_configs
set enabled = true
where provider_id in ('orca_router', 'agnes', 'pruna_ai');

update public.provider_runtime_configs
set enabled = false
where provider_id = 'microsoft_foundry';

update public.model_provider_routes
set enabled = true
where (provider_id, provider_model_id) in (
  ('orca_router', 'z-ai/glm-5.3-flash-free'),
  ('orca_router', 'tencent/hy3-free'),
  ('orca_router', 'deepseek/deepseek-v4-flash-free'),
  ('agnes', 'agnes-3.0-flash')
);

-- This account exposed stealth/union-alpha-free, but its live generation
-- request returned upstream_unavailable. Keep only that route disabled.
update public.model_provider_routes
set enabled = false
where provider_id = 'orca_router'
  and provider_model_id = 'stealth/union-alpha-free';

-- Correct the previously registered draft IDs to the exact live API IDs.
update public.model_provider_routes
set provider_model_id = 'agnes-2.5-flash',
    enabled = true,
    priority = 20,
    fallback = true
where model_key = 'vantra:chat:agnes-3.0-flash'
  and provider_id = 'agnes'
  and provider_model_id = 'agnes-2.5';

update public.model_provider_routes
set provider_model_id = 'p-video-2-pro',
    enabled = true
where model_key = 'vantra:video:p-video-2-pro'
  and provider_id = 'pruna_ai'
  and provider_model_id = 'P-Video-2-Pro';

-- A 404 from the configured Foundry endpoint proves that the deployment is
-- not currently available. Preserve its route for later activation.
update public.model_provider_routes
set enabled = false
where provider_id = 'microsoft_foundry'
  and model_key = 'vantra:image:mai-image-2.6-flash';

-- Route activation never opts customers into a model or a price.
update public.model_runtime_configs
set enabled = false,
    customer_credit_price = null,
    studio_visible = false
where model_key in (
  'vantra:chat:glm-5.3-flash',
  'vantra:chat:hy3',
  'vantra:chat:union-alpha',
  'vantra:chat:deepseek-v4-flash',
  'vantra:chat:agnes-3.0-flash',
  'vantra:image:mai-image-2.6-flash',
  'vantra:video:p-video-2-pro'
);

commit;
