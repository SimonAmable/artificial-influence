-- Switch GPT Image 2 from Fal to Replicate and align defaults with the Replicate model page.
-- Source: https://replicate.com/openai/gpt-image-2

UPDATE public.models
SET
  name = 'GPT Image 2',
  description = 'Best when you want strong prompt-following from OpenAI, crisp text rendering, or guided image edits with a reference image.',
  provider = 'replicate',
  is_active = true,
  model_cost = 4,
  parameters = '{
    "replicate_input_defaults": {
      "quality": "low",
      "moderation": "low"
    },
    "parameters": [
      {
        "name": "background",
        "type": "string",
        "label": "Background",
        "description": "Background treatment. Transparent output is not supported on GPT Image 2.",
        "required": false,
        "default": "auto",
        "enum": ["auto", "opaque"],
        "ui_type": "select"
      },
      {
        "name": "moderation",
        "type": "string",
        "label": "Moderation",
        "description": "Controls content moderation level",
        "required": false,
        "default": "low",
        "enum": ["low", "auto"],
        "ui_type": "select"
      },
      {
        "name": "n",
        "type": "number",
        "label": "Number of Images",
        "description": "How many image variants to generate",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 10,
        "ui_type": "number"
      },
      {
        "name": "quality",
        "type": "string",
        "label": "Quality",
        "description": "Generation quality preset",
        "required": false,
        "default": "low",
        "enum": ["low", "medium", "high", "auto"],
        "ui_type": "select"
      },
      {
        "name": "output_format",
        "type": "string",
        "label": "Output Format",
        "description": "Image file format",
        "required": false,
        "default": "webp",
        "enum": ["webp", "png", "jpeg"],
        "ui_type": "select"
      }
    ]
  }'::jsonb,
  aspect_ratios = ARRAY['1:1', '3:2', '2:3'],
  default_aspect_ratio = '1:1',
  supports_reference_image = true,
  supports_reference_video = false,
  max_images = 10
WHERE identifier = 'openai/gpt-image-2';
