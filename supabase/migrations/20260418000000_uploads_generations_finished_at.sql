-- Generic uploads table (chat + future non-chat). Replaces chat_thread_media for user uploads and tool artifacts.
-- Generations stay in public.generations; listThreadMedia unions both.

CREATE TABLE IF NOT EXISTS public.uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  chat_thread_id uuid NULL REFERENCES public.chat_threads (id) ON DELETE CASCADE,
  source text NOT NULL,
  bucket text NOT NULL DEFAULT 'public-bucket',
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  label text,
  size_bytes bigint,
  width int,
  height int,
  duration_seconds numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uploads_user_created
  ON public.uploads (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_uploads_thread_created
  ON public.uploads (chat_thread_id, created_at DESC)
  WHERE chat_thread_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_uploads_user_storage_path
  ON public.uploads (user_id, storage_path);

COMMENT ON TABLE public.uploads IS 'User uploads and tool-produced media (frames, compose). Public URLs derived from bucket+storage_path.';

ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own uploads"
  ON public.uploads
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users insert own uploads"
  ON public.uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users delete own uploads"
  ON public.uploads
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Terminal timestamp for latency metrics and awaitGeneration
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS finished_at timestamptz NULL;

COMMENT ON COLUMN public.generations.finished_at IS 'Set when status becomes completed or failed (wall-clock end of job).';

UPDATE public.generations
SET finished_at = created_at
WHERE finished_at IS NULL
  AND status IN ('completed', 'failed');

-- Pending rows must carry a prediction id for polling / awaitGeneration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.generations
    WHERE status = 'pending'
      AND (replicate_prediction_id IS NULL OR length(trim(replicate_prediction_id)) = 0)
  ) THEN
    ALTER TABLE public.generations
      ADD CONSTRAINT generations_pending_requires_prediction
      CHECK (
        status != 'pending'
        OR (replicate_prediction_id IS NOT NULL AND length(trim(replicate_prediction_id)) > 0)
      );
  ELSE
    RAISE NOTICE 'Skipping generations_pending_requires_prediction: pending rows without prediction id exist; fix data then add constraint manually.';
  END IF;
END $$;

-- Migrate user uploads from chat_thread_media into uploads (preserve ids for chat history references)
INSERT INTO public.uploads (
  id,
  user_id,
  chat_thread_id,
  source,
  bucket,
  storage_path,
  mime_type,
  label,
  created_at
)
SELECT
  ctm.id,
  ctm.user_id,
  ctm.chat_thread_id,
  'chat',
  'public-bucket',
  ctm.storage_path,
  ctm.mime_type,
  ctm.label,
  ctm.created_at
FROM public.chat_thread_media ctm
WHERE ctm.media_kind = 'user_upload'
  AND ctm.storage_path IS NOT NULL
  AND length(trim(ctm.storage_path)) > 0
ON CONFLICT (id) DO NOTHING;

DROP TABLE IF EXISTS public.chat_thread_media;
