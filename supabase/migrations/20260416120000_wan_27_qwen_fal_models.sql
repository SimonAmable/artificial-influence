-- Wan 2.7 unified (Replicate T2V + I2V routing) + Fal columns for async Qwen Image 2
-- https://replicate.com/wan-video/wan-2.7-t2v / https://replicate.com/wan-video/wan-2.7-i2v
-- https://fal.ai/models/fal-ai/qwen-image-2/text-to-image / edit

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS fal_request_id text,
  ADD COLUMN IF NOT EXISTS fal_endpoint_id text;

COMMENT ON COLUMN public.generations.fal_request_id IS 'Fal queue request_id when using Fal async; also duplicated in replicate_prediction_id for client polling compatibility';
COMMENT ON COLUMN public.generations.fal_endpoint_id IS 'Full Fal endpoint id for queue.status / queue.result';

-- Video: Wan 2.7 (single UI id; API routes to wan-2.7-t2v vs wan-2.7-i2v)
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
  supports_reference_audio,
  supports_first_frame,
  supports_last_frame,
  duration_options,
  max_images
) VALUES (
  'wan-video/wan-2.7',
  'Wan 2.7',
  'Alibaba Wan 2.7: text-to-video, or add a first frame for image-to-video (optional last frame and audio). Same model in the UI; backend uses Replicate wan-2.7-t2v or wan-2.7-i2v.',
  'video',
  'replicate',
  true,
  15,
  '{
    "parameters": [
      {
        "name": "resolution",
        "type": "string",
        "label": "Resolution",
        "required": false,
        "default": "1080p",
        "enum": ["720p", "1080p"],
        "ui_type": "select"
      },
      {
        "name": "duration",
        "type": "number",
        "label": "Duration (seconds)",
        "description": "2–15 seconds",
        "required": false,
        "default": 5,
        "min": 2,
        "max": 15,
        "ui_type": "number"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Used for text-to-video when no first frame is set",
        "required": false,
        "default": "16:9",
        "enum": ["16:9", "9:16", "1:1", "4:3", "3:4"],
        "ui_type": "select"
      },
      {
        "name": "negative_prompt",
        "type": "string",
        "label": "Negative Prompt",
        "required": false,
        "default": null,
        "ui_type": "textarea"
      },
      {
        "name": "enable_prompt_expansion",
        "type": "boolean",
        "label": "Prompt expansion",
        "description": "LLM expands short prompts (adds latency)",
        "required": false,
        "default": true,
        "ui_type": "switch"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "required": false,
        "default": null,
        "min": 0,
        "max": 2147483647,
        "ui_type": "number"
      }
    ]
  }'::jsonb,
  ARRAY['16:9', '9:16', '1:1', '4:3', '3:4'],
  '16:9',
  true,
  false,
  true,
  true,
  true,
  ARRAY[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]::INTEGER[],
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
  supports_reference_audio = EXCLUDED.supports_reference_audio,
  supports_first_frame = EXCLUDED.supports_first_frame,
  supports_last_frame = EXCLUDED.supports_last_frame,
  duration_options = EXCLUDED.duration_options,
  max_images = EXCLUDED.max_images;

-- Image: Qwen Image 2 (unified id; API routes to fal-ai/qwen-image-2/text-to-image vs /edit)
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
  supports_reference_audio,
  supports_first_frame,
  supports_last_frame,
  duration_options,
  max_images
) VALUES (
  'fal-ai/qwen-image-2',
  'Qwen Image 2',
  'Qwen Image 2 on fal: text-to-image, or attach reference image(s) for editing (same model; backend picks text-to-image vs edit endpoint). Requires FAL_KEY.',
  'image',
  'fal',
  true,
  4,
  '{
    "parameters": [
      {
        "name": "negative_prompt",
        "type": "string",
        "label": "Negative Prompt",
        "required": false,
        "default": null,
        "ui_type": "textarea"
      },
      {
        "name": "num_images",
        "type": "number",
        "label": "Number of images",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 4,
        "ui_type": "number"
      },
      {
        "name": "output_format",
        "type": "string",
        "label": "Output format",
        "required": false,
        "default": "png",
        "enum": ["png", "jpeg", "webp"],
        "ui_type": "select"
      },
      {
        "name": "enable_prompt_expansion",
        "type": "boolean",
        "label": "Prompt expansion",
        "required": false,
        "default": true,
        "ui_type": "switch"
      },
      {
        "name": "enable_safety_checker",
        "type": "boolean",
        "label": "Safety checker",
        "required": false,
        "default": false,
        "ui_type": "switch"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "required": false,
        "default": null,
        "min": 0,
        "max": 2147483647,
        "ui_type": "number"
      },
      {
        "name": "image_size",
        "type": "string",
        "label": "Image size",
        "description": "Text-to-image preset; edit mode can use custom size in advanced flows",
        "required": false,
        "default": "square_hd",
        "enum": ["square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"],
        "ui_type": "select"
      }
    ]
  }'::jsonb,
  ARRAY['1:1', '16:9', '9:16', '4:3', '3:4'],
  '1:1',
  true,
  false,
  false,
  false,
  false,
  NULL,
  4
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
  supports_reference_audio = EXCLUDED.supports_reference_audio,
  supports_first_frame = EXCLUDED.supports_first_frame,
  supports_last_frame = EXCLUDED.supports_last_frame,
  duration_options = EXCLUDED.duration_options,
  max_images = EXCLUDED.max_images;
