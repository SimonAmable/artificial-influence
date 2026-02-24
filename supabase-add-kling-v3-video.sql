-- ============================================================================
-- Add Kling Video 3.0 Model to Supabase
-- ============================================================================
-- Source: https://replicate.com/kwaivgi/kling-v3-video
-- Text-to-video and image-to-video, up to 15s, native audio, multi-shot.
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
  'kwaivgi/kling-v3-video',
  'Kling Video 3.0',
  'Generate cinematic videos up to 15 seconds from text or images. Native audio, lip sync, and multi-shot mode. 720p (standard) or 1080p (pro).',
  'video',
  'replicate',
  true,
  0.02,
  '{
    "parameters": [
      {
        "name": "mode",
        "type": "string",
        "label": "Mode",
        "description": "standard = 720p, pro = 1080p",
        "required": false,
        "default": "pro",
        "enum": ["standard", "pro"],
        "ui_type": "select"
      },
      {
        "name": "duration",
        "type": "number",
        "label": "Duration",
        "description": "Video duration in seconds (3–15). Total of multi-shot durations must equal this.",
        "required": false,
        "default": 5,
        "min": 3,
        "max": 15,
        "ui_type": "number"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Ignored when start image is provided.",
        "required": false,
        "default": "16:9",
        "enum": ["16:9", "9:16", "1:1"],
        "ui_type": "select"
      },
      {
        "name": "generate_audio",
        "type": "boolean",
        "label": "Generate Audio",
        "description": "Generate native audio including lip sync and sound effects",
        "required": false,
        "default": true,
        "ui_type": "switch"
      },
      {
        "name": "negative_prompt",
        "type": "string",
        "label": "Negative Prompt",
        "description": "What to exclude from the video. Max 2500 characters.",
        "required": false,
        "default": null,
        "ui_type": "textarea"
      },
      {
        "name": "multi_prompt",
        "type": "string",
        "label": "Multi-shot (JSON)",
        "description": "JSON array of shots: [{\"prompt\": \"...\", \"duration\": N}]. Max 6 shots, min 1s per shot, total = duration.",
        "required": false,
        "default": null,
        "ui_type": "textarea"
      }
    ]
  }'::jsonb,
  ARRAY['16:9', '9:16', '1:1'],
  '16:9',
  false,
  false,
  true,
  true,
  ARRAY[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]::INTEGER[],
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
-- VERIFICATION QUERY (run after insert to confirm)
-- ============================================================================

-- SELECT identifier, name, type, supports_first_frame, supports_last_frame, duration_options
-- FROM public.models WHERE identifier = 'kwaivgi/kling-v3-video';
