-- Add black-forest-labs/flux-2-dev model: Flux 2 Dev (Replicate)
-- Quality image generation and editing with support for reference images
-- Source: https://replicate.com/black-forest-labs/flux-2-dev

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
  'black-forest-labs/flux-2-dev',
  'Flux 2 Dev',
  'Quality image generation and editing with support for reference images. Text-to-image and image-to-image.',
  'image',
  'replicate',
  true,
  2,
  '{
    "parameters": [
      {
        "name": "go_fast",
        "type": "boolean",
        "label": "Go Fast",
        "description": "Run faster predictions with additional optimizations.",
        "required": false,
        "default": true,
        "ui_type": "switch"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Aspect ratio for the generated image. Use match_input_image to match the first input image.",
        "required": false,
        "default": "1:1",
        "enum": ["match_input_image", "custom", "1:1", "16:9", "3:2", "2:3", "4:5", "5:4", "9:16", "3:4", "4:3"],
        "ui_type": "select"
      },
      {
        "name": "width",
        "type": "number",
        "label": "Width",
        "description": "Width (text-to-image, aspect_ratio=custom). Multiple of 32, 256-1440.",
        "required": false,
        "default": null,
        "min": 256,
        "max": 1440,
        "ui_type": "number"
      },
      {
        "name": "height",
        "type": "number",
        "label": "Height",
        "description": "Height (text-to-image, aspect_ratio=custom). Multiple of 32, 256-1440.",
        "required": false,
        "default": null,
        "min": 256,
        "max": 1440,
        "ui_type": "number"
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
        "name": "output_format",
        "type": "string",
        "label": "Output Format",
        "description": "Format of the output images.",
        "required": false,
        "default": "webp",
        "enum": ["webp", "jpg", "png"],
        "ui_type": "select"
      },
      {
        "name": "output_quality",
        "type": "number",
        "label": "Output Quality",
        "description": "Quality when saving the output images, 0-100. Not relevant for .png.",
        "required": false,
        "default": 80,
        "min": 0,
        "max": 100,
        "ui_type": "slider"
      },
      {
        "name": "disable_safety_checker",
        "type": "boolean",
        "label": "Disable Safety Checker",
        "description": "Disable safety checker for generated images.",
        "required": false,
        "default": false,
        "ui_type": "switch"
      }
    ]
  }'::jsonb,
  ARRAY['match_input_image', '1:1', '16:9', '3:2', '2:3', '4:5', '5:4', '9:16', '3:4', '4:3'],
  '1:1',
  true,
  5
);
