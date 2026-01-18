-- Create models table for image and video generation models
CREATE TABLE IF NOT EXISTS public.models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'audio')),
  provider TEXT,
  is_active BOOLEAN DEFAULT true,
  model_cost DECIMAL(10, 6) DEFAULT 0, -- Cost per generation (in credits or currency)
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_models_type ON public.models(type);
CREATE INDEX IF NOT EXISTS idx_models_is_active ON public.models(is_active);
CREATE INDEX IF NOT EXISTS idx_models_identifier ON public.models(identifier);
CREATE INDEX IF NOT EXISTS idx_models_parameters ON public.models USING GIN(parameters);

-- Enable Row Level Security
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access for active models
CREATE POLICY "Public can view active models"
  ON public.models
  FOR SELECT
  USING (is_active = true);

-- Policy: Allow authenticated users to view all models (for admin/management)
CREATE POLICY "Authenticated users can view all models"
  ON public.models
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Use existing updated_at trigger function (from profiles setup)
-- If it doesn't exist, create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.handle_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = timezone('utc'::text, now());
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Trigger to automatically update updated_at timestamp
DROP TRIGGER IF EXISTS on_model_updated ON public.models;
CREATE TRIGGER on_model_updated
  BEFORE UPDATE ON public.models
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert seed data for existing models

-- Image model: google/nano-banana
INSERT INTO public.models (identifier, name, description, type, provider, is_active, model_cost, parameters)
VALUES (
  'google/nano-banana',
  'Google Nano Banana',
  'High-quality image generation model by Google',
  'image',
  'replicate',
  true,
  0.001, -- Example cost
  '{
    "parameters": [
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Image aspect ratio",
        "required": false,
        "default": "1:1",
        "enum": ["1:1", "16:9", "9:16", "4:3", "3:4"],
        "ui_type": "select"
      },
      {
        "name": "aspectRatio",
        "type": "string",
        "label": "Aspect Ratio (AI SDK)",
        "description": "Aspect ratio in format width:height",
        "required": false,
        "default": null,
        "pattern": "^\\d+:\\d+$",
        "ui_type": "text"
      },
      {
        "name": "resolution",
        "type": "string",
        "label": "Resolution",
        "description": "Output resolution in format WIDTHxHEIGHT",
        "required": false,
        "default": "1024x1024",
        "pattern": "^\\d+x\\d+$",
        "ui_type": "text"
      },
      {
        "name": "output_format",
        "type": "string",
        "label": "Output Format",
        "description": "Image output format",
        "required": false,
        "default": "png",
        "enum": ["jpg", "png", "webp"],
        "ui_type": "select"
      },
      {
        "name": "n",
        "type": "number",
        "label": "Number of Images",
        "description": "Number of images to generate",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 4,
        "ui_type": "number"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "description": "Random seed for reproducibility",
        "required": false,
        "default": null,
        "min": 0,
        "max": 2147483647,
        "ui_type": "number"
      }
    ]
  }'::jsonb
)
ON CONFLICT (identifier) DO NOTHING;

-- Video model: kwaivgi/kling-v2.6-motion-control
INSERT INTO public.models (identifier, name, description, type, provider, is_active, model_cost, parameters)
VALUES (
  'kwaivgi/kling-v2.6-motion-control',
  'Kling V2.6 Motion Control',
  'Advanced video generation with motion control',
  'video',
  'replicate',
  true,
  0.01, -- Example cost
  '{
    "parameters": [
      {
        "name": "mode",
        "type": "string",
        "label": "Mode",
        "description": "Model variant",
        "required": false,
        "default": "pro",
        "enum": ["pro", "std"],
        "ui_type": "select"
      },
      {
        "name": "keep_original_sound",
        "type": "boolean",
        "label": "Keep Original Sound",
        "description": "Preserve original audio from reference video",
        "required": false,
        "default": true,
        "ui_type": "switch"
      },
      {
        "name": "character_orientation",
        "type": "string",
        "label": "Character Orientation",
        "description": "Character orientation setting",
        "required": false,
        "default": "image",
        "enum": ["image"],
        "ui_type": "select"
      }
    ]
  }'::jsonb
)
ON CONFLICT (identifier) DO NOTHING;

-- Video model: veed/fabric-1.0
INSERT INTO public.models (identifier, name, description, type, provider, is_active, model_cost, parameters)
VALUES (
  'veed/fabric-1.0',
  'Veed Fabric 1.0',
  'Lip sync video generation model',
  'video',
  'replicate',
  true,
  0.005, -- Example cost
  '{
    "parameters": [
      {
        "name": "resolution",
        "type": "string",
        "label": "Resolution",
        "description": "Output video resolution",
        "required": false,
        "default": "720p",
        "enum": ["720p", "480p"],
        "ui_type": "select"
      }
    ]
  }'::jsonb
)
ON CONFLICT (identifier) DO NOTHING;

