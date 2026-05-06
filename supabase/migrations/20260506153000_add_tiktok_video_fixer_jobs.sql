CREATE TABLE IF NOT EXISTS public.tiktok_video_fixer_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'processing', 'completed', 'failed')
  ),
  source_storage_path TEXT,
  source_url TEXT NOT NULL,
  source_file_name TEXT NOT NULL,
  output_storage_path TEXT,
  output_url TEXT,
  output_file_name TEXT,
  output_size_bytes BIGINT,
  profile TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_tiktok_video_fixer_jobs_user_created_at
  ON public.tiktok_video_fixer_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tiktok_video_fixer_jobs_status
  ON public.tiktok_video_fixer_jobs(status);

ALTER TABLE public.tiktok_video_fixer_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own TikTok video fixer jobs"
  ON public.tiktok_video_fixer_jobs;
CREATE POLICY "Users can view own TikTok video fixer jobs"
  ON public.tiktok_video_fixer_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own TikTok video fixer jobs"
  ON public.tiktok_video_fixer_jobs;
CREATE POLICY "Users can insert own TikTok video fixer jobs"
  ON public.tiktok_video_fixer_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage TikTok video fixer jobs"
  ON public.tiktok_video_fixer_jobs;
CREATE POLICY "Service role can manage TikTok video fixer jobs"
  ON public.tiktok_video_fixer_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS on_tiktok_video_fixer_jobs_updated
  ON public.tiktok_video_fixer_jobs;
CREATE TRIGGER on_tiktok_video_fixer_jobs_updated
  BEFORE UPDATE ON public.tiktok_video_fixer_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
