-- Stable thread-scoped media index for chat (user uploads + chat generations).
-- Replaces sequential ref_N scanning for agent reference resolution.

CREATE TABLE IF NOT EXISTS public.chat_thread_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  chat_thread_id uuid NOT NULL REFERENCES public.chat_threads (id) ON DELETE CASCADE,
  media_kind text NOT NULL CHECK (media_kind IN ('user_upload', 'generation')),
  mime_type text NOT NULL,
  public_url text NOT NULL,
  storage_path text,
  label text,
  generation_id uuid UNIQUE REFERENCES public.generations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_thread_media_thread_created
  ON public.chat_thread_media (chat_thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_thread_media_user
  ON public.chat_thread_media (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_thread_media_thread_public_url
  ON public.chat_thread_media (chat_thread_id, public_url);

COMMENT ON TABLE public.chat_thread_media IS 'Thread-scoped media handles for listThreadMedia and generation tool mediaIds.';

ALTER TABLE public.chat_thread_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own thread media"
  ON public.chat_thread_media
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users insert own thread media"
  ON public.chat_thread_media
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users delete own thread media"
  ON public.chat_thread_media
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
