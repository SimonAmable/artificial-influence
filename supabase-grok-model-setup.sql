-- ============================================================================
-- Add xAI Grok 2 Image Model to Supabase
-- ============================================================================
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

INSERT INTO public.models (identifier, name, description, type, provider, is_active, model_cost, parameters)
VALUES (
  'xai/grok-imagine-image',
  'Grok Imagine',
  'xAI Grok Imagine image generation model with support for creating images from text prompts',
  'image',
  'xai',
  true,
  0.004,
  '{
    "parameters": [
      {
        "name": "aspectRatio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Aspect ratio of the generated image",
        "required": false,
        "default": "1:1",
        "enum": ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2", "19.5:9", "9:19.5", "20:9", "9:20"],
        "ui_type": "select"
      },
      {
        "name": "n",
        "type": "number",
        "label": "Number of Images",
        "description": "Number of images to generate (max 10)",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 10,
        "ui_type": "number"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "description": "Seed for reproducibility",
        "required": false,
        "default": null,
        "min": 0,
        "max": 2147483647,
        "ui_type": "number"
      },
      {
        "name": "image_url",
        "type": "string",
        "label": "Input Image URL",
        "description": "Source image for editing or style transfer (public URL or base64 data URI)",
        "required": false,
        "default": null,
        "ui_type": "text"
      }
    ]
  }'::jsonb
)
ON CONFLICT (identifier) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERY (run after insert to confirm)
-- ============================================================================

-- SELECT * FROM public.models WHERE identifier = 'xai/grok-imagine-image';
--
-- Expected output: 1 row with:
-- - identifier: xai/grok-imagine-image
-- - name: Grok Imagine
-- - type: image
-- - provider: xai
-- - is_active: true
-- - model_cost: 0.004
