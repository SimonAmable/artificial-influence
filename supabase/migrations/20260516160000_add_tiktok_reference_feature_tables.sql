CREATE TABLE IF NOT EXISTS public.tiktok_reference_download_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'processing', 'completed', 'failed')
  ),
  source_tiktok_url TEXT NOT NULL,
  output_public_url TEXT,
  output_storage_path TEXT,
  normalization_profile TEXT,
  tiktok_snapshot JSONB,
  apify_run_id TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tiktok_ref_dl_jobs_user_created_at
  ON public.tiktok_reference_download_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tiktok_ref_dl_jobs_status
  ON public.tiktok_reference_download_jobs(status);

ALTER TABLE public.tiktok_reference_download_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own TikTok reference download jobs"
  ON public.tiktok_reference_download_jobs;
CREATE POLICY "Users can view own TikTok reference download jobs"
  ON public.tiktok_reference_download_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own TikTok reference download jobs"
  ON public.tiktok_reference_download_jobs;
CREATE POLICY "Users can insert own TikTok reference download jobs"
  ON public.tiktok_reference_download_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage TikTok reference download jobs"
  ON public.tiktok_reference_download_jobs;
CREATE POLICY "Service role can manage TikTok reference download jobs"
  ON public.tiktok_reference_download_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS on_tiktok_reference_download_jobs_updated
  ON public.tiktok_reference_download_jobs;
CREATE TRIGGER on_tiktok_reference_download_jobs_updated
  BEFORE UPDATE ON public.tiktok_reference_download_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.tiktok_reference_search_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'processing', 'completed', 'failed')
  ),
  search_query TEXT NOT NULL,
  video_sorting TEXT NOT NULL,
  date_filter TEXT NOT NULL,
  results_requested INTEGER NOT NULL CHECK (results_requested BETWEEN 1 AND 50),
  result_videos JSONB,
  apify_run_id TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tiktok_ref_search_jobs_user_created_at
  ON public.tiktok_reference_search_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tiktok_ref_search_jobs_status
  ON public.tiktok_reference_search_jobs(status);

ALTER TABLE public.tiktok_reference_search_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own TikTok reference search jobs"
  ON public.tiktok_reference_search_jobs;
CREATE POLICY "Users can view own TikTok reference search jobs"
  ON public.tiktok_reference_search_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own TikTok reference search jobs"
  ON public.tiktok_reference_search_jobs;
CREATE POLICY "Users can insert own TikTok reference search jobs"
  ON public.tiktok_reference_search_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage TikTok reference search jobs"
  ON public.tiktok_reference_search_jobs;
CREATE POLICY "Service role can manage TikTok reference search jobs"
  ON public.tiktok_reference_search_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS on_tiktok_reference_search_jobs_updated
  ON public.tiktok_reference_search_jobs;
CREATE TRIGGER on_tiktok_reference_search_jobs_updated
  BEFORE UPDATE ON public.tiktok_reference_search_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
