CREATE TABLE IF NOT EXISTS public.editor_render_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.editor_projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'rendering', 'completed', 'failed')
  ),
  progress NUMERIC(5,2),
  output_storage_path TEXT,
  output_url TEXT,
  error_message TEXT,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  project_snapshot JSONB NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_editor_render_jobs_user_id_created_at
  ON public.editor_render_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_editor_render_jobs_project_id
  ON public.editor_render_jobs(project_id);

CREATE INDEX IF NOT EXISTS idx_editor_render_jobs_status
  ON public.editor_render_jobs(status);

ALTER TABLE public.editor_render_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own editor render jobs"
  ON public.editor_render_jobs;
CREATE POLICY "Users can view own editor render jobs"
  ON public.editor_render_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own editor render jobs"
  ON public.editor_render_jobs;
CREATE POLICY "Users can insert own editor render jobs"
  ON public.editor_render_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage editor render jobs"
  ON public.editor_render_jobs;
CREATE POLICY "Service role can manage editor render jobs"
  ON public.editor_render_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS on_editor_render_jobs_updated ON public.editor_render_jobs;
CREATE TRIGGER on_editor_render_jobs_updated
  BEFORE UPDATE ON public.editor_render_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
