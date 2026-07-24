-- Seedream 5.0 Pro supports Fal auto_1K in addition to auto_2K.

UPDATE public.models
SET
  parameters = jsonb_set(
    parameters,
    '{parameters}',
    (
      SELECT jsonb_agg(
        CASE
          WHEN elem->>'name' = 'size' THEN
            jsonb_set(
              jsonb_set(
                jsonb_set(elem, '{enum}', '["1K", "2K"]'::jsonb),
                '{description}',
                '"Fal auto resolution preset (1K / 2K)."'::jsonb
              ),
              '{default}',
              '"2K"'::jsonb
            )
          ELSE elem
        END
      )
      FROM jsonb_array_elements(parameters->'parameters') AS elem
    )
  ),
  pricing_config = '{
    "strategy": "tiered_per_output",
    "defaultCredits": 6,
    "dimensions": [
      {
        "parameter": "size",
        "values": { "1k": 4, "2k": 6 }
      }
    ]
  }'::jsonb,
  agent_usage = jsonb_set(
    COALESCE(agent_usage, '{}'::jsonb),
    '{inputSemantics,size}',
    '"1K or 2K Fal auto resolution preset."'::jsonb
  ),
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'bytedance/seedream-5-pro';
