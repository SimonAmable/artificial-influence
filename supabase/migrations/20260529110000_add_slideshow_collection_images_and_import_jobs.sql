CREATE TABLE IF NOT EXISTS public.slideshow_collection_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.slideshow_collections(id) ON DELETE CASCADE,
  title text NOT NULL,
  image_url text NOT NULL,
  thumbnail_url text,
  supabase_storage_path text,
  source_kind text NOT NULL CHECK (source_kind IN ('upload', 'asset', 'pinterest')),
  source_asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  source_url text,
  source_query text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  width integer,
  height integer,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_slideshow_collection_images_collection_sort
  ON public.slideshow_collection_images (collection_id, sort_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_slideshow_collection_images_user_created
  ON public.slideshow_collection_images (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_slideshow_collection_images_unique_asset
  ON public.slideshow_collection_images (collection_id, source_asset_id)
  WHERE source_asset_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_slideshow_collection_images_unique_storage
  ON public.slideshow_collection_images (collection_id, supabase_storage_path)
  WHERE supabase_storage_path IS NOT NULL;

ALTER TABLE public.slideshow_collection_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own slideshow collection images" ON public.slideshow_collection_images;
CREATE POLICY "Users can view own slideshow collection images"
  ON public.slideshow_collection_images
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.slideshow_collections c
      WHERE c.id = slideshow_collection_images.collection_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create own slideshow collection images" ON public.slideshow_collection_images;
CREATE POLICY "Users can create own slideshow collection images"
  ON public.slideshow_collection_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.slideshow_collections c
      WHERE c.id = slideshow_collection_images.collection_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own slideshow collection images" ON public.slideshow_collection_images;
CREATE POLICY "Users can update own slideshow collection images"
  ON public.slideshow_collection_images
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.slideshow_collections c
      WHERE c.id = slideshow_collection_images.collection_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.slideshow_collections c
      WHERE c.id = slideshow_collection_images.collection_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own slideshow collection images" ON public.slideshow_collection_images;
CREATE POLICY "Users can delete own slideshow collection images"
  ON public.slideshow_collection_images
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.slideshow_collections c
      WHERE c.id = slideshow_collection_images.collection_id
        AND c.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS on_slideshow_collection_images_updated ON public.slideshow_collection_images;
CREATE TRIGGER on_slideshow_collection_images_updated
  BEFORE UPDATE ON public.slideshow_collection_images
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.slideshow_collection_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_collection_id uuid NOT NULL REFERENCES public.slideshow_collections(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('board_url', 'search')),
  query_or_url text NOT NULL,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now() + interval '2 hours')
);

CREATE INDEX IF NOT EXISTS idx_slideshow_collection_import_jobs_user_created
  ON public.slideshow_collection_import_jobs (user_id, created_at DESC);

ALTER TABLE public.slideshow_collection_import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own slideshow collection import jobs" ON public.slideshow_collection_import_jobs;
CREATE POLICY "Users can view own slideshow collection import jobs"
  ON public.slideshow_collection_import_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own slideshow collection import jobs" ON public.slideshow_collection_import_jobs;
CREATE POLICY "Users can create own slideshow collection import jobs"
  ON public.slideshow_collection_import_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.slideshow_collections c
      WHERE c.id = slideshow_collection_import_jobs.target_collection_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own slideshow collection import jobs" ON public.slideshow_collection_import_jobs;
CREATE POLICY "Users can delete own slideshow collection import jobs"
  ON public.slideshow_collection_import_jobs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

INSERT INTO public.slideshow_collection_images (
  user_id,
  collection_id,
  title,
  image_url,
  thumbnail_url,
  supabase_storage_path,
  source_kind,
  source_asset_id,
  source_url,
  tags,
  sort_order,
  metadata,
  created_at,
  updated_at
)
SELECT
  c.user_id,
  sci.collection_id,
  COALESCE(NULLIF(trim(a.title), ''), 'Untitled image'),
  a.asset_url,
  a.thumbnail_url,
  a.supabase_storage_path,
  'asset',
  a.id,
  a.asset_url,
  COALESCE(a.tags, '{}'::text[]),
  sci.sort_order,
  jsonb_build_object('migratedFrom', 'slideshow_collection_items'),
  sci.created_at,
  timezone('utc'::text, now())
FROM public.slideshow_collection_items sci
JOIN public.slideshow_collections c
  ON c.id = sci.collection_id
JOIN public.assets a
  ON a.id = sci.asset_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.slideshow_collection_images existing
  WHERE existing.collection_id = sci.collection_id
    AND existing.source_asset_id = sci.asset_id
);
