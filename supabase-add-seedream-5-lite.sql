-- Add Seedream 5.0 lite model to models table
-- Run this in Supabase SQL Editor or via: supabase db execute -f supabase-add-seedream-5-lite.sql
-- Model: https://replicate.com/bytedance/seedream-5-lite

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
  max_images
) VALUES (
  'bytedance/seedream-5-lite',
  'Seedream 5.0 lite',
  'ByteDance''s image generation model with built-in reasoning, example-based editing, and deep domain knowledge. Generate up to 3K resolution images, edit with reference examples, and create batch image sets.',
  'image',
  'replicate',
  true,
  2,
  '{
    "parameters": [
      {
        "name": "size",
        "type": "string",
        "label": "Size",
        "description": "Pre-set image resolution (2K up to 2048px, 3K up to 3072px)",
        "required": false,
        "default": "2K",
        "enum": ["2K", "3K"],
        "ui_type": "select"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Output aspect ratio",
        "required": false,
        "default": "1:1",
        "enum": ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"],
        "ui_type": "select"
      },
      {
        "name": "sequential_image_generation",
        "type": "string",
        "label": "Sequential Image Generation",
        "description": "Generate sets of related images (storyboards, character sheets) in one request",
        "required": false,
        "default": "disabled",
        "enum": ["disabled", "auto"],
        "ui_type": "select"
      },
      {
        "name": "max_images",
        "type": "number",
        "label": "Max Images",
        "description": "Max images when sequential mode enabled",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 14,
        "ui_type": "number"
      },
      {
        "name": "num_images",
        "type": "number",
        "label": "Number of Images",
        "description": "Number of separate generations",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 10,
        "ui_type": "number"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "description": "Random seed to reproduce results",
        "required": false,
        "default": null,
        "min": 0,
        "max": 2147483647,
        "ui_type": "number"
      }
    ]
  }'::jsonb,
  ARRAY['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'],
  '1:1',
  true,
  14
)
ON CONFLICT (identifier) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  parameters = EXCLUDED.parameters,
  aspect_ratios = EXCLUDED.aspect_ratios,
  default_aspect_ratio = EXCLUDED.default_aspect_ratio,
  supports_reference_image = EXCLUDED.supports_reference_image,
  max_images = EXCLUDED.max_images,
  updated_at = now();
