-- ============================================================================
-- Add Kling 3.0 Motion Control Model to Supabase
-- ============================================================================
-- Source: https://replicate.com/kwaivgi/kling-v3-motion-control
-- Transfer character motion from a reference video to any character image.
-- V3: improved consistency, 720p (std) or 1080p (pro), character_orientation
--     image (max 10s) or video (max 30s).
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase Project Dashboard
-- 2. Navigate to SQL Editor
-- 3. Copy and paste the SQL below
-- 4. Click "Run"
-- ============================================================================

INSERT INTO public.models (
  identifier,
  name,
  description,
  type,
  provider,
  is_active,
  model_cost,
  parameters,
  aspect_ratios,
  default_aspect_ratio,
  supports_reference_image,
  supports_reference_video,
  supports_first_frame,
  supports_last_frame,
  duration_options,
  max_images
) VALUES (
  'kwaivgi/kling-v3-motion-control',
  'Kling 3.0 Motion Control',
  'Transfer character motion from a reference video to any image. V3: improved consistency, 720p/1080p, image (max 10s) or video orientation (max 30s).',
  'video',
  'replicate',
  true,
  0.01,
  '{
    "parameters": [
      {
        "name": "mode",
        "type": "string",
        "label": "Mode",
        "description": "std = 720p (cost-effective), pro = 1080p (higher quality)",
        "required": false,
        "default": "pro",
        "enum": ["pro", "std"],
        "ui_type": "select"
      },
      {
        "name": "keep_original_sound",
        "type": "boolean",
        "label": "Keep Original Sound",
        "description": "Preserve original audio from reference video",
        "required": false,
        "default": true,
        "ui_type": "switch"
      },
      {
        "name": "character_orientation",
        "type": "string",
        "label": "Character Orientation",
        "description": "image = same direction as picture (max 10s), video = match reference video (max 30s)",
        "required": false,
        "default": "video",
        "enum": ["image", "video"],
        "ui_type": "select"
      }
    ]
  }'::jsonb,
  ARRAY['16:9', '9:16', '1:1'],
  '16:9',
  true,
  true,
  true,
  false,
  NULL,
  NULL
)
ON CONFLICT (identifier) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  provider = EXCLUDED.provider,
  is_active = EXCLUDED.is_active,
  model_cost = EXCLUDED.model_cost,
  parameters = EXCLUDED.parameters,
  aspect_ratios = EXCLUDED.aspect_ratios,
  default_aspect_ratio = EXCLUDED.default_aspect_ratio,
  supports_reference_image = EXCLUDED.supports_reference_image,
  supports_reference_video = EXCLUDED.supports_reference_video,
  supports_first_frame = EXCLUDED.supports_first_frame,
  supports_last_frame = EXCLUDED.supports_last_frame,
  duration_options = EXCLUDED.duration_options,
  max_images = EXCLUDED.max_images,
  updated_at = timezone('utc'::text, now());

-- Ensure reference video and first frame flags (in case reference columns migration already ran)
UPDATE public.models SET supports_reference_video = true, supports_first_frame = true
WHERE identifier = 'kwaivgi/kling-v3-motion-control';

-- ============================================================================
-- VERIFICATION (optional)
-- ============================================================================
-- SELECT identifier, name, supports_reference_video, supports_first_frame FROM public.models WHERE identifier = 'kwaivgi/kling-v3-motion-control';
