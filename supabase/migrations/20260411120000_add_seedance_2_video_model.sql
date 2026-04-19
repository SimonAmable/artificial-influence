-- ByteDance Seedance 2.0 (Replicate), video model, 20 credits per generation
-- https://replicate.com/bytedance/seedance-2.0

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
  'bytedance/seedance-2.0',
  'Seedance 2.0',
  'ByteDance multimodal video: text/image/video/audio references, first/last frame, native synced audio, editing and extension. See https://replicate.com/bytedance/seedance-2.0',
  'video',
  'replicate',
  true,
  20,
  '{
    "parameters": [
      {
        "name": "image",
        "type": "string",
        "label": "First Frame",
        "description": "Optional first frame for image-to-video (not combined with reference_images)",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "last_frame_image",
        "type": "string",
        "label": "Last Frame",
        "description": "Optional last frame (requires first frame; not combined with reference_images)",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "duration",
        "type": "number",
        "label": "Duration (seconds)",
        "description": "4–15 seconds, or -1 for model-chosen length",
        "required": false,
        "default": 5,
        "min": -1,
        "max": 15,
        "ui_type": "number"
      },
      {
        "name": "resolution",
        "type": "string",
        "label": "Resolution",
        "description": "Output resolution",
        "required": false,
        "default": "720p",
        "enum": ["480p", "720p"],
        "ui_type": "select"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Use adaptive to match inputs",
        "required": false,
        "default": "16:9",
        "enum": ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"],
        "ui_type": "select"
      },
      {
        "name": "generate_audio",
        "type": "boolean",
        "label": "Generate Audio",
        "description": "Synchronized dialogue, SFX, and music",
        "required": false,
        "default": true,
        "ui_type": "switch"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "description": "Optional seed for reproducibility",
        "required": false,
        "default": null,
        "min": 0,
        "max": 2147483647,
        "ui_type": "number"
      }
    ]
  }'::jsonb,
  ARRAY['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'],
  '16:9',
  true,
  true,
  false,
  false,
  ARRAY[-1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]::INTEGER[],
  9
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
