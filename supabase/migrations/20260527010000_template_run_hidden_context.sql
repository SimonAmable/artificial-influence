ALTER TABLE public.template_runs
  ADD COLUMN IF NOT EXISTS template_context jsonb;
