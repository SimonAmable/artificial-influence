ALTER TABLE public.tiktok_reference_download_jobs
  ADD COLUMN IF NOT EXISTS output_public_urls JSONB,
  ADD COLUMN IF NOT EXISTS output_storage_paths JSONB,
  ADD COLUMN IF NOT EXISTS output_media_kind TEXT CHECK (
    output_media_kind IS NULL OR output_media_kind IN ('video', 'slideshow')
  );

UPDATE public.tiktok_reference_download_jobs
SET
  output_media_kind = COALESCE(output_media_kind, CASE WHEN output_public_url IS NOT NULL THEN 'video' ELSE NULL END),
  output_public_urls = COALESCE(
    output_public_urls,
    CASE WHEN output_public_url IS NOT NULL THEN jsonb_build_array(output_public_url) ELSE NULL END
  ),
  output_storage_paths = COALESCE(
    output_storage_paths,
    CASE WHEN output_storage_path IS NOT NULL THEN jsonb_build_array(output_storage_path) ELSE NULL END
  );
