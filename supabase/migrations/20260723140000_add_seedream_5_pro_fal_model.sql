-- Seedream 5.0 Pro on Fal: single catalog id routed to text-to-image or edit.
-- https://fal.ai/models/bytedance/seedream/v5/pro/text-to-image
-- https://fal.ai/models/bytedance/seedream/v5/pro/edit

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
  'bytedance/seedream-5-pro',
  'Seedream 5.0',
  'Seedream 5.0 Pro on fal: production-grade text-to-image and multi-reference editing with native multilingual text, layer separation, and up to 2K output. Safety checker is disabled by default.',
  'image',
  'fal',
  true,
  6,
  '{
    "parameters": [
      {
        "name": "enable_safety_checker",
        "type": "boolean",
        "label": "Safety checker",
        "description": "Enable content moderation for input and output.",
        "required": false,
        "default": false,
        "ui_type": "switch"
      },
      {
        "name": "size",
        "type": "string",
        "label": "Resolution preset",
        "description": "Fal auto resolution preset (2K).",
        "required": false,
        "default": "2K",
        "enum": ["2K"],
        "ui_type": "select"
      },
      {
        "name": "num_images",
        "type": "number",
        "label": "Number of images",
        "description": "Number of separate generations to run.",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 6,
        "ui_type": "number"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "description": "Random seed for reproducibility.",
        "required": false,
        "default": null,
        "min": 0,
        "max": 2147483647,
        "ui_type": "number"
      }
    ]
  }'::jsonb,
  ARRAY['match_input_image', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'],
  '1:1',
  true,
  false,
  false,
  false,
  false,
  NULL,
  6
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

UPDATE public.models
SET
  name = 'Seedream 5.0 Lite',
  description = 'Seedream 5.0 Lite on fal: fast reasoning-heavy text-to-image and multi-reference editing up to 3K. Safety checker is disabled by default.'
WHERE identifier = 'bytedance/seedream-5-lite';

UPDATE public.models
SET agent_usage = $json${
  "agentSummary": "Fal-hosted Seedream 5.0 Pro unified image generation/editing model. Backend routes bytedance/seedream-5-pro to text-to-image when there are no references, or edit when reference images are attached.",
  "bestFor": ["production-grade photorealism", "multilingual text in posters and infographics", "multi-reference product composites", "precision region edits", "dense layouts and structured designs"],
  "avoidFor": ["masked inpainting workflows", "video", "more than 10 reference images", "4K output"],
  "inputSemantics": {
    "prompt": "Natural-language generation or edit instruction. For edits, refer to Figure 1, Figure 2, etc. when multiple images matter. Preserve quoted visible copy exactly.",
    "image_urls": "Up to 10 reference images for edit mode.",
    "size": "2K Fal auto resolution preset.",
    "num_images": "Number of separate generations (1-6).",
    "enable_safety_checker": "Disabled by default for this app integration."
  },
  "routingRules": [
    "Use the canonical catalog id bytedance/seedream-5-pro, never separate text-to-image or edit ids.",
    "Use text-to-image when there are no references.",
    "Use edit when the user supplies reference images."
  ],
  "promptGuidance": [
    "For edits with multiple references, describe which figure supplies which element.",
    "State what must remain unchanged as well as what should change.",
    "Quote exact multilingual text and specify hierarchy and placement when relevant."
  ],
  "pitfalls": ["Edit mode accepts up to 10 reference images.", "Pro output is capped at 2K.", "Safety checker is off in this integration; provider policy may still apply."]
}$json$::jsonb
WHERE identifier = 'bytedance/seedream-5-pro';