-- Image model: prunaai/flux-kontext-fast
INSERT INTO public.models (identifier, name, description, type, provider, is_active, model_cost, parameters)
VALUES (
  'prunaai/flux-kontext-fast',
  'Flux Kontext Fast',
  'Ultra fast flux kontext endpoint for image generation',
  'image',
  'replicate',
  true,
  0.002, -- Example cost
  '{
    "parameters": [
      {
        "name": "speed_mode",
        "type": "string",
        "label": "Speed Mode",
        "description": "Speed optimization level",
        "required": false,
        "default": "Juiced 🔥",
        "enum": ["Juiced 🔥", "Fast", "Standard"],
        "ui_type": "select"
      },
      {
        "name": "num_inference_steps",
        "type": "number",
        "label": "Inference Steps",
        "description": "Number of diffusion (inference) steps",
        "required": false,
        "default": 30,
        "min": 1,
        "max": 100,
        "ui_type": "number"
      },
      {
        "name": "guidance",
        "type": "number",
        "label": "Guidance Scale",
        "description": "Strength of the guidance during generation. Lower = looser; higher = closer to prompt",
        "required": false,
        "default": 3.5,
        "min": 0,
        "max": 20,
        "step": 0.1,
        "ui_type": "slider"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "description": "Seed for random generation, for reproducibility. Use -1 for random",
        "required": false,
        "default": -1,
        "min": -1,
        "max": 2147483647,
        "ui_type": "number"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Aspect ratio of the output; by default matches input image if given",
        "required": false,
        "default": "match_input_image",
        "enum": ["match_input_image", "1:1", "16:9", "9:16", "4:3", "3:4"],
        "ui_type": "select"
      },
      {
        "name": "image_size",
        "type": "number",
        "label": "Image Size",
        "description": "Base image size on the longest side; sets scale of output",
        "required": false,
        "default": 1024,
        "min": 512,
        "max": 2048,
        "ui_type": "number"
      },
      {
        "name": "output_format",
        "type": "string",
        "label": "Output Format",
        "description": "Format of the output image",
        "required": false,
        "default": "jpg",
        "enum": ["jpg", "png", "webp"],
        "ui_type": "select"
      },
      {
        "name": "output_quality",
        "type": "number",
        "label": "Output Quality",
        "description": "Quality parameter (1-100) for lossy formats (jpg, webp)",
        "required": false,
        "default": 80,
        "min": 1,
        "max": 100,
        "ui_type": "slider"
      }
    ]
  }'::jsonb
)
ON CONFLICT (identifier) DO NOTHING;

-- Image model: google/nano-banana-pro
INSERT INTO public.models (identifier, name, description, type, provider, is_active, model_cost, parameters)
VALUES (
  'google/nano-banana-pro',
  'Nano Banana Pro',
  'Google''s state of the art image generation and editing model',
  'image',
  'replicate',
  true,
  0.003, -- Example cost
  '{
    "parameters": [
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Desired aspect ratio, or match input image",
        "required": false,
        "default": "auto",
        "enum": ["auto", "1:1", "16:9", "9:16", "3:2", "2:3", "4:3", "3:4"],
        "ui_type": "select"
      },
      {
        "name": "resolution",
        "type": "string",
        "label": "Resolution",
        "description": "Output resolution. Nano Banana Pro supports up to 4K",
        "required": false,
        "default": "2K",
        "enum": ["1K", "2K", "4K"],
        "ui_type": "select"
      },
      {
        "name": "output_format",
        "type": "string",
        "label": "Output Format",
        "description": "Desired image file format",
        "required": false,
        "default": "jpg",
        "enum": ["jpeg", "png", "webp"],
        "ui_type": "select"
      },
      {
        "name": "safety_filter_level",
        "type": "string",
        "label": "Safety Filter Level",
        "description": "Controls content filtering / moderation",
        "required": false,
        "default": "block_only_high",
        "enum": ["block_only_high", "block_medium_and_above"],
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
  }'::jsonb
)
ON CONFLICT (identifier) DO NOTHING;

