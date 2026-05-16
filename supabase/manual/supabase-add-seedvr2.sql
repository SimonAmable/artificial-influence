-- Add zsxkib/seedvr2 model: one-step video & image restoration (3B/7B, optional color fix)
-- Source: https://replicate.com/zsxkib/seedvr2

-- Allow type 'upscale' on models (Creative Upscale, etc.)
ALTER TABLE public.models DROP CONSTRAINT IF EXISTS models_type_check;
ALTER TABLE public.models ADD CONSTRAINT models_type_check CHECK (type = ANY (ARRAY['image'::text, 'video'::text, 'audio'::text, 'upscale'::text]));

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
  supports_first_frame,
  supports_last_frame,
  duration_options,
  max_images,
  supports_reference_image,
  supports_reference_video
) VALUES (
  'zsxkib/seedvr2',
  'Creative Upscale',
  'One-step image upscale and restoration with optional color fix (3B/7B).',
  'upscale',
  'replicate',
  true,
  2,
  '{
    "parameters": [
      {
        "name": "media",
        "type": "string",
        "label": "Media",
        "description": "Video (mp4/mov) or image (png/jpg/webp) URL to restore",
        "required": true,
        "default": null,
        "ui_type": "text"
      },
      {
        "name": "model_variant",
        "type": "string",
        "label": "Model Variant",
        "description": "Model size: 3B or 7B (7B higher fidelity, more VRAM)",
        "required": false,
        "default": "3b",
        "enum": ["3b", "7b"],
        "ui_type": "select"
      },
      {
        "name": "sample_steps",
        "type": "number",
        "label": "Sample Steps",
        "description": "Sampling steps (1 = fast one-step mode)",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 50,
        "ui_type": "number"
      },
      {
        "name": "cfg_scale",
        "type": "number",
        "label": "CFG Scale",
        "description": "Classifier-free guidance scale (higher = stronger restoration)",
        "required": false,
        "default": 1,
        "min": 0.1,
        "max": 5,
        "ui_type": "number"
      },
      {
        "name": "apply_color_fix",
        "type": "boolean",
        "label": "Apply Color Fix",
        "description": "Apply optional wavelet color correction (matches official demo)",
        "required": false,
        "default": false,
        "ui_type": "switch"
      },
      {
        "name": "sp_size",
        "type": "number",
        "label": "Sequence Parallel Size",
        "description": "Sequence-parallel shard heuristic (single-GPU build only accepts 1)",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 1,
        "ui_type": "number"
      },
      {
        "name": "fps",
        "type": "number",
        "label": "FPS",
        "description": "Frames-per-second for video outputs",
        "required": false,
        "default": 24,
        "min": 1,
        "max": 60,
        "ui_type": "number"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "description": "Random seed. Leave blank for a random seed each call",
        "required": false,
        "default": null,
        "min": 0,
        "max": 2147483647,
        "ui_type": "number"
      },
      {
        "name": "output_format",
        "type": "string",
        "label": "Output Format",
        "description": "Image output format (only used for image inputs)",
        "required": false,
        "default": "webp",
        "enum": ["png", "webp", "jpg"],
        "ui_type": "select"
      },
      {
        "name": "output_quality",
        "type": "number",
        "label": "Output Quality",
        "description": "Image quality for lossy formats (jpg/webp)",
        "required": false,
        "default": 90,
        "min": 0,
        "max": 100,
        "ui_type": "slider"
      }
    ]
  }'::jsonb,
  NULL,   /* aspect_ratios: restoration preserves input dimensions, no aspect param in Replicate schema */
  NULL,   /* default_aspect_ratio */
  false,
  false,
  NULL,
  NULL,
  false,
  false
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
  supports_first_frame = EXCLUDED.supports_first_frame,
  supports_last_frame = EXCLUDED.supports_last_frame,
  duration_options = EXCLUDED.duration_options,
  max_images = EXCLUDED.max_images,
  supports_reference_image = EXCLUDED.supports_reference_image,
  supports_reference_video = EXCLUDED.supports_reference_video,
  updated_at = timezone('utc'::text, now());
