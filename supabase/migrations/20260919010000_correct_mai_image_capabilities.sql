begin;

-- The verified MAI text-to-image contract accepts prompt and dimensions only.
-- Keep the model's existing pricing, visibility, route and presentation intact.
update public.model_runtime_configs
set capabilities = jsonb_set(
      jsonb_set(coalesce(capabilities, '{}'::jsonb), '{referenceImage}', 'false'::jsonb, true),
      '{negativePrompt}',
      'false'::jsonb,
      true
    ),
    updated_at = now()
where model_key = 'vantra:image:mai-image-2.6-flash';

commit;
