CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.slideshow_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_slideshow_collections_user_updated_at
  ON public.slideshow_collections (user_id, updated_at DESC);

ALTER TABLE public.slideshow_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own slideshow collections" ON public.slideshow_collections;
CREATE POLICY "Users can view own slideshow collections"
  ON public.slideshow_collections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own slideshow collections" ON public.slideshow_collections;
CREATE POLICY "Users can create own slideshow collections"
  ON public.slideshow_collections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own slideshow collections" ON public.slideshow_collections;
CREATE POLICY "Users can update own slideshow collections"
  ON public.slideshow_collections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own slideshow collections" ON public.slideshow_collections;
CREATE POLICY "Users can delete own slideshow collections"
  ON public.slideshow_collections
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS on_slideshow_collections_updated ON public.slideshow_collections;
CREATE TRIGGER on_slideshow_collections_updated
  BEFORE UPDATE ON public.slideshow_collections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.slideshow_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.slideshow_collections(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT slideshow_collection_items_unique_asset UNIQUE (collection_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_slideshow_collection_items_collection_sort
  ON public.slideshow_collection_items (collection_id, sort_order ASC, created_at ASC);

ALTER TABLE public.slideshow_collection_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own slideshow collection items" ON public.slideshow_collection_items;
CREATE POLICY "Users can view own slideshow collection items"
  ON public.slideshow_collection_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.slideshow_collections c
      WHERE c.id = slideshow_collection_items.collection_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create own slideshow collection items" ON public.slideshow_collection_items;
CREATE POLICY "Users can create own slideshow collection items"
  ON public.slideshow_collection_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.slideshow_collections c
      JOIN public.assets a ON a.id = slideshow_collection_items.asset_id
      WHERE c.id = slideshow_collection_items.collection_id
        AND c.user_id = auth.uid()
        AND a.user_id = auth.uid()
        AND a.asset_type = 'image'
    )
  );

DROP POLICY IF EXISTS "Users can update own slideshow collection items" ON public.slideshow_collection_items;
CREATE POLICY "Users can update own slideshow collection items"
  ON public.slideshow_collection_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.slideshow_collections c
      WHERE c.id = slideshow_collection_items.collection_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.slideshow_collections c
      JOIN public.assets a ON a.id = slideshow_collection_items.asset_id
      WHERE c.id = slideshow_collection_items.collection_id
        AND c.user_id = auth.uid()
        AND a.user_id = auth.uid()
        AND a.asset_type = 'image'
    )
  );

DROP POLICY IF EXISTS "Users can delete own slideshow collection items" ON public.slideshow_collection_items;
CREATE POLICY "Users can delete own slideshow collection items"
  ON public.slideshow_collection_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.slideshow_collections c
      WHERE c.id = slideshow_collection_items.collection_id
        AND c.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.slideshow_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled slideshow',
  provider text NOT NULL CHECK (provider IN ('instagram', 'tiktok')),
  social_connection_id uuid NOT NULL REFERENCES public.social_connections(id) ON DELETE CASCADE,
  brand_kit_id uuid REFERENCES public.brand_kits(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'hooks_generated', 'slides_generated', 'draft_created')
  ),
  selected_hook text,
  hook_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  autopost_job_id uuid REFERENCES public.autopost_jobs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_slideshow_projects_user_updated_at
  ON public.slideshow_projects (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_slideshow_projects_social_connection
  ON public.slideshow_projects (social_connection_id);

CREATE INDEX IF NOT EXISTS idx_slideshow_projects_brand_kit
  ON public.slideshow_projects (brand_kit_id);

ALTER TABLE public.slideshow_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own slideshow projects" ON public.slideshow_projects;
CREATE POLICY "Users can view own slideshow projects"
  ON public.slideshow_projects
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own slideshow projects" ON public.slideshow_projects;
CREATE POLICY "Users can create own slideshow projects"
  ON public.slideshow_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.social_connections s
      WHERE s.id = slideshow_projects.social_connection_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own slideshow projects" ON public.slideshow_projects;
CREATE POLICY "Users can update own slideshow projects"
  ON public.slideshow_projects
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.social_connections s
      WHERE s.id = slideshow_projects.social_connection_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own slideshow projects" ON public.slideshow_projects;
CREATE POLICY "Users can delete own slideshow projects"
  ON public.slideshow_projects
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS on_slideshow_projects_updated ON public.slideshow_projects;
CREATE TRIGGER on_slideshow_projects_updated
  BEFORE UPDATE ON public.slideshow_projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
