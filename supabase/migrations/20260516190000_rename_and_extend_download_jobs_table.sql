-- Rename download jobs table for multi-platform references (TikTok + Instagram).

ALTER TABLE public.tiktok_reference_download_jobs
  RENAME TO social_reference_download_jobs;

ALTER INDEX idx_tiktok_ref_dl_jobs_user_created_at
  RENAME TO idx_social_ref_dl_jobs_user_created_at;

ALTER INDEX idx_tiktok_ref_dl_jobs_status
  RENAME TO idx_social_ref_dl_jobs_status;

DROP TRIGGER IF EXISTS on_tiktok_reference_download_jobs_updated
  ON public.social_reference_download_jobs;

CREATE TRIGGER on_social_reference_download_jobs_updated
  BEFORE UPDATE ON public.social_reference_download_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS "Users can view own TikTok reference download jobs"
  ON public.social_reference_download_jobs;

CREATE POLICY "Users can view own social reference download jobs"
  ON public.social_reference_download_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own TikTok reference download jobs"
  ON public.social_reference_download_jobs;

CREATE POLICY "Users can insert own social reference download jobs"
  ON public.social_reference_download_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage TikTok reference download jobs"
  ON public.social_reference_download_jobs;

CREATE POLICY "Service role can manage social reference download jobs"
  ON public.social_reference_download_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.social_reference_download_jobs
  ADD COLUMN IF NOT EXISTS source_platform TEXT NOT NULL DEFAULT 'tiktok'
    CHECK (source_platform IN ('tiktok', 'instagram'));

CREATE INDEX IF NOT EXISTS idx_social_ref_dl_jobs_platform
  ON public.social_reference_download_jobs(source_platform);
