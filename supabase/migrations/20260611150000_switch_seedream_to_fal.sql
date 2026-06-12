-- Route Seedream 4.5 and Seedream 5.0 Lite through Fal unified text-to-image / edit endpoints.
-- https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/text-to-image
-- https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/edit
-- https://fal.ai/models/fal-ai/bytedance/seedream/v5/lite/text-to-image
-- https://fal.ai/models/fal-ai/bytedance/seedream/v5/lite/edit

UPDATE public.models
SET
  provider = 'fal',
  description = 'Seedream 4.5 on fal: text-to-image and multi-reference image editing with up to 4K output. Safety checker is disabled by default.',
  model_cost = 4,
  supports_reference_image = true,
  max_images = 6,
  parameters = '{
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
        "description": "Fal auto resolution preset (2K or 4K).",
        "required": false,
        "default": "2K",
        "enum": ["2K", "4K"],
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
  aspect_ratios = ARRAY['match_input_image', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'],
  default_aspect_ratio = '1:1'
WHERE identifier = 'bytedance/seedream-4.5';

UPDATE public.models
SET
  provider = 'fal',
  description = 'Seedream 5.0 Lite on fal: reasoning-heavy text-to-image and multi-reference editing up to 3K. Safety checker is disabled by default.',
  model_cost = 4,
  supports_reference_image = true,
  max_images = 6,
  parameters = '{
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
        "description": "Fal auto resolution preset (2K or 3K).",
        "required": false,
        "default": "2K",
        "enum": ["2K", "3K"],
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
  aspect_ratios = ARRAY['match_input_image', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'],
  default_aspect_ratio = '1:1'
WHERE identifier = 'bytedance/seedream-5-lite';

UPDATE public.models
SET agent_usage = $json${
  "agentSummary": "Fal-hosted Seedream 4.5 unified image generation/editing model. Backend routes bytedance/seedream-4.5 to text-to-image when there are no references, or edit when reference images are attached.",
  "bestFor": ["multi-reference product composites", "layout prototyping with text overlays", "brand asset integration", "realistic scenes with strong spatial understanding", "text rendering in designs"],
  "avoidFor": ["masked inpainting workflows", "video", "more than 10 reference images"],
  "inputSemantics": {
    "prompt": "Natural-language generation or edit instruction. For edits, refer to Figure 1, Figure 2, etc. when multiple images matter.",
    "image_urls": "Up to 10 reference images for edit mode.",
    "size": "2K or 4K Fal auto resolution preset.",
    "num_images": "Number of separate generations (1-6).",
    "enable_safety_checker": "Disabled by default for this app integration."
  },
  "routingRules": [
    "Use the canonical catalog id bytedance/seedream-4.5, never separate text-to-image or edit ids.",
    "Use text-to-image when there are no references.",
    "Use edit when the user supplies reference images."
  ],
  "promptGuidance": [
    "For edits with multiple references, describe which figure supplies which element.",
    "State what must remain unchanged as well as what should change."
  ],
  "pitfalls": ["Edit mode accepts up to 10 reference images.", "Safety checker is off in this integration; provider policy may still apply."]
}$json$::jsonb
WHERE identifier = 'bytedance/seedream-4.5';

UPDATE public.models
SET agent_usage = $json${
  "agentSummary": "Fal-hosted Seedream 5.0 Lite unified image generation/editing model. Backend routes bytedance/seedream-5-lite to text-to-image when there are no references, or edit when reference images are attached.",
  "bestFor": ["reasoning-heavy generation", "example-based editing", "multi-reference compositions", "marketing mockups", "fast Seedream 5 edits"],
  "avoidFor": ["masked inpainting workflows", "video", "more than 10 reference images"],
  "inputSemantics": {
    "prompt": "Natural-language generation or edit instruction. For edits, refer to Figure 1, Figure 2, etc. when multiple images matter.",
    "image_urls": "Up to 10 reference images for edit mode.",
    "size": "2K or 3K Fal auto resolution preset.",
    "num_images": "Number of separate generations (1-6).",
    "enable_safety_checker": "Disabled by default for this app integration."
  },
  "routingRules": [
    "Use the canonical catalog id bytedance/seedream-5-lite, never separate text-to-image or edit ids.",
    "Use text-to-image when there are no references.",
    "Use edit when the user supplies reference images."
  ],
  "promptGuidance": [
    "For edits with multiple references, describe which figure supplies which element.",
    "Use concise, specific instructions for reasoning-heavy edits."
  ],
  "pitfalls": ["Edit mode accepts up to 10 reference images.", "Keep variant counts low unless the user explicitly asks for multiple options."]
}$json$::jsonb
WHERE identifier = 'bytedance/seedream-5-lite';
