-- GPT Image 2.5 Flare and Sunburst on Fal, as separate catalog models.
-- Flare: https://fal.ai/models/openai/gpt-image-2.5/flare/text-to-image
-- Sunburst: https://fal.ai/models/openai/gpt-image-2.5/sunburst/text-to-image
-- Backend routes each id to text-to-image or edit based on reference images.

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
  'openai/gpt-image-2.5/flare',
  'GPT Image 2.5 Flare',
  'OpenAI''s default image model on Fal. Faster than GPT Image 2, with text-to-image and precise edits including transparent backgrounds.',
  'image',
  'fal',
  true,
  8,
  '{
    "parameters": [
      {
        "name": "quality",
        "type": "string",
        "label": "Quality",
        "description": "Higher settings increase detail, latency, and cost.",
        "required": false,
        "default": "high",
        "enum": ["auto", "low", "medium", "high", "xhigh", "max"],
        "ui_type": "select"
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
  4,
  '{
    "strategy": "tiered_per_output",
    "defaultCredits": 8,
    "dimensions": [
      {
        "parameter": "quality",
        "values": { "auto": 8, "low": 1, "medium": 4, "high": 8, "xhigh": 12, "max": 16 }
      }
    ]
  }'::jsonb,
  $json${
    "agentSummary": "Default OpenAI image model. Fal-hosted GPT Image 2.5 Flare. Backend routes openai/gpt-image-2.5/flare to text-to-image with no references, or edit when reference images are attached.",
    "bestFor": ["everyday generation", "fast high-quality stills", "readable text", "precise edits", "transparent backgrounds"],
    "avoidFor": ["video", "when the user explicitly asks for GPT Image 2.5 Sunburst or another named model"],
    "inputSemantics": {
      "prompt": "Natural-language generation or edit instruction. Preserve quoted visible copy exactly.",
      "image_urls": "Up to 16 reference images for edit mode.",
      "quality": "auto, low, medium, high, xhigh, or max. Default high.",
      "output_format": "png, jpeg, or webp."
    }
  }$json$::jsonb
),
(
  'openai/gpt-image-2.5/sunburst',
  'GPT Image 2.5 Sunburst',
  'OpenAI''s precision image model on Fal for premium detail and tighter edits. Slower than Flare.',
  'image',
  'fal',
  true,
  8,
  '{
    "parameters": [
      {
        "name": "quality",
        "type": "string",
        "label": "Quality",
        "description": "Higher settings increase detail, latency, and cost.",
        "required": false,
        "default": "high",
        "enum": ["auto", "low", "medium", "high", "xhigh", "max"],
        "ui_type": "select"
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
  4,
  '{
    "strategy": "tiered_per_output",
    "defaultCredits": 8,
    "dimensions": [
      {
        "parameter": "quality",
        "values": { "auto": 8, "low": 1, "medium": 4, "high": 8, "xhigh": 12, "max": 16 }
      }
    ]
  }'::jsonb,
  $json${
    "agentSummary": "Premium OpenAI image model. Fal-hosted GPT Image 2.5 Sunburst for higher fidelity and tighter edits, with longer generation times than Flare.",
    "bestFor": ["premium campaign stills", "product detail", "tight edit control", "readable text"],
    "avoidFor": ["high-volume speed-first generation", "video", "when the user did not ask for the precision variant"],
    "inputSemantics": {
      "prompt": "Natural-language generation or edit instruction. Preserve quoted visible copy exactly.",
      "image_urls": "Up to 16 reference images for edit mode.",
      "quality": "auto, low, medium, high, xhigh, or max. Default high.",
      "output_format": "png, jpeg, or webp."
    }
  }$json$::jsonb
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
  max_images = EXCLUDED.max_images,
  pricing_config = EXCLUDED.pricing_config,
  agent_usage = EXCLUDED.agent_usage;
