-- Assets library setup (Phase 2)
-- Run this in Supabase SQL editor after review.

-- 1) Create assets table
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_generation_id UUID NULL REFERENCES public.generations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'video', 'audio')),
  category TEXT NOT NULL CHECK (category IN ('character', 'scene', 'texture', 'motion', 'audio')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  asset_url TEXT NOT NULL,
  supabase_storage_path TEXT NULL,
  thumbnail_url TEXT NULL,
  source_node_type TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2) Useful indexes
CREATE INDEX IF NOT EXISTS idx_assets_user_created_at ON public.assets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_visibility_category_created ON public.assets (visibility, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON public.assets (asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_tags_gin ON public.assets USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_assets_title_lower ON public.assets ((lower(title)));

-- 3) updated_at trigger function fallback (reuse existing if available)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.handle_updated_at()
    RETURNS TRIGGER AS $f$
    BEGIN
      NEW.updated_at = timezone('utc'::text, now());
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS on_asset_updated ON public.assets;
CREATE TRIGGER on_asset_updated
  BEFORE UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 4) Enable RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- 5) Policies (idempotent)
DROP POLICY IF EXISTS "assets_select_own_or_public" ON public.assets;
CREATE POLICY "assets_select_own_or_public"
  ON public.assets
  FOR SELECT
  USING (auth.uid() = user_id OR visibility = 'public');

DROP POLICY IF EXISTS "assets_insert_own" ON public.assets;
CREATE POLICY "assets_insert_own"
  ON public.assets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "assets_update_own" ON public.assets;
CREATE POLICY "assets_update_own"
  ON public.assets
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "assets_delete_own" ON public.assets;
CREATE POLICY "assets_delete_own"
  ON public.assets
  FOR DELETE
  USING (auth.uid() = user_id);