-- Image model: openai/gpt-image-1.5
INSERT INTO public.models (identifier, name, description, type, provider, is_active, model_cost, parameters)
VALUES (
  'openai/gpt-image-1.5',
  'GPT Image 1.5',
  'OpenAI''s latest image generation model with better instruction following and adherence to prompts',
  'image',
  'replicate',
  true,
  0.004, -- Example cost
  '{
    "parameters": [
      {
        "name": "background",
        "type": "string",
        "label": "Background",
        "description": "Background type. When transparent, output format must support transparency (png or webp)",
        "required": false,
        "default": "auto",
        "enum": ["transparent", "opaque", "auto"],
        "ui_type": "select"
      },
      {
        "name": "moderation",
        "type": "string",
        "label": "Moderation",
        "description": "Controls content moderation level",
        "required": false,
        "default": "auto",
        "enum": ["low", "auto"],
        "ui_type": "select"
      },
      {
        "name": "n",
        "type": "number",
        "label": "Number of Images",
        "description": "Number of images to generate",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 10,
        "ui_type": "number"
      },
      {
        "name": "size",
        "type": "string",
        "label": "Size",
        "description": "Output image size",
        "required": false,
        "default": "auto",
        "enum": ["1024x1024", "1024x1536", "1536x1024", "auto"],
        "ui_type": "select"
      },
      {
        "name": "quality",
        "type": "string",
        "label": "Quality",
        "description": "Image generation quality",
        "required": false,
        "default": "auto",
        "enum": ["low", "medium", "high", "auto"],
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
      },
      {
        "name": "output_compression",
        "type": "number",
        "label": "Output Compression",
        "description": "Compression level 0-100% for webp or jpeg",
        "required": false,
        "default": 100,
        "min": 0,
        "max": 100,
        "ui_type": "slider"
      }
    ]
  }'::jsonb
)
ON CONFLICT (identifier) DO NOTHING;

-- Image model: bytedance/seedream-4.5
INSERT INTO public.models (identifier, name, description, type, provider, is_active, model_cost, parameters)
VALUES (
  'bytedance/seedream-4.5',
  'Seedream 4.5',
  'Seedream 4.5: Upgraded Bytedance image model with stronger spatial understanding and world knowledge',
  'image',
  'replicate',
  true,
  0.0025, -- Example cost
  '{
    "parameters": [
      {
        "name": "size",
        "type": "string",
        "label": "Size",
        "description": "Pre-set image resolution",
        "required": false,
        "default": "2K",
        "enum": ["2K", "4K"],
        "ui_type": "select"
      },
      {
        "name": "aspect_ratio",
        "type": "string",
        "label": "Aspect Ratio",
        "description": "Aspect ratio when size is not custom",
        "required": false,
        "default": "match_input_image",
        "enum": ["match_input_image", "1:1", "16:9", "9:16", "4:3", "3:4"],
        "ui_type": "select"
      },
      {
        "name": "width",
        "type": "number",
        "label": "Width",
        "description": "Custom width when size is custom. Typically 1024-4096 px",
        "required": false,
        "default": null,
        "min": 1024,
        "max": 4096,
        "ui_type": "number"
      },
      {
        "name": "height",
        "type": "number",
        "label": "Height",
        "description": "Custom height when size is custom. Typically 1024-4096 px",
        "required": false,
        "default": null,
        "min": 1024,
        "max": 4096,
        "ui_type": "number"
      },
      {
        "name": "sequential_image_generation",
        "type": "string",
        "label": "Sequential Image Generation",
        "description": "Controls multi-image set or sequential generation",
        "required": false,
        "default": "disabled",
        "enum": ["disabled", "auto"],
        "ui_type": "select"
      },
      {
        "name": "max_images",
        "type": "number",
        "label": "Max Images",
        "description": "Max images when sequential mode enabled. Limits like 15 total (including inputs)",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 15,
        "ui_type": "number"
      },
      {
        "name": "num_images",
        "type": "number",
        "label": "Number of Images",
        "description": "Number of separate generations",
        "required": false,
        "default": 1,
        "min": 1,
        "max": 10,
        "ui_type": "number"
      },
      {
        "name": "enhance_prompt",
        "type": "boolean",
        "label": "Enhance Prompt",
        "description": "Whether to apply prompt enhancement for improved quality. Takes more generation time",
        "required": false,
        "default": true,
        "ui_type": "switch"
      },
      {
        "name": "seed",
        "type": "number",
        "label": "Seed",
        "description": "Random seed to reproduce results with same prompt/model/version",
        "required": false,
        "default": null,
        "min": 0,
        "max": 2147483647,
        "ui_type": "number"
      },
      {
        "name": "watermark",
        "type": "boolean",
        "label": "Watermark",
        "description": "Optionally add an invisible watermark to outputs",
        "required": false,
        "default": false,
        "ui_type": "switch"
      },
      {
        "name": "enable_safety_checker",
        "type": "boolean",
        "label": "Enable Safety Checker",
        "description": "Whether safety filters are applied to content",
        "required": false,
        "default": true,
        "ui_type": "switch"
      }
    ]
  }'::jsonb
)
ON CONFLICT (identifier) DO NOTHING;
