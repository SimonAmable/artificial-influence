-- Switch default upscale model from SeedVR2 to Pruna P-Image-Upscale
-- https://replicate.com/prunaai/p-image-upscale

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
  max_images
) VALUES (
  'prunaai/p-image-upscale',
  'P-Image Upscale',
  'Fast AI image upscaling up to 8 MP with optional detail and realism enhancement. See https://replicate.com/prunaai/p-image-upscale',
  'upscale',
  'replicate',
  true,
  1,
  '{
    "parameters": [
      {
        "name": "image",
        "type": "string",
        "label": "Input Image",
        "description": "Image URL to upscale",
        "required": true,
        "ui_type": "text"
      },
      {
        "name": "upscale_mode",
        "type": "string",
        "label": "Upscale Mode",
        "description": "target = fixed megapixel target; factor = multiply each side",
        "required": false,
        "default": "target",
        "enum": ["target", "factor"],
        "ui_type": "select"
      },
      {
        "name": "target",
        "type": "number",
        "label": "Target Megapixels",
        "description": "Target resolution when upscale_mode is target (1-8 MP)",
        "required": false,
        "default": 4,
        "min": 1,
        "max": 8,
        "ui_type": "number"
      },
      {
        "name": "factor",
        "type": "number",
        "label": "Scale Factor",
        "description": "Per-side multiplier when upscale_mode is factor (capped at 8 MP)",
        "required": false,
        "default": 2,
        "min": 1,
        "max": 8,
        "ui_type": "number"
      },
      {
        "name": "enhance_realism",
        "type": "boolean",
        "label": "Enhance Realism",
        "description": "Improve realism; useful for AI-generated images",
        "required": false,
        "default": true,
        "ui_type": "switch"
      },
      {
        "name": "enhance_details",
        "type": "boolean",
        "label": "Enhance Details",
        "description": "Sharpen fine textures and small details",
        "required": false,
        "default": false,
        "ui_type": "switch"
      },
      {
        "name": "output_format",
        "type": "string",
        "label": "Output Format",
        "required": false,
        "default": "png",
        "enum": ["jpg", "png", "webp"],
        "ui_type": "select"
      },
      {
        "name": "disable_safety_checker",
        "type": "boolean",
        "label": "Disable Safety Checker",
        "description": "Disabled by default for this app integration.",
        "required": false,
        "default": true,
        "ui_type": "switch"
      }
    ]
  }'::jsonb,
  NULL,
  NULL,
  false,
  false,
  false,
  false,
  false,
  NULL
)
ON CONFLICT (identifier) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  provider = EXCLUDED.provider,
  is_active = EXCLUDED.is_active,
  model_cost = EXCLUDED.model_cost,
  parameters = EXCLUDED.parameters,
  updated_at = timezone('utc'::text, now());

-- Retire SeedVR2 as the default upscale provider (images-only path now uses P-Image-Upscale)
UPDATE public.models
SET is_active = false,
    updated_at = timezone('utc'::text, now())
WHERE identifier IN (
  'zsxkib/seedvr2',
  'zsxkib/seedvr2:ca98249be9cb623f02a80a7851a2b1a33d5104c251a8f5a1588f251f79bf7c78'
);

UPDATE public.models
SET description = 'Make images bigger and sharper with fast AI upscaling up to 8 MP. Optional realism and detail enhancement for AI-generated or soft photos.'
WHERE identifier = 'prunaai/p-image-upscale';

UPDATE public.models
SET agent_usage = $json${
  "agentSummary": "P-Image Upscale uses Pruna's p-image-upscale on Replicate for fast image upscaling (1-8 MP) with optional realism and detail enhancement.",
  "bestFor": ["upscaling existing images", "AI-generated image cleanup", "increasing resolution before posting", "fast 4 MP upscales"],
  "avoidFor": ["video restoration", "new image generation", "creative edits that change content", "lip sync"],
  "inputSemantics": {
    "image": "Existing image URL to upscale.",
    "upscale_mode": "Use target for fixed megapixel output; factor to scale each side (capped at 8 MP).",
    "target": "Target megapixels when upscale_mode is target (default 4).",
    "factor": "Per-side scale when upscale_mode is factor.",
    "enhance_realism": "Improves realism; often helpful for AI-generated images.",
    "enhance_details": "Sharpens fine textures; may increase contrast slightly.",
    "output_format": "jpg, png, or webp.",
    "disable_safety_checker": "Always true in this app; safety checker is off for upscale runs."
  },
  "routingRules": [
    "Use only when the user wants to improve resolution of an existing image.",
    "Do not route generation prompts here unless an input image exists.",
    "This model is image-only; do not use for video upscale."
  ],
  "promptGuidance": ["No creative prompt is needed; choose target MP and enhancement toggles."],
  "pitfalls": ["Extreme low-res inputs may still look soft.", "enhance_details can over-sharpen clean photos.", "Output is capped at 8 MP."]
}$json$::jsonb,
    updated_at = timezone('utc'::text, now())
WHERE identifier = 'prunaai/p-image-upscale';
