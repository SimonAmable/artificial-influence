-- Seed quality-based pricing_config for image and video models.

-- Image models: tiered_per_output
UPDATE public.models
SET
  pricing_config = '{
    "strategy": "tiered_per_output",
    "defaultCredits": 4,
    "dimensions": [
      {
        "parameter": "quality",
        "values": { "low": 2, "medium": 4, "high": 8 }
      }
    ]
  }'::jsonb,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'openai/gpt-image-2';

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "tiered_per_output",
    "defaultCredits": 4,
    "dimensions": [
      {
        "parameter": "quality",
        "values": { "low": 2, "medium": 4, "high": 6, "auto": 4 }
      }
    ]
  }'::jsonb,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'openai/gpt-image-1.5';

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "tiered_per_output",
    "defaultCredits": 4,
    "dimensions": [
      {
        "parameter": "resolution",
        "values": { "1k": 4, "2k": 6, "4k": 10 }
      }
    ]
  }'::jsonb,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'google/nano-banana-pro';

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "tiered_per_output",
    "defaultCredits": 4,
    "dimensions": [
      {
        "parameter": "resolution",
        "values": { "512": 2, "1k": 3, "2k": 5, "4k": 8 }
      }
    ]
  }'::jsonb,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'google/nano-banana-2';

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "tiered_per_output",
    "defaultCredits": 7,
    "dimensions": [
      {
        "parameter": "resolution",
        "values": { "1k": 5, "2k": 7 }
      }
    ]
  }'::jsonb,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'xai/grok-imagine-image-quality';

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "tiered_per_output",
    "defaultCredits": 4,
    "dimensions": [
      {
        "parameter": "size",
        "values": { "2k": 4, "3k": 6, "4k": 8 }
      }
    ]
  }'::jsonb,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'bytedance/seedream-4.5';

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "tiered_per_output",
    "defaultCredits": 4,
    "dimensions": [
      {
        "parameter": "size",
        "values": { "2k": 3, "3k": 5 }
      }
    ]
  }'::jsonb,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'bytedance/seedream-5-lite';

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "tiered_per_output",
    "defaultCredits": 6,
    "dimensions": [
      {
        "parameter": "size",
        "values": { "2k": 6 }
      }
    ]
  }'::jsonb,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'bytedance/seedream-5-pro';

-- Flat fallback for remaining image models using current model_cost
UPDATE public.models
SET
  pricing_config = jsonb_build_object(
    'strategy', 'flat_per_output',
    'credits', GREATEST(1, COALESCE(model_cost, 1))
  ),
  updated_at = timezone('utc'::text, now())
WHERE type = 'image'
  AND pricing_config IS NULL;

-- Video models: per_second tiers
UPDATE public.models
SET
  pricing_config = '{
    "strategy": "per_second",
    "defaultCreditsPerSecond": 6,
    "tiers": [
      { "match": { "generate_audio": false }, "creditsPerSecond": 4 },
      { "match": { "generate_audio": true }, "creditsPerSecond": 6 }
    ]
  }'::jsonb,
  model_cost_per_second = 6,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'google/veo-3.1-fast';

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "per_second",
    "defaultCreditsPerSecond": 6,
    "tiers": [
      { "match": { "generate_audio": false }, "creditsPerSecond": 3 },
      { "match": { "generate_audio": true }, "creditsPerSecond": 6 }
    ]
  }'::jsonb,
  model_cost_per_second = 6,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'kwaivgi/kling-v2.6';

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "per_second",
    "defaultCreditsPerSecond": 5,
    "tiers": [
      { "match": { "mode": "std" }, "creditsPerSecond": 3 },
      { "match": { "mode": "pro" }, "creditsPerSecond": 5 }
    ]
  }'::jsonb,
  model_cost_per_second = 5,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'kwaivgi/kling-v2.6-motion-control';

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "per_second",
    "defaultCreditsPerSecond": 7,
    "tiers": [
      { "match": { "mode": "std" }, "creditsPerSecond": 6 },
      { "match": { "mode": "pro" }, "creditsPerSecond": 7 }
    ]
  }'::jsonb,
  model_cost_per_second = 7,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'kwaivgi/kling-v3-motion-control';

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "per_second",
    "defaultCreditsPerSecond": 10,
    "tiers": [
      { "match": { "mode": "standard", "generate_audio": false }, "creditsPerSecond": 7 },
      { "match": { "mode": "standard", "generate_audio": true }, "creditsPerSecond": 11 },
      { "match": { "mode": "pro", "generate_audio": false }, "creditsPerSecond": 10 },
      { "match": { "mode": "pro", "generate_audio": true }, "creditsPerSecond": 14 }
    ]
  }'::jsonb,
  model_cost_per_second = 10,
  updated_at = timezone('utc'::text, now())
