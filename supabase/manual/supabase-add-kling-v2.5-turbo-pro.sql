-- ============================================================================
-- Add Kling 2.5 Turbo Pro to Supabase
-- ============================================================================
-- Source: https://replicate.com/kwaivgi/kling-v2.5-turbo-pro
-- Text-to-video and image-to-video; priced ~$0.07/sec on Replicate (tune model_cost / credits to match your app).
--
-- INSTRUCTIONS:
-- 1. Supabase Dashboard → SQL Editor → New query
-- 2. Paste and Run
--
-- Schema reference: https://replicate.com/kwaivgi/kling-v2.5-turbo-pro/llms.txt
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
  'kwaivgi/kling-v2.5-turbo-pro',
  'Kling 2.5 Turbo Pro',
  'Fast text-to-video and image-to-video with smooth motion, strong prompt adherence, and cinematic depth. Use start image for I2V; aspect ratio applies when no start image.',
  'video',
  'replicate',
  true,
  0.035,
  '{
    "parameters": [
      {
        "name": "duration",
        "type": "number",
        "label": "Duration",
        "description": "Video length in seconds",
        "required": false,
        "default": 5,
        "min": 5,
        "max": 10,
        "ui_type": "number"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Ignored when a start image is provided (follows the image).",
        "required": false,
        "default": "16:9",
        "enum": ["16:9", "9:16", "1:1"],
        "ui_type": "select"
      },
      {
        "name": "negative_prompt",
        "type": "string",
        "label": "Negative Prompt",
        "description": "What to exclude from the video",
        "required": false,
        "default": null,
        "ui_type": "textarea"
      },
      {
        "name": "guidance_scale",
        "type": "number",
        "label": "Guidance Scale",
        "description": "How strongly the model follows the prompt (Replicate examples use 0.5).",
        "required": false,
        "default": 0.5,
        "min": 0,
        "max": 2,
        "step": 0.05,
        "ui_type": "slider"
      }
    ]
  }'::jsonb,
  ARRAY['16:9', '9:16', '1:1'],
  '16:9',
  false,
  false,
  true,
  true,
  ARRAY[5, 10]::INTEGER[],
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

-- SELECT identifier, name, type, supports_first_frame, supports_last_frame, duration_options
-- FROM public.models WHERE identifier = 'kwaivgi/kling-v2.5-turbo-pro';
