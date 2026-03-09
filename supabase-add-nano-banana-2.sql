-- ============================================================================
-- Add Google Nano Banana 2 Model to Supabase
-- ============================================================================
-- Source: https://replicate.com/google/nano-banana-2
-- Nano Banana 2: Google's latest image generation model (Gemini 3.1 Flash Image)
-- Optimized for speed and high-volume use cases with Pro-level visual quality
-- Supports up to 14 reference images for style transfer and complex editing
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase Project Dashboard
-- 2. Navigate to SQL Editor
-- 3. Click "New Query"
-- 4. Copy and paste the SQL below
-- 5. Click "Run"
-- 6. Confirm success message
--
-- ============================================================================

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
  max_images
) VALUES (
  'google/nano-banana-2',
  'Nano Banana 2',
  'Google''s latest image generation model (Gemini 3.1 Flash Image). Optimized for speed with Pro-level quality. Supports up to 14 reference images for editing.',
  'image',
  'replicate',
  true,
  0.002,
  '{
    "parameters": [
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Desired aspect ratio, or match input image",
        "required": false,
        "default": "match_input_image",
        "enum": ["match_input_image", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "1:4", "4:1", "1:8", "8:1"],
        "ui_type": "select"
      },
      {
        "name": "resolution",
        "type": "string",
        "label": "Resolution",
        "description": "Output resolution (512px, 1K, 2K, 4K)",
        "required": false,
        "default": "1K",
        "enum": ["512", "1K", "2K", "4K"],
        "ui_type": "select"
      },
      {
        "name": "output_format",
        "type": "string",
        "label": "Output Format",
        "description": "Desired image file format",
        "required": false,
        "default": "jpg",
        "enum": ["jpg", "png"],
        "ui_type": "select"
      },
      {
        "name": "num_images",
        "type": "number",
        "label": "Number of Images",
        "description": "How many image variants to generate",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 10,
        "ui_type": "number"
      }
    ]
  }'::jsonb,
  ARRAY['match_input_image', '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '1:4', '4:1', '1:8', '8:1'],
  'match_input_image',
  true,
  false,
  10
)
ON CONFLICT (identifier) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  parameters = EXCLUDED.parameters,
  aspect_ratios = EXCLUDED.aspect_ratios,
  default_aspect_ratio = EXCLUDED.default_aspect_ratio,
  supports_reference_image = EXCLUDED.supports_reference_image,
  max_images = EXCLUDED.max_images,
  model_cost = EXCLUDED.model_cost,
  is_active = EXCLUDED.is_active,
  updated_at = timezone('utc'::text, now());
