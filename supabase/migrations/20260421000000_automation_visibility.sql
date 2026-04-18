-- Public/community automations (is_public), preview snapshots, clone provenance, run trigger.

ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS preview_thread jsonb;

ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS preview_captured_at timestamptz;

ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS cloned_from uuid REFERENCES public.automations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_automations_public
  ON public.automations(is_public, updated_at DESC)
  WHERE is_public = true;

ALTER TABLE public.automation_runs
  ADD COLUMN IF NOT EXISTS run_trigger text NOT NULL DEFAULT 'scheduled'
    CONSTRAINT automation_runs_run_trigger_check CHECK (run_trigger IN ('manual', 'scheduled'));

ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS automation_trigger text
    CONSTRAINT chat_threads_automation_trigger_check
    CHECK (automation_trigger IS NULL OR automation_trigger IN ('manual', 'scheduled'));

-- Broader read: public automations visible to any authenticated user (writes unchanged).
DROP POLICY IF EXISTS "Users can view their automations" ON public.automations;

CREATE POLICY "Users can view their automations"
  ON public.automations
  FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);
