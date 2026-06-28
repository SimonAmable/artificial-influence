-- Saved examples: reusable starters for image and video generation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.saved_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surface text NOT NULL CHECK (surface IN ('image', 'video')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  prompt text NOT NULL,
  prompt_attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  inputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_generation_id uuid REFERENCES public.generations(id) ON DELETE SET NULL,
  cover_url text,
  cover_kind text NOT NULL DEFAULT 'image' CHECK (cover_kind IN ('image', 'video')),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  usage_count integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_examples_gallery
  ON public.saved_examples (surface, visibility, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_examples_creator
  ON public.saved_examples (creator_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_examples_source_generation
  ON public.saved_examples (source_generation_id);

ALTER TABLE public.saved_examples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_examples_select ON public.saved_examples;
CREATE POLICY saved_examples_select ON public.saved_examples
  FOR SELECT
  USING (visibility = 'public' OR auth.uid() = creator_id);

DROP POLICY IF EXISTS saved_examples_insert ON public.saved_examples;
CREATE POLICY saved_examples_insert ON public.saved_examples
  FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS saved_examples_update ON public.saved_examples;
CREATE POLICY saved_examples_update ON public.saved_examples
  FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS saved_examples_delete ON public.saved_examples;
CREATE POLICY saved_examples_delete ON public.saved_examples
  FOR DELETE
  USING (auth.uid() = creator_id);

GRANT SELECT ON public.saved_examples TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.saved_examples TO authenticated;

INSERT INTO public.saved_examples (
  creator_id,
  surface,
  title,
  description,
  prompt,
  prompt_attachments,
  inputs,
  default_settings,
  source_generation_id,
  cover_url,
  cover_kind,
  visibility
)
SELECT
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1),
  'image',
  'Cinematic portrait remix',
  'A reusable image starter with a strong visual style and simple one-click reuse.',
  'Create a cinematic portrait of a creator in a moody studio with soft rim light.',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"model":"openai/gpt-image-2","aspect_ratio":"1:1"}'::jsonb,
  NULL,
  '/hero_showcase_images/image_generation.png',
  'image',
  'public'
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1)
  AND NOT EXISTS (
    SELECT 1
    FROM public.saved_examples
    WHERE title = 'Cinematic portrait remix'
      AND surface = 'image'
  );
