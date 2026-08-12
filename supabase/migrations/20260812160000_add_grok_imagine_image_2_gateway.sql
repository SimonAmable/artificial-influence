-- Add Grok Imagine Image 2.0 through Vercel AI Gateway.
-- Sources:
--   https://vercel.com/changelog/grok-imagine-image-2-0-preview-now-available-on-vercel-ai-gateway
--   https://vercel.com/ai-gateway/models/grok-imagine-image-2.0

INSERT INTO public.models (
  identifier,
  name,
  description,
  type,
  provider,
  is_active,
  model_cost,
  pricing_config,
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
  agent_usage
) VALUES (
  'xai/grok-imagine-image-2.0',
  'Grok Image 2',
  'Create structured visuals with strong prompt following, readable text, and precise image edits.',
  'image',
  'gateway',
  true,
  4,
  '{
    "strategy": "tiered_per_output",
    "defaultCredits": 4,
    "dimensions": [
      {
        "parameter": "quality",
        "values": { "low": 2, "medium": 4, "high": 4 }
      }
    ]
  }'::jsonb,
  '{
    "replicate_input_defaults": {
      "quality": "low",
      "resolution": "1k"
    },
    "parameters": [
      {
        "name": "quality",
        "type": "string",
        "label": "Quality",
        "description": "Choose faster drafts or a more polished final image",
        "required": false,
        "default": "low",
        "enum": ["low", "medium", "high"],
        "ui_type": "select",
        "affects_pricing": true
      },
      {
        "name": "resolution",
        "type": "string",
        "label": "Resolution",
        "description": "Output resolution tier",
        "required": false,
        "default": "1k",
        "enum": ["1k", "2k"],
        "ui_type": "select"
      }
    ]
  }'::jsonb,
  ARRAY['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '2:1', '1:2', '20:9', '9:20'],
  '1:1',
  true,
  false,
  false,
  false,
  false,
  NULL,
  4,
  $json${
    "agentSummary": "Grok Image 2 is xAI's latest image generation and editing model, routed through Vercel AI Gateway. It is especially strong at detailed instructions, typography, layouts, posters, title screens, and infographics.",
    "bestFor": ["posters and title cards", "infographics", "readable text", "layout-heavy visuals", "precise image edits", "multi-reference compositions", "multiple output variations"],
    "avoidFor": ["transparent-background guarantees", "requests that require more than four outputs"],
    "inputSemantics": {
      "prompt": "Detailed image brief, or a precise edit instruction when a reference image is attached.",
      "quality": "low costs 2 credits per output; medium and high cost 4 credits per output.",
      "resolution": "1k or 2k, forwarded through providerOptions.xai.",
      "referenceIds": "Up to three optional source images for editing and compositing, used in attachment order.",
      "variantCount": "One to four output images per generation. Credits are charged per output."
    },
    "routingRules": [
      "Use xai/grok-imagine-image-2.0 when the user asks for Grok Image 2, Grok Imagine 2, dense typography, layout planning, an infographic, a poster, or a title screen.",
      "Use quality low for inexpensive drafts unless the user asks for medium, high, polished, final, or best quality.",
      "When editing, pass up to three reference images and describe the requested change plus what must remain unchanged."
    ],
    "promptGuidance": [
      "Preserve exact text strings and state their visual hierarchy and placement.",
      "For layout-heavy work, describe sections, spacing, alignment, reading order, and typography.",
      "For edits, name the change precisely and list the elements that should stay untouched."
    ],
    "pitfalls": ["Reference-image order matters when the prompt refers to first, second, or third inputs."]
  }$json$::jsonb
)
ON CONFLICT (identifier) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  provider = EXCLUDED.provider,
  is_active = EXCLUDED.is_active,
  model_cost = EXCLUDED.model_cost,
  pricing_config = EXCLUDED.pricing_config,
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
  agent_usage = EXCLUDED.agent_usage,
  updated_at = timezone('utc'::text, now());
