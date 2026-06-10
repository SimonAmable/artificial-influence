-- Use the least restrictive model-level moderation setting exposed by each provider.
-- Provider/platform policy enforcement can still reject requests independently.

UPDATE public.models AS model
SET parameters = jsonb_set(
  model.parameters,
  '{parameters}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN elem->>'name' = 'enable_safety_checker'
          THEN jsonb_set(elem, '{default}', 'false'::jsonb, true)
        WHEN elem->>'name' = 'disable_safety_checker'
          THEN jsonb_set(elem, '{default}', 'true'::jsonb, true)
        WHEN elem->>'name' = 'moderation'
          THEN jsonb_set(elem, '{default}', '"low"'::jsonb, true)
        WHEN elem->>'name' = 'safety_filter_level'
          THEN jsonb_set(elem, '{default}', '"block_only_high"'::jsonb, true)
        ELSE elem
      END
    )
    FROM jsonb_array_elements(COALESCE(model.parameters->'parameters', '[]'::jsonb)) AS elem
  ),
  true
)
WHERE jsonb_typeof(model.parameters->'parameters') = 'array';

UPDATE public.models AS model
SET parameters = jsonb_set(
  model.parameters,
  '{parameters}',
  COALESCE(model.parameters->'parameters', '[]'::jsonb) ||
    jsonb_build_array(
      jsonb_build_object(
        'name', 'enable_safety_checker',
        'type', 'boolean',
        'label', 'Safety checker',
        'description', 'Enable content moderation for input and output.',
        'required', false,
        'default', false,
        'ui_type', 'switch'
      )
    ),
  true
)
WHERE model.identifier IN (
  'fal-ai/qwen-image-2',
  'fal-ai/wan/v2.7',
  'fal-ai/wan/v2.7/pro',
  'alibaba/happy-horse'
)
AND NOT EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE(model.parameters->'parameters', '[]'::jsonb)) AS elem
  WHERE elem->>'name' = 'enable_safety_checker'
);

UPDATE public.models
SET parameters = jsonb_set(
  parameters,
  '{replicate_input_defaults}',
  COALESCE(parameters->'replicate_input_defaults', '{}'::jsonb) ||
    CASE identifier
      WHEN 'black-forest-labs/flux-2-dev' THEN '{"disable_safety_checker": true}'::jsonb
      WHEN 'prunaai/p-image-upscale' THEN '{"disable_safety_checker": true}'::jsonb
      WHEN 'qwen/qwen-image-edit-plus-lora' THEN '{"disable_safety_checker": true}'::jsonb
      WHEN 'prunaai/p-video' THEN '{"disable_safety_filter": true}'::jsonb
      WHEN 'openai/gpt-image-1.5' THEN '{"moderation": "low"}'::jsonb
      WHEN 'google/nano-banana-pro' THEN '{"safety_filter_level": "block_only_high"}'::jsonb
      ELSE '{}'::jsonb
    END,
  true
)
WHERE identifier IN (
  'black-forest-labs/flux-2-dev',
  'prunaai/p-image-upscale',
  'qwen/qwen-image-edit-plus-lora',
  'prunaai/p-video',
  'openai/gpt-image-1.5',
  'google/nano-banana-pro'
);

-- Nano Banana 2 no longer exposes safety_filter_level in its current Replicate schema.
UPDATE public.models AS model
SET parameters = jsonb_set(
  model.parameters,
  '{parameters}',
  (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(model.parameters->'parameters', '[]'::jsonb)) AS elem
    WHERE elem->>'name' <> 'safety_filter_level'
  ),
  true
)
WHERE model.identifier = 'google/nano-banana-2';
