-- ============================================================================
-- Add xAI Grok Imagine Video Model to Supabase
-- ============================================================================
-- Source: https://replicate.com/xai/grok-imagine-video
-- $0.05 per second of output video
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase Project Dashboard
-- 2. Navigate to SQL Editor
-- 3. Click "New Query"
-- 4. Copy and paste the SQL below
-- 5. Click "Run"
-- 6. Confirm success message
--
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
  'xai/grok-imagine-video',
  'Grok Imagine Video',
  'Generate videos using xAI''s Grok Imagine Video model. Supports text-to-video, image-to-video, and video editing.',
  'video',
  'replicate',
  true,
  0.25,
  '{
    "parameters": [
      {
        "name": "prompt",
        "type": "string",
        "label": "Prompt",
        "description": "Text prompt for video generation",
        "required": true,
        "default": null,
        "ui_type": "textarea"
      },
      {
        "name": "image",
        "type": "string",
        "label": "Input Image",
        "description": "Input image to generate video from (image-to-video). Supports jpg, jpeg, png, webp.",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "video",
        "type": "string",
        "label": "Input Video",
        "description": "Input video to edit (video editing mode). Must be a direct link, max 8.7 seconds. Supports mp4, mov, webm.",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "duration",
        "type": "number",
        "label": "Duration",
        "description": "Duration of the video in seconds (1-15). Ignored when editing a video.",
        "required": false,
        "default": 5,
        "min": 1,
        "max": 15,
        "ui_type": "number"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Aspect ratio of the video. Ignored when editing a video or when providing an input image.",
        "required": false,
        "default": "16:9",
        "enum": ["16:9", "4:3", "1:1", "9:16", "3:4", "3:2", "2:3"],
        "ui_type": "select"
      },
      {
        "name": "resolution",
        "type": "string",
        "label": "Resolution",
        "description": "Resolution of the video. Ignored when editing a video.",
        "required": false,
        "default": "720p",
        "enum": ["720p", "480p"],
        "ui_type": "select"
      }
    ]
  }'::jsonb,
  ARRAY['16:9', '4:3', '1:1', '9:16', '3:4', '3:2', '2:3'],
  '16:9',
  false,
  true,
  true,
  false,
  ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]::INTEGER[],
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

-- ============================================================================
-- NOTE: If your models table does NOT have these columns, run this minimal
-- version instead (only base columns):
-- ============================================================================
/*
INSERT INTO public.models (identifier, name, description, type, provider, is_active, model_cost, parameters)
VALUES (
  'xai/grok-imagine-video',
  'Grok Imagine Video',
  'Generate videos using xAI''s Grok Imagine Video model. Supports text-to-video, image-to-video, and video editing.',
  'video',
  'replicate',
  true,
  0.25,
  '{
    "parameters": [
      {"name": "prompt", "type": "string", "label": "Prompt", "description": "Text prompt for video generation", "required": true, "default": null, "ui_type": "textarea"},
      {"name": "image", "type": "string", "label": "Input Image", "description": "Input image for image-to-video. Supports jpg, jpeg, png, webp.", "required": false, "default": null, "ui_type": "text"},
      {"name": "video", "type": "string", "label": "Input Video", "description": "Input video for editing. Max 8.7 seconds. Supports mp4, mov, webm.", "required": false, "default": null, "ui_type": "text"},
      {"name": "duration", "type": "number", "label": "Duration", "description": "Duration in seconds (1-15). Ignored when editing.", "required": false, "default": 5, "min": 1, "max": 15, "ui_type": "number"},
      {"name": "aspect_ratio", "type": "string", "label": "Aspect Ratio", "description": "Video aspect ratio. Ignored when editing or with input image.", "required": false, "default": "16:9", "enum": ["16:9", "4:3", "1:1", "9:16", "3:4", "3:2", "2:3"], "ui_type": "select"},
      {"name": "resolution", "type": "string", "label": "Resolution", "description": "Video resolution. Ignored when editing.", "required": false, "default": "720p", "enum": ["720p", "480p"], "ui_type": "select"}
    ]
  }'::jsonb
)
ON CONFLICT (identifier) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  provider = EXCLUDED.provider,
  is_active = EXCLUDED.is_active,
  model_cost = EXCLUDED.model_cost,
  parameters = EXCLUDED.parameters,
  updated_at = timezone('utc'::text, now());
*/

-- ============================================================================
-- VERIFICATION QUERY (run after insert to confirm)
-- ============================================================================

-- SELECT * FROM public.models WHERE identifier = 'xai/grok-imagine-video';
