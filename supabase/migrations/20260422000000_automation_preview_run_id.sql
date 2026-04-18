-- Track which run's thread is currently used as the public preview snapshot,
-- so owners can switch the preview to a different successful run.

ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS preview_run_id uuid
    REFERENCES public.automation_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_automations_preview_run_id
  ON public.automations(preview_run_id)
  WHERE preview_run_id IS NOT NULL;
