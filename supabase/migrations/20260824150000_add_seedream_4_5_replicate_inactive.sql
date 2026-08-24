-- Allow the same catalog identifier on multiple providers (e.g. Seedream 4.5 on fal + Replicate).
-- Keep fal Seedream 4.5 active; add inactive Replicate standby for a later provider switch.
-- https://replicate.com/bytedance/seedream-4.5

ALTER TABLE public.models DROP CONSTRAINT IF EXISTS models_identifier_key;
DROP INDEX IF EXISTS public.models_identifier_key;

CREATE UNIQUE INDEX IF NOT EXISTS models_identifier_provider_key
  ON public.models (identifier, provider);

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
  max_images,
  pricing_config,
  agent_usage
) VALUES (
  'bytedance/seedream-4.5',
  'Seedream 4.5',
  'Seedream 4.5 on Replicate: text-to-image and multi-reference image editing with up to 4K output.',
  'image',
  'replicate',
  false,
  4,
  '{
    "parameters": [
      {
        "name": "size",
        "type": "string",
        "label": "Size",
        "description": "Image resolution: 2K (2048px), 4K (4096px), or custom for specific dimensions.",
        "required": false,
        "default": "2K",
        "enum": ["2K", "4K", "custom"],
        "ui_type": "select"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Aspect ratio when size is not custom. Use match_input_image to match a reference.",
        "required": false,
        "default": "match_input_image",
        "enum": ["match_input_image", "1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"],
        "ui_type": "select"
      },
      {
        "name": "width",
        "type": "number",
        "label": "Width",
        "description": "Custom width when size is custom. Range 1024-4096 px.",
        "required": false,
        "default": null,
        "min": 1024,
        "max": 4096,
        "ui_type": "number"
      },
      {
        "name": "height",
        "type": "number",
        "label": "Height",
        "description": "Custom height when size is custom. Range 1024-4096 px.",
        "required": false,
        "default": null,
        "min": 1024,
        "max": 4096,
        "ui_type": "number"
      },
      {
        "name": "sequential_image_generation",
        "type": "string",
        "label": "Sequential Image Generation",
        "description": "disabled generates one image; auto may produce related multi-image sets.",
        "required": false,
        "default": "disabled",
        "enum": ["disabled", "auto"],
        "ui_type": "select"
      },
      {
        "name": "max_images",
        "type": "number",
        "label": "Max Images",
        "description": "Max images when sequential mode is auto. Total input + generated cannot exceed 15.",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 15,
        "ui_type": "number"
      },
      {
        "name": "enhance_prompt",
        "type": "boolean",
        "label": "Enhance Prompt",
        "description": "Apply prompt enhancement for higher quality (slower).",
        "required": false,
        "default": true,
        "ui_type": "switch"
      }
    ]
  }'::jsonb,
  ARRAY['match_input_image', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'],
  '1:1',
  true,
  false,
  false,
  false,
  false,
  NULL,
  14,
  '{
    "strategy": "tiered_per_output",
    "defaultCredits": 4,
    "dimensions": [
      {
        "parameter": "size",
        "values": { "2k": 4, "3k": 6, "4k": 8 }
      }
    ]
  }'::jsonb,
  $json${
    "agentSummary": "Replicate-hosted Seedream 4.5 image generation/editing. Inactive standby while fal remains the live provider for bytedance/seedream-4.5.",
    "bestFor": ["multi-reference composites", "layout prototyping", "realistic scenes", "text rendering in designs"],
    "avoidFor": ["masked inpainting workflows", "video", "more than 14 reference images"],
    "inputSemantics": {
      "prompt": "Natural-language generation or edit instruction.",
      "image_input": "Up to 14 reference images for image-to-image / multi-reference edits.",
      "size": "2K, 4K, or custom with width/height.",
      "aspect_ratio": "Used when size is not custom.",
      "sequential_image_generation": "disabled or auto for related multi-image sets.",
      "max_images": "Cap when sequential mode is auto (1-15).",
      "enhance_prompt": "Optional quality enhancement; increases latency."
    },
    "routingRules": [
      "Catalog id remains bytedance/seedream-4.5; provider row is replicate.",
      "Do not surface this row while is_active is false.",
      "To switch live traffic: deactivate fal bytedance/seedream-4.5 and activate this replicate row."
    ],
    "promptGuidance": [
      "For multi-reference edits, describe which input image supplies which element."
    ],
    "pitfalls": ["Inactive by default.", "Total input + generated images cannot exceed 15."]
  }$json$::jsonb
)
ON CONFLICT (identifier, provider) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
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
  max_images = EXCLUDED.max_images,
  pricing_config = EXCLUDED.pricing_config,
  agent_usage = EXCLUDED.agent_usage,
  updated_at = timezone('utc'::text, now());
