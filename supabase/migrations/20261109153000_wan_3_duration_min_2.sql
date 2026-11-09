-- Wan 3.0 reference and text endpoints accept durations from 2 to 30 seconds.

UPDATE public.models
SET parameters = jsonb_set(
  parameters,
  '{parameters}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN elem->>'name' = 'duration' THEN jsonb_set(elem, '{min}', '2'::jsonb)
        ELSE elem
      END
      ORDER BY ordinality
    ), '[]'::jsonb)
    FROM jsonb_array_elements(parameters->'parameters') WITH ORDINALITY AS items(elem, ordinality)
  )
)
WHERE identifier IN ('alibaba/wan-3.0', 'alibaba/wan-3.0-prime')
  AND jsonb_typeof(parameters->'parameters') = 'array';
