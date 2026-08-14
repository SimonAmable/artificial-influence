-- MiniMax H3: always disable the safety checker and drop seed from the toolbar.

UPDATE public.models
SET
  parameters = jsonb_set(
    parameters,
    '{parameters}',
    COALESCE(
      (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(parameters -> 'parameters') AS elem
        WHERE elem ->> 'name' NOT IN ('enable_safety_checker', 'seed')
      ),
      '[]'::jsonb
    )
  ),
  updated_at = now()
WHERE identifier = 'minimax/h3';