WHERE identifier IN ('kwaivgi/kling-v3-video', 'kwaivgi/kling-v3-omni-video');

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "per_second",
    "defaultCreditsPerSecond": 12,
    "tiers": [
      { "match": { "resolution": "720p" }, "creditsPerSecond": 6 },
      { "match": { "resolution": "1080p" }, "creditsPerSecond": 12 }
    ]
  }'::jsonb,
  model_cost_per_second = 12,
  updated_at = timezone('utc'::text, now())
WHERE identifier IN ('alibaba/happy-horse', 'alibaba/happy-horse/v1.1');

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "per_second",
    "defaultCreditsPerSecond": 10,
    "tiers": []
  }'::jsonb,
  model_cost_per_second = 10,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'google/gemini-omni-flash';

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "per_second",
    "defaultCreditsPerSecond": 6,
    "tiers": [
      { "match": { "resolution": "480p" }, "creditsPerSecond": 4 },
      { "match": { "resolution": "720p" }, "creditsPerSecond": 6 }
    ]
  }'::jsonb,
  model_cost_per_second = 6,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'veed/fabric-1.0';

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "per_second",
    "defaultCreditsPerSecond": 3,
    "tiers": [
      { "match": { "resolution": "480p" }, "creditsPerSecond": 2 },
      { "match": { "resolution": "720p" }, "creditsPerSecond": 3 }
    ]
  }'::jsonb,
  model_cost_per_second = 3,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'xai/grok-imagine-video';

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "per_second",
    "defaultCreditsPerSecond": 5,
    "tiers": [
      { "match": { "resolution": "480p" }, "creditsPerSecond": 3 },
      { "match": { "resolution": "720p" }, "creditsPerSecond": 5 }
    ]
  }'::jsonb,
  model_cost_per_second = 5,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'xai/grok-imagine-video-1.5';

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "per_second",
    "defaultCreditsPerSecond": 1.2,
    "tiers": [
      { "match": { "resolution": "768p" }, "creditsPerSecond": 1.2 },
      { "match": { "resolution": "1080p" }, "creditsPerSecond": 2.2 }
    ]
  }'::jsonb,
  model_cost_per_second = 1.2,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'minimax/hailuo-2.3-fast';

UPDATE public.models
SET
  pricing_config = '{
    "strategy": "per_second",
    "defaultCreditsPerSecond": 2,
    "tiers": [
      { "match": { "resolution": "720p", "draft": false }, "creditsPerSecond": 2 },
      { "match": { "resolution": "720p", "draft": true }, "creditsPerSecond": 0.5 },
      { "match": { "resolution": "1080p", "draft": false }, "creditsPerSecond": 4 },
      { "match": { "resolution": "1080p", "draft": true }, "creditsPerSecond": 1 }
    ]
  }'::jsonb,
  model_cost_per_second = 2,
  updated_at = timezone('utc'::text, now())
WHERE identifier = 'prunaai/p-video';

-- Remaining video models: flat per-second from model_cost_per_second or model_cost
UPDATE public.models
SET
  pricing_config = jsonb_build_object(
    'strategy', 'per_second',
    'defaultCreditsPerSecond', GREATEST(0.1, COALESCE(model_cost_per_second, model_cost, 10)),
    'tiers', '[]'::jsonb
  ),
  updated_at = timezone('utc'::text, now())
WHERE type = 'video'
  AND pricing_config IS NULL;
