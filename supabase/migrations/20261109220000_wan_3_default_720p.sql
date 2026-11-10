-- Wan 3.0 and Wan 3.0 Prime open at 720p. 1080p stays available.

UPDATE public.models
SET
  model_cost = 8,
  model_cost_per_second = 8,
  pricing_config = jsonb_set(
    COALESCE(pricing_config, '{}'::jsonb),
    '{defaultCreditsPerSecond}',
    '8'::jsonb
  ),
  parameters = jsonb_set(
    parameters,
    '{parameters}',
    (
      SELECT COALESCE(jsonb_agg(
        CASE
          WHEN elem->>'name' = 'resolution' THEN jsonb_set(elem, '{default}', '"720p"'::jsonb)
          ELSE elem
        END
        ORDER BY ordinality
      ), '[]'::jsonb)
      FROM jsonb_array_elements(parameters->'parameters') WITH ORDINALITY AS items(elem, ordinality)
    )
  ),
  updated_at = timezone('utc'::text, now())
WHERE identifier IN ('alibaba/wan-3.0', 'alibaba/wan-3.0-prime')
  AND jsonb_typeof(parameters->'parameters') = 'array';
