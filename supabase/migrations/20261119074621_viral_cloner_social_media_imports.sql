-- Viral Cloner: social media imports rename + viral clone job tables.

ALTER TABLE public.social_reference_download_jobs
  RENAME TO social_media_imports;

ALTER INDEX IF EXISTS idx_social_ref_dl_jobs_user_created_at
  RENAME TO idx_social_media_imports_user_created_at;

ALTER INDEX IF EXISTS idx_social_ref_dl_jobs_status
  RENAME TO idx_social_media_imports_status;

ALTER INDEX IF EXISTS idx_social_ref_dl_jobs_platform
  RENAME TO idx_social_media_imports_platform;

ALTER TABLE public.social_media_imports
  RENAME COLUMN source_tiktok_url TO source_url;

ALTER TABLE public.social_media_imports
  RENAME COLUMN tiktok_snapshot TO source_snapshot;

ALTER TABLE public.social_media_imports
  DROP CONSTRAINT IF EXISTS tiktok_reference_download_jobs_status_check;

ALTER TABLE public.social_media_imports
  DROP CONSTRAINT IF EXISTS social_reference_download_jobs_status_check;

ALTER TABLE public.social_media_imports
  ADD CONSTRAINT social_media_imports_status_check
  CHECK (
    status IN (
      'queued',
      'processing',
      'completed',
      'failed',
      'inspecting',
      'inspected',
      'downloading',
      'ready'
    )
  );

ALTER TABLE public.social_media_imports
  DROP CONSTRAINT IF EXISTS social_reference_download_jobs_source_platform_check;

ALTER TABLE public.social_media_imports
  ADD CONSTRAINT social_media_imports_source_platform_check
  CHECK (
    source_platform IN (
      'tiktok',
      'instagram',
      'threads',
      'youtube_shorts',
      'x',
      'reddit',
      'facebook',
      'pinterest',
      'redgifs',
      'direct'
    )
  );

ALTER TABLE public.social_media_imports
  ADD COLUMN IF NOT EXISTS import_purpose TEXT NOT NULL DEFAULT 'reference_download'
    CHECK (import_purpose IN ('reference_download', 'viral_inspect')),
  ADD COLUMN IF NOT EXISTS manifest JSONB,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

DROP TRIGGER IF EXISTS on_social_reference_download_jobs_updated
  ON public.social_media_imports;

CREATE TRIGGER on_social_media_imports_updated
  BEFORE UPDATE ON public.social_media_imports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS "Users can view own social reference download jobs"
  ON public.social_media_imports;

DROP POLICY IF EXISTS "Users can insert own social reference download jobs"
  ON public.social_media_imports;

DROP POLICY IF EXISTS "Service role can manage social reference download jobs"
  ON public.social_media_imports;

CREATE POLICY "Users can view own social media imports"
  ON public.social_media_imports
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own social media imports"
  ON public.social_media_imports
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Service role can manage social media imports"
  ON public.social_media_imports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.viral_clone_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  social_import_id UUID NOT NULL REFERENCES public.social_media_imports(id) ON DELETE CASCADE,
  character_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  character_storage_path TEXT,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_confirmation'
    CHECK (
      status IN (
        'awaiting_confirmation',
        'importing',
        'submitting',
        'processing',
        'completed',
        'partial',
        'failed'
      )
    ),
  source_url TEXT NOT NULL,
  source_platform TEXT NOT NULL,
  source_title TEXT,
  quoted_credits_total INTEGER NOT NULL CHECK (quoted_credits_total > 0),
  import_reservation_key TEXT NOT NULL,
  import_fee_captured BOOLEAN NOT NULL DEFAULT false,
  accepted_right_to_use BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ,
  CONSTRAINT viral_clone_jobs_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_viral_clone_jobs_user_created
  ON public.viral_clone_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_viral_clone_jobs_import
  ON public.viral_clone_jobs (social_import_id);

CREATE TABLE IF NOT EXISTS public.viral_clone_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.viral_clone_jobs(id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL CHECK (item_index >= 0),
  media_kind TEXT NOT NULL CHECK (media_kind IN ('image', 'video', 'animated')),
  trim_start_seconds NUMERIC,
  trim_end_seconds NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'importing',
        'queued',
        'generating',
        'completed',
        'failed'
      )
    ),
  quoted_credits INTEGER NOT NULL CHECK (quoted_credits > 0),
  reservation_key TEXT NOT NULL,
  generation_id UUID REFERENCES public.generations(id) ON DELETE SET NULL,
  source_storage_path TEXT,
  source_public_url TEXT,
  output_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ,
  CONSTRAINT viral_clone_items_job_index_unique UNIQUE (job_id, item_index),
  CONSTRAINT viral_clone_items_reservation_key_unique UNIQUE (reservation_key)
);

CREATE INDEX IF NOT EXISTS idx_viral_clone_items_job
  ON public.viral_clone_items (job_id, item_index);

ALTER TABLE public.viral_clone_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viral_clone_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own viral clone jobs"
  ON public.viral_clone_jobs
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own viral clone jobs"
  ON public.viral_clone_jobs
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Service role can manage viral clone jobs"
  ON public.viral_clone_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own viral clone items"
  ON public.viral_clone_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.viral_clone_jobs j
      WHERE j.id = viral_clone_items.job_id
        AND j.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert own viral clone items"
  ON public.viral_clone_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.viral_clone_jobs j
      WHERE j.id = viral_clone_items.job_id
        AND j.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Service role can manage viral clone items"
  ON public.viral_clone_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS on_viral_clone_jobs_updated ON public.viral_clone_jobs;
CREATE TRIGGER on_viral_clone_jobs_updated
  BEFORE UPDATE ON public.viral_clone_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_viral_clone_items_updated ON public.viral_clone_items;
CREATE TRIGGER on_viral_clone_items_updated
  BEFORE UPDATE ON public.viral_clone_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();