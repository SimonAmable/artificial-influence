-- Add xAI Grok Imagine Image Quality on Replicate.
-- Source: https://replicate.com/xai/grok-imagine-image-quality
-- Pricing: $0.05 per 1k output image, $0.07 per 2k output image, plus input image pricing for edits.
-- The app uses a static model_cost, so default to the documented 2k output cost.

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
  'xai/grok-imagine-image-quality',
  'Grok Imagine Quality',
  'xAI higher-quality image model on Replicate with sharper details, stronger text rendering, image editing, and 2k output.',
  'image',
  'replicate',
  true,
  7,
  '{
    "parameters": [
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Aspect ratio of the generated image. Ignored when editing an input image.",
        "required": false,
        "default": "1:1",
        "enum": ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2", "19.5:9", "9:19.5", "20:9", "9:20"],
        "ui_type": "select"
      },
      {
        "name": "resolution",
        "type": "string",
        "label": "Resolution",
        "description": "Output resolution tier",
        "required": false,
        "default": "2k",
        "enum": ["1k", "2k"],
        "ui_type": "select"
      }
    ]
  }'::jsonb,
  ARRAY['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '2:1', '1:2', '19.5:9', '9:19.5', '20:9', '9:20'],
  '1:1',
  true,
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
  supports_reference_audio = EXCLUDED.supports_reference_audio,
  supports_first_frame = EXCLUDED.supports_first_frame,
  supports_last_frame = EXCLUDED.supports_last_frame,
  duration_options = EXCLUDED.duration_options,
  max_images = EXCLUDED.max_images,
  updated_at = timezone('utc'::text, now());

UPDATE public.models
SET agent_usage = $json${
  "agentSummary": "Grok Imagine Quality is xAI's higher-quality image model on Replicate. It supports text-to-image and single-image editing with 1k or 2k output.",
  "bestFor": ["final visuals", "client-ready thumbnails", "ads and hero images", "photoreal scenes", "images with clearer text rendering"],
  "avoidFor": ["fast cheap drafts", "multi-reference image blending", "more than one output variant in this app", "transparent-background promises"],
  "inputSemantics": {
    "prompt": "Text description for generation, or edit instructions when an image is attached.",
    "image": "Optional single input image URL for editing mode. The app sends only the first attached reference image to Replicate.",
    "aspect_ratio": "Used for text-to-image only; ignored by Replicate when an image is supplied.",
    "resolution": "1k or 2k. 2k is the default and highest-quality output."
  },
  "routingRules": [
    "Use xai/grok-imagine-image-quality when the user asks for Grok Imagine with higher quality, sharper details, better text rendering, or 2k output.",
    "Use xai/grok-imagine-image for faster Grok image drafts.",
    "When reference images are attached, treat this as a single-image edit and rely on the first image only."
  ],
  "promptGuidance": [
    "Be specific about subject, setting, lighting, mood, composition, and style.",
    "For edits, describe the desired change instead of re-describing the entire source image.",
    "Name real brands, locations, or objects directly when they matter."
  ],
  "pitfalls": ["2k costs more and may take longer than the standard Grok Imagine model.", "Editing accepts one input image.", "Aspect ratio is ignored in edit mode."]
}$json$::jsonb,
    updated_at = timezone('utc'::text, now())
WHERE identifier = 'xai/grok-imagine-image-quality';
