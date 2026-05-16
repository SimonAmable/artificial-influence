-- =====================================================
-- Models Table: Correct All Display Columns
-- =====================================================
-- Fixes: aspect_ratios, default_aspect_ratio, duration_options (INTEGER[]), 
--        Kling V2.6 Pro empty parameters
-- Reference: model-metadata.ts + Replicate API docs

-- =====================================================
-- 1. ASPECT RATIOS & DEFAULT (from model-metadata.ts)
-- =====================================================

-- Google Nano Banana
UPDATE public.models SET
  aspect_ratios = ARRAY['match_input_image', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4'],
  default_aspect_ratio = '1:1'
WHERE identifier = 'google/nano-banana';

-- Nano Banana Pro
UPDATE public.models SET
  aspect_ratios = ARRAY['match_input_image', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4'],
  default_aspect_ratio = 'match_input_image'
WHERE identifier = 'google/nano-banana-pro';

-- Seedream 4.5
UPDATE public.models SET
  aspect_ratios = ARRAY['match_input_image', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4'],
  default_aspect_ratio = 'match_input_image'
WHERE identifier = 'bytedance/seedream-4.5';

-- Grok Imagine
UPDATE public.models SET
  aspect_ratios = ARRAY['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '2:1', '1:2', '19.5:9', '9:19.5', '20:9', '9:20'],
  default_aspect_ratio = '1:1'
WHERE identifier = 'xai/grok-imagine-image';

-- GPT Image 1.5 (limited ratios per model-metadata)
UPDATE public.models SET
  aspect_ratios = ARRAY['1:1', '2:3', '3:2'],
  default_aspect_ratio = '1:1'
WHERE identifier = 'openai/gpt-image-1.5';

-- Flux Kontext Fast
UPDATE public.models SET
  aspect_ratios = ARRAY['match_input_image', '1:1', '16:9', '9:16', '4:3', '3:4'],
  default_aspect_ratio = 'match_input_image'
WHERE identifier = 'prunaai/flux-kontext-fast';

-- Kling V2.6 Motion Control
UPDATE public.models SET
  aspect_ratios = ARRAY['16:9', '9:16', '1:1'],
  default_aspect_ratio = '16:9'
WHERE identifier = 'kwaivgi/kling-v2.6-motion-control';

-- Veed Fabric 1.0
UPDATE public.models SET
  aspect_ratios = ARRAY['16:9', '9:16', '1:1'],
  default_aspect_ratio = '16:9'
WHERE identifier = 'veed/fabric-1.0';

-- Veo 3.1 Fast
UPDATE public.models SET
  aspect_ratios = ARRAY['16:9', '9:16', '1:1'],
  default_aspect_ratio = '16:9'
WHERE identifier = 'google/veo-3.1-fast';

-- Kling V2.6 Pro
UPDATE public.models SET
  aspect_ratios = ARRAY['16:9', '9:16', '1:1'],
  default_aspect_ratio = '16:9'
WHERE identifier = 'kwaivgi/kling-v2.6';

-- Hailuo 2.3 Fast
UPDATE public.models SET
  aspect_ratios = ARRAY['16:9', '9:16', '1:1'],
  default_aspect_ratio = '16:9'
WHERE identifier = 'minimax/hailuo-2.3-fast';

-- =====================================================
-- 2. DURATION OPTIONS (INTEGER[] - not TEXT[])
-- =====================================================

-- Veo 3.1 Fast: 2-10 seconds
UPDATE public.models SET duration_options = ARRAY[2, 3, 4, 5, 6, 7, 8, 9, 10]
WHERE identifier = 'google/veo-3.1-fast';

-- Kling V2.6 Pro: only 5 and 10 seconds
UPDATE public.models SET duration_options = ARRAY[5, 10]
WHERE identifier = 'kwaivgi/kling-v2.6';

-- Hailuo 2.3 Fast: 5-10 seconds (1080p max 6s - handle in UI)
UPDATE public.models SET duration_options = ARRAY[5, 6, 7, 8, 9, 10]
WHERE identifier = 'minimax/hailuo-2.3-fast';

-- Kling Motion & Fabric: no duration param → ensure NULL
UPDATE public.models SET duration_options = NULL
WHERE identifier IN ('kwaivgi/kling-v2.6-motion-control', 'veed/fabric-1.0');

-- =====================================================
-- 3. KLING V2.6 PRO: Fill empty parameters
-- =====================================================

UPDATE public.models SET parameters = '{
  "parameters": [
    {
      "name": "start_image",
      "type": "string",
      "label": "Start Image",
      "description": "First frame of the video (image URL)",
      "required": false,
      "default": null,
      "ui_type": "text"
    },
    {
      "name": "aspect_ratio",
      "type": "string",
      "label": "Aspect Ratio",
      "description": "Aspect ratio of the video (ignored if start image is provided)",
      "required": false,
      "default": "16:9",
      "enum": ["16:9", "9:16", "1:1"],
      "ui_type": "select"
    },
    {
      "name": "duration",
      "type": "number",
      "label": "Duration",
      "description": "Duration of the video in seconds",
      "required": false,
      "default": 5,
      "min": 5,
      "max": 10,
      "ui_type": "number"
    },
    {
      "name": "generate_audio",
      "type": "boolean",
      "label": "Generate Audio",
      "description": "Generate audio for the video",
      "required": false,
      "default": true,
      "ui_type": "switch"
    },
    {
      "name": "negative_prompt",
      "type": "string",
      "label": "Negative Prompt",
      "description": "Description of what to exclude from the generated video",
      "required": false,
      "default": null,
      "ui_type": "textarea"
    }
  ]
}'::jsonb
WHERE identifier = 'kwaivgi/kling-v2.6';

-- =====================================================
-- 4. Ensure duration_options column is INTEGER[]
-- =====================================================
-- If you previously stored as TEXT[], run this first:
-- ALTER TABLE public.models ALTER COLUMN duration_options TYPE INTEGER[] USING (
--   CASE WHEN duration_options IS NULL THEN NULL
--   ELSE ARRAY(SELECT (unnest(duration_options::text[])::text)::integer)
--   END
-- );
-- Or drop and re-add if migration is simpler:
-- ALTER TABLE public.models DROP COLUMN IF EXISTS duration_options;
-- ALTER TABLE public.models ADD COLUMN duration_options INTEGER[];
