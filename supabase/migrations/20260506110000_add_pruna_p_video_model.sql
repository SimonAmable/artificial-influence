-- Pruna AI P-Video (Replicate), unified text/image/audio-conditioned video model
-- https://replicate.com/prunaai/p-video

INSERT INTO public.models (
  identifier,
  name,
  description,
  type,
  provider,
  is_active,
  model_cost,
  model_cost_per_second,
  parameters,
  aspect_ratios,
  default_aspect_ratio,
  supports_reference_image,
  supports_reference_video,
  supports_reference_audio,
  supports_first_frame,
  supports_last_frame,
  duration_options,
  max_images
) VALUES (
  'prunaai/p-video',
  'P-Video',
  'Pruna AI unified video model for text-to-video, image-to-video, and audio-conditioned video generation. See https://replicate.com/prunaai/p-video',
  'video',
  'replicate',
  true,
  10,
  2,
  '{
    "parameters": [
      {
        "name": "image",
        "type": "string",
        "label": "Input Image",
        "description": "Optional input image for image-to-video generation",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "audio",
        "type": "string",
        "label": "Input Audio",
        "description": "Optional audio clip to condition motion and timing",
        "required": false,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "duration",
        "type": "number",
        "label": "Duration",
        "description": "Video duration in seconds (1-10). Ignored when audio is provided.",
        "required": false,
        "default": 5,
        "min": 1,
        "max": 10,
        "ui_type": "number"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Ignored when an input image is provided",
        "required": false,
        "default": "16:9",
        "enum": ["16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "1:1"],
        "ui_type": "select"
      },
      {
        "name": "resolution",
        "type": "string",
        "label": "Resolution",
        "description": "Output video resolution",
        "required": false,
        "default": "720p",
        "enum": ["720p", "1080p"],
        "ui_type": "select"
      },
      {
        "name": "fps",
        "type": "number",
        "label": "FPS",
        "description": "Frames per second of the output video",
        "required": false,
        "default": 24,
        "enum": [24, 48],
        "ui_type": "select"
      },
      {
        "name": "draft",
        "type": "boolean",
        "label": "Draft Mode",
        "description": "Faster lower-quality preview mode",
        "required": false,
        "default": false,
        "ui_type": "switch"
      },
      {
        "name": "prompt_upsampling",
        "type": "boolean",
        "label": "Prompt Upsampling",
        "description": "Automatically enhance the prompt before generation",
        "required": false,
        "default": true,
        "ui_type": "switch"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "description": "Random seed for reproducibility",
        "required": false,
        "default": null,
        "min": 0,
        "max": 2147483647,
        "ui_type": "number"
      }
    ]
  }'::jsonb,
  ARRAY['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1'],
  '16:9',
  true,
  false,
  true,
  true,
  false,
  ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]::INTEGER[],
  NULL
)
ON CONFLICT (identifier) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  provider = EXCLUDED.provider,
  is_active = EXCLUDED.is_active,
  model_cost = EXCLUDED.model_cost,
  model_cost_per_second = EXCLUDED.model_cost_per_second,
  parameters = EXCLUDED.parameters,
  aspect_ratios = EXCLUDED.aspect_ratios,
  default_aspect_ratio = EXCLUDED.default_aspect_ratio,
  supports_reference_image = EXCLUDED.supports_reference_image,
  supports_reference_video = EXCLUDED.supports_reference_video,
  supports_reference_audio = EXCLUDED.supports_reference_audio,
  supports_first_frame = EXCLUDED.supports_first_frame,
  supports_last_frame = EXCLUDED.supports_last_frame,
  duration_options = EXCLUDED.duration_options,
  max_images = EXCLUDED.max_images,
  updated_at = timezone('utc'::text, now());
