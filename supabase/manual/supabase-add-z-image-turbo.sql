-- Add prunaai/z-image-turbo model for testing DB-driven model flow
-- Source: https://replicate.com/prunaai/z-image-turbo

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
  'prunaai/z-image-turbo',
  'Z-Image Turbo',
  'Super fast text-to-image model of 6B parameters developed by Tongyi-MAI',
  'image',
  'replicate',
  true,
  1,
  '{
    "parameters": [
      {
        "name": "width",
        "type": "number",
        "label": "Width",
        "description": "Width of the generated image.",
        "required": false,
        "default": 1024,
        "min": 64,
        "max": 2048,
        "ui_type": "number"
      },
      {
        "name": "height",
        "type": "number",
        "label": "Height",
        "description": "Height of the generated image.",
        "required": false,
        "default": 1024,
        "min": 64,
        "max": 2048,
        "ui_type": "number"
      },
      {
        "name": "num_inference_steps",
        "type": "number",
        "label": "Inference Steps",
        "description": "Number of inference steps.",
        "required": false,
        "default": 8,
        "min": 1,
        "max": 50,
        "ui_type": "number"
      },
      {
        "name": "guidance_scale",
        "type": "number",
        "label": "Guidance Scale",
        "description": "Guidance scale. Should be 0 for Turbo models.",
        "required": false,
        "default": 0,
        "min": 0,
        "max": 20,
        "ui_type": "slider"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "description": "Random seed. Set for reproducible generation.",
        "required": false,
        "default": null,
        "min": 0,
        "max": 2147483647,
        "ui_type": "number"
      },
      {
        "name": "go_fast",
        "type": "boolean",
        "label": "Go Fast",
        "description": "Apply additional optimizations for faster generation.",
        "required": false,
        "default": false,
        "ui_type": "switch"
      },
      {
        "name": "output_format",
        "type": "string",
        "label": "Output Format",
        "description": "Format of the output images.",
        "required": false,
        "default": "jpg",
        "enum": ["png", "jpg", "webp"],
        "ui_type": "select"
      },
      {
        "name": "output_quality",
        "type": "number",
        "label": "Output Quality",
        "description": "Quality when saving the output images, from 0 to 100. Not relevant for .png outputs.",
        "required": false,
        "default": 80,
        "min": 0,
        "max": 100,
        "ui_type": "slider"
      }
    ]
  }'::jsonb,
  ARRAY['1:1', '16:9', '9:16', '4:3', '3:4'],
  '1:1',
  false,
  false,
  false,
  false,
  NULL,
  1
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
