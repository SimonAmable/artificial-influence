-- When the job successfully published to Instagram (distinct from created_at / scheduled_at).
ALTER TABLE public.autopost_jobs
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

COMMENT ON COLUMN public.autopost_jobs.published_at IS 'Set when status becomes published (actual publish completion time).';
