-- Follow-up plans that run automatically when a generation completes (webhook-triggered agent resume).

CREATE TABLE public.generation_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.chat_threads (id) ON DELETE CASCADE,
  generation_id uuid NOT NULL REFERENCES public.generations (id) ON DELETE CASCADE,
  plan text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT generation_follow_ups_generation_id_unique UNIQUE (generation_id)
);

CREATE INDEX idx_generation_follow_ups_thread_id ON public.generation_follow_ups (thread_id);

CREATE INDEX idx_generation_follow_ups_pending ON public.generation_follow_ups (status)
  WHERE status = 'pending';

COMMENT ON TABLE public.generation_follow_ups IS
  'Agent-scheduled follow-up: when the linked generation completes, the Replicate webhook runs a server-side chat resume with the stored plan.';

ALTER TABLE public.generation_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own generation follow-ups"
  ON public.generation_follow_ups
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generation follow-ups"
  ON public.generation_follow_ups
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
