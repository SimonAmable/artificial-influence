ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS quoted_credits integer,
  ADD COLUMN IF NOT EXISTS predicted_duration_seconds numeric;

COMMENT ON COLUMN public.generations.quoted_credits IS 'Video quote computed at request time. Deducted only if generation succeeds.';
COMMENT ON COLUMN public.generations.predicted_duration_seconds IS 'Predicted output duration used to compute the request-time video quote.';

UPDATE public.models
SET
  model_cost_per_second = CASE identifier
    WHEN 'google/veo-3.1-fast' THEN 6.00
    WHEN 'kwaivgi/kling-v2.5-turbo-pro' THEN 3.00
    WHEN 'kwaivgi/kling-v2.6' THEN 6.00
    WHEN 'kwaivgi/kling-v2.6-motion-control' THEN 5.00
    WHEN 'kwaivgi/kling-v3-video' THEN 14.00
    WHEN 'kwaivgi/kling-v3-omni-video' THEN 14.00
    WHEN 'kwaivgi/kling-v3-motion-control' THEN 7.00
    WHEN 'minimax/hailuo-2.3-fast' THEN 1.20
    WHEN 'bytedance/seedance-2.0' THEN 12.00
    WHEN 'wan-video/wan-2.7' THEN 4.00
    WHEN 'xai/grok-imagine-video' THEN 3.00
    WHEN 'veed/fabric-1.0' THEN 6.00
    WHEN 'alibaba/happy-horse' THEN 12.00
    WHEN 'alibaba/happy-horse/text-to-video' THEN 12.00
    WHEN 'alibaba/happy-horse/image-to-video' THEN 12.00
    WHEN 'alibaba/happy-horse/reference-to-video' THEN 12.00
    ELSE model_cost_per_second
  END,
  updated_at = now()
WHERE type = 'video'
  AND identifier IN (
    'google/veo-3.1-fast',
    'kwaivgi/kling-v2.5-turbo-pro',
    'kwaivgi/kling-v2.6',
    'kwaivgi/kling-v2.6-motion-control',
    'kwaivgi/kling-v3-video',
    'kwaivgi/kling-v3-omni-video',
    'kwaivgi/kling-v3-motion-control',
    'minimax/hailuo-2.3-fast',
    'bytedance/seedance-2.0',
    'wan-video/wan-2.7',
    'xai/grok-imagine-video',
    'veed/fabric-1.0',
    'alibaba/happy-horse',
    'alibaba/happy-horse/text-to-video',
    'alibaba/happy-horse/image-to-video',
    'alibaba/happy-horse/reference-to-video'
  );
