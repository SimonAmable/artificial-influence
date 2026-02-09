-- ============================================================================
-- Migration: Split is_reference_supported into supports_reference_image and supports_reference_video
-- ============================================================================
-- Reference Image: used by image models to guide generation (style, character, etc.)
-- Reference Video: used by video models for video editing or motion copy
--
-- INSTRUCTIONS:
-- 1. Run this in Supabase SQL Editor
-- 2. Run after any model setup scripts
-- ============================================================================

-- Add new columns (default false for safety)
ALTER TABLE public.models
  ADD COLUMN IF NOT EXISTS supports_reference_image BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_reference_video BOOLEAN DEFAULT false;

-- Image models: supports_reference_image = true when they accept reference images for style/character
UPDATE public.models SET supports_reference_image = true
WHERE type = 'image' AND identifier IN (
  'google/nano-banana',
  'google/nano-banana-pro',
  'bytedance/seedream-4.5',
  'xai/grok-imagine-image',
  'openai/gpt-image-1.5',
  'prunaai/flux-kontext-fast',
  'stability-ai/z-image-turbo'
);

-- Migrate from is_reference_supported if column exists (handles models not in explicit list)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'models' AND column_name = 'is_reference_supported'
  ) THEN
    UPDATE public.models
    SET supports_reference_image = (supports_reference_image OR COALESCE(is_reference_supported, false))
    WHERE type = 'image';
  END IF;
END $$;

-- Video models: only Kling motion control and Grok Imagine Video support reference video
UPDATE public.models SET supports_reference_video = true
WHERE identifier IN ('kwaivgi/kling-v2.6-motion-control', 'xai/grok-imagine-video');

-- Drop old column
ALTER TABLE public.models DROP COLUMN IF EXISTS is_reference_supported;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT identifier, type, supports_reference_image, supports_reference_video FROM public.models;
