-- Add GPT Image 2 on Fal as a first-class image model in the public catalog.
-- Source model page: https://fal.ai/models/openai/gpt-image-2

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
  'openai/gpt-image-2',
  'GPT Image 2',
  'Best when you want strong prompt-following from OpenAI, clean text-to-image output, or guided image-to-image edits with a reference image.',
  'image',
  'fal',
  true,
  4,
  '{
    "parameters": [
      {
        "name": "quality",
        "type": "string",
        "label": "Quality",
        "description": "Generation quality preset",
        "required": false,
        "default": "high",
        "enum": ["low", "medium", "high"],
        "ui_type": "select"
      },
      {
        "name": "num_images",
        "type": "number",
        "label": "Number of Images",
        "description": "How many image variants to generate",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 4,
        "ui_type": "number"
      },
      {
        "name": "output_format",
        "type": "string",
        "label": "Output Format",
        "description": "Image file format",
        "required": false,
        "default": "png",
        "enum": ["png", "jpeg", "webp"],
        "ui_type": "select"
      },
      {
        "name": "image_size",
        "type": "string",
        "label": "Image Size",
        "description": "Preset output image size",
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
