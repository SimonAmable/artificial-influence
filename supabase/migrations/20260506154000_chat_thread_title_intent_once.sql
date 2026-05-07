-- Intent-based thread titles: preserve final title across message persists; at-most-one LLM naming attempt per thread.

ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS title_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intent_title_started_at timestamptz NULL;

COMMENT ON COLUMN public.chat_threads.title_locked IS 'When true, message persistence skips overwriting chat_threads.title (automation-named or LLM intent title finalized).';

COMMENT ON COLUMN public.chat_threads.intent_title_started_at IS 'CAS marker: first successful claim schedules the single intent-title LLM attempt for user threads.';
