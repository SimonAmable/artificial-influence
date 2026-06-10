-- Qwen Image Edit Plus (Replicate LoRA preset for MCNL editing)
-- Source: https://replicate.com/qwen/qwen-image-edit-plus-lora

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
  'qwen/qwen-image-edit-plus-lora',
  'Qwen Image Edit Plus',
  'Qwen image editing on Replicate with a preconfigured MCNL LoRA. Attach a reference image and describe the edit; best for fast instruction-based photo edits.',
  'image',
  'replicate',
  true,
  4,
  '{
    "replicate_input_defaults": {
      "go_fast": true,
      "lora_scale": 1,
      "lora_weights": "https://huggingface.co/GoGoonAI/wan-testing/resolve/main/qwen_MCNL_v1.0.safetensors",
      "output_format": "webp",
      "output_quality": 95,
      "disable_safety_checker": true
    },
    "parameters": [
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Output aspect ratio. Use match input image to preserve the source framing.",
        "required": false,
        "default": "match_input_image",
        "enum": ["match_input_image", "1:1", "16:9", "9:16", "4:3", "3:4"],
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
      },
      {
        "name": "output_quality",
        "type": "number",
        "label": "Output Quality",
        "description": "Compression quality for webp/jpeg output (1-100)",
        "required": false,
        "default": 95,
        "min": 1,
        "max": 100,
        "ui_type": "number"
      },
      {
        "name": "go_fast",
        "type": "boolean",
        "label": "Go Fast",
        "description": "Faster generation with slightly lower quality",
        "required": false,
        "default": true,
        "ui_type": "switch"
      },
      {
        "name": "lora_scale",
        "type": "number",
        "label": "LoRA Scale",
        "description": "Strength of the bundled MCNL LoRA preset",
        "required": false,
        "default": 1,
        "min": 0,
        "max": 2,
        "ui_type": "number"
      }
    ]
  }'::jsonb,
  ARRAY['match_input_image', '1:1', '16:9', '9:16', '4:3', '3:4'],
  'match_input_image',
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
  "agentSummary": "Qwen Image Edit Plus on Replicate is an image-editing model with a preconfigured MCNL LoRA. It requires one reference image and a natural-language edit instruction.",
  "bestFor": ["instruction-based photo edits", "fast edit iteration", "single-image restyling", "MCNL-tuned portrait and lifestyle edits"],
  "avoidFor": ["text-to-image without a source image", "multi-reference compositing", "video", "transparent-background output"],
  "inputSemantics": {
    "prompt": "Describe the desired edit and what to preserve from the source image.",
    "image": "Required single reference image URL sent as a one-item array to Replicate.",
    "aspect_ratio": "Use match_input_image for edits unless the user requests a specific output ratio (1:1, 16:9, 9:16, 4:3, 3:4).",
    "go_fast": "Default true for speed; turn off only when the user prioritizes final quality over latency.",
    "lora_scale": "Default 1 for the bundled MCNL LoRA; only change when the user explicitly asks to tune LoRA strength.",
    "lora_weights": "Preconfigured MCNL LoRA URL; do not override unless the user supplies a different LoRA."
  },
  "routingRules": [
    "Choose when the user wants Qwen Image Edit Plus or MCNL-style Qwen edits with a single source image.",
    "Require exactly one reference image; this model is edit-only.",
    "Prefer fal-ai/qwen-image-2 for text-to-image or multi-image editing without this LoRA preset."
  ],
  "promptGuidance": [
    "State both the change and what must stay the same (identity, pose, lighting, background).",
    "Use concrete edit verbs: change outfit, relight, replace background, remove object.",
    "Avoid vague prompts like improve this without naming the visual change."
  ],
  "pitfalls": ["No text-to-image path.", "Only the first attached reference image is used.", "LoRA preset may bias style; describe conflicts explicitly if the user wants a neutral edit."]
}$json$::jsonb,
    updated_at = timezone('utc'::text, now())
WHERE identifier = 'qwen/qwen-image-edit-plus-lora';
