ALTER TABLE public.uploads
  ADD COLUMN IF NOT EXISTS content_hash text NULL,
  ADD COLUMN IF NOT EXISTS original_filename text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_uploads_user_bucket_content_hash
  ON public.uploads (user_id, bucket, content_hash)
  WHERE content_hash IS NOT NULL;

COMMENT ON COLUMN public.uploads.content_hash IS 'Client or server computed SHA-256 hash used for per-user dedupe.';
COMMENT ON COLUMN public.uploads.original_filename IS 'Original filename supplied by the user at upload time.';

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS upload_id uuid NULL REFERENCES public.uploads (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assets_upload_id
  ON public.assets (upload_id)
  WHERE upload_id IS NOT NULL;

ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS thumbnail_upload_id uuid NULL REFERENCES public.uploads (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workflows_thumbnail_upload_id
  ON public.workflows (thumbnail_upload_id)
  WHERE thumbnail_upload_id IS NOT NULL;
