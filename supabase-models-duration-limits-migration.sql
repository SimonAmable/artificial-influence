-- =====================================================
-- Models Table: Duration & Generation Limits Migration
-- =====================================================
-- Adds duration_options, max_images, supports_first_frame, supports_last_frame
-- Run this after the base models table exists.

-- Add new columns
ALTER TABLE public.models 
  ADD COLUMN IF NOT EXISTS duration_options INTEGER[],
  ADD COLUMN IF NOT EXISTS max_images INTEGER,
  ADD COLUMN IF NOT EXISTS supports_first_frame BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_last_frame BOOLEAN DEFAULT false;

-- =====================================================
-- Video Models: duration_options
-- =====================================================

-- Kling V2.6 Pro: only 5 and 10 seconds
UPDATE public.models SET duration_options = ARRAY[5, 10]
WHERE identifier = 'kwaivgi/kling-v2.6';

-- Veo 3.1 Fast: 2-10 seconds
UPDATE public.models SET duration_options = ARRAY[2, 3, 4, 5, 6, 7, 8, 9, 10]
WHERE identifier = 'google/veo-3.1-fast';

-- Hailuo 2.3 Fast: 5-10 seconds (1080p limited to 6s - handle in UI/metadata)
UPDATE public.models SET duration_options = ARRAY[5, 6, 7, 8, 9, 10]
WHERE identifier = 'minimax/hailuo-2.3-fast';

-- Kling V2.6 Motion Control: no duration param (motion copy controls length)
-- Fabric 1.0: no duration param
-- Leave duration_options NULL for these

-- =====================================================
-- Video Models: first/last frame support
-- =====================================================

UPDATE public.models SET supports_first_frame = true
WHERE identifier IN (
  'kwaivgi/kling-v2.6-motion-control',
  'kwaivgi/kling-v2.6',
  'google/veo-3.1-fast',
  'minimax/hailuo-2.3-fast'
);

UPDATE public.models SET supports_last_frame = true
WHERE identifier = 'google/veo-3.1-fast';

-- =====================================================
-- Image Models: max_images
-- =====================================================

UPDATE public.models SET max_images = 4
WHERE identifier = 'google/nano-banana';

UPDATE public.models SET max_images = 10
WHERE identifier IN (
  'google/nano-banana-pro',
  'bytedance/seedream-4.5',
  'xai/grok-imagine-image',
  'openai/gpt-image-1.5',
  'prunaai/flux-kontext-fast'
);

-- GPT Image 1.5: up to 10
-- Seedream: up to 10
-- Grok: up to 10
-- (already covered above)
