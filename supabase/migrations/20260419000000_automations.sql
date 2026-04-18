-- Automations: scheduled prompts that run the creative agent (cron + manual).

CREATE TABLE IF NOT EXISTS public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  prompt text NOT NULL,
  cron_schedule text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  model text,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz NOT NULL,
  run_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automations_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT automations_prompt_not_empty CHECK (length(trim(prompt)) > 0),
  CONSTRAINT automations_run_count_non_negative CHECK (run_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_automations_user_id
  ON public.automations(user_id);

CREATE INDEX IF NOT EXISTS idx_automations_active_next_run
  ON public.automations(is_active, next_run_at)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.chat_threads(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automation_runs_status_check CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id
  ON public.automation_runs(automation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_runs_user_id
  ON public.automation_runs(user_id);

-- Distinguish user chats from automation-spawned threads
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS automation_id uuid REFERENCES public.automations(id) ON DELETE SET NULL;

ALTER TABLE public.chat_threads
  DROP CONSTRAINT IF EXISTS chat_threads_source_check;

ALTER TABLE public.chat_threads
  ADD CONSTRAINT chat_threads_source_check CHECK (source IN ('user', 'automation'));

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their automations" ON public.automations;
CREATE POLICY "Users can view their automations"
  ON public.automations
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their automations" ON public.automations;
CREATE POLICY "Users can create their automations"
  ON public.automations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their automations" ON public.automations;
CREATE POLICY "Users can update their automations"
  ON public.automations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their automations" ON public.automations;
CREATE POLICY "Users can delete their automations"
  ON public.automations
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their automation runs" ON public.automation_runs;
CREATE POLICY "Users can view their automation runs"
  ON public.automation_runs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their automation runs" ON public.automation_runs;
CREATE POLICY "Users can create their automation runs"
  ON public.automation_runs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their automation runs" ON public.automation_runs;
CREATE POLICY "Users can update their automation runs"
  ON public.automation_runs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their automation runs" ON public.automation_runs;
CREATE POLICY "Users can delete their automation runs"
  ON public.automation_runs
  FOR DELETE
  USING (auth.uid() = user_id);
