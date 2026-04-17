-- Qwen Image 2: default safety checker off (matches API + Fal input defaults)
UPDATE public.models
SET parameters = jsonb_set(
  parameters,
  '{parameters}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN (elem->>'name') = 'enable_safety_checker' THEN
            jsonb_set(elem, '{default}', 'false'::jsonb, true)
          ELSE elem
        END
      )
      FROM jsonb_array_elements(parameters->'parameters') AS elem
    ),
    parameters->'parameters'
  )
)
WHERE identifier = 'fal-ai/qwen-image-2'
  AND parameters ? 'parameters';
