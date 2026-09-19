begin;

-- This task connects only P-Video-2 Pro text-to-video. Pricing, routing and
-- every unrelated runtime model remain unchanged.
update public.model_runtime_configs
set capabilities = '{
  "textToVideo": true,
  "imageToVideo": false,
  "durations": [5,6,7,8,9,10,11,12,13,14,15],
  "aspectRatios": ["16:9","9:16","4:3","3:4","3:2","2:3","1:1"],
  "cameraMotions": [],
  "generatedAudio": false,
  "negativePrompt": false
}'::jsonb,
    updated_at = now()
where model_key = 'vantra:video:p-video-2-pro';

commit;
